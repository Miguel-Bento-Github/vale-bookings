import { Request, Response, NextFunction } from 'express';
import Redis from 'ioredis';

import { WIDGET_ERROR_CODES, RATE_LIMIT_DEFAULTS } from '../constants/widget';
import { RateLimitConfig, IApiKey } from '../types/widget';
import { logInfo, logWarning, logError } from '../utils/logger';

// Create logger functions
const logger = {
  info: logInfo,
  warn: logWarning,
  error: logError
};

// Configuration
const BLOCK_DURATION = 3600000; // 1 hour

// Initialize Redis connection
let redis: Redis;

const initializeRedis = (redisInstance?: Redis): Redis => {
  if (redisInstance) {
    redis = redisInstance;
    return redis;
  }

  if (redis) {
    return redis;
  }

  redis = new Redis({
    host: process.env.REDIS_HOST ?? 'localhost',
    port: parseInt(process.env.REDIS_PORT ?? '6379'),
    password: process.env.REDIS_PASSWORD,
    keyPrefix: 'rate_limit:',
    retryStrategy: (times: number) => {
      const delay = Math.min(times * 50, 2000);
      return delay;
    }
  });

  redis.on('error', (err: Error) => {
    logger.error('Redis connection error:', err);
  });

  redis.on('connect', () => {
    logger.info('Connected to Redis for rate limiting');
  });

  return redis;
};

// Initialize Redis
initializeRedis();

// Blocked IPs storage
const blockedIPs: Map<string, Date> = new Map();

// Clean up blocked IPs periodically
const cleanupInterval = setInterval(() => {
  const now = new Date();
  for (const [ip, blockedUntil] of blockedIPs.entries()) {
    if (blockedUntil <= now) {
      blockedIPs.delete(ip);
    }
  }
}, 60000); // Every minute

/**
 * Generate rate limit key
 */
const generateKey = (identifier: string, endpoint?: string): string => {
  if (endpoint) {
    return `${identifier}:${endpoint}`;
  }
  return identifier;
};

/**
 * Check if IP is blocked
 */
const isIPBlocked = (ip: string): boolean => {
  const blockedUntil = blockedIPs.get(ip);
  if (!blockedUntil) return false;
  
  if (blockedUntil > new Date()) {
    return true;
  }
  
  // Remove expired block
  blockedIPs.delete(ip);
  return false;
};

/**
 * Block IP address
 */
const blockIP = (ip: string, duration: number = BLOCK_DURATION): void => {
  const blockedUntil = new Date(Date.now() + duration);
  blockedIPs.set(ip, blockedUntil);
  logger.warn(`IP ${ip} blocked until ${blockedUntil.toISOString()}`);
};

/**
 * Sliding window rate limiting implementation
 */
export const checkRateLimit = async (
  identifier: string,
  config: RateLimitConfig,
  endpoint?: string
): Promise<{
  allowed: boolean;
  limit: number;
  remaining: number;
  resetAt: Date;
  retryAfter?: number;
}> => {
  const key = generateKey(identifier, endpoint);
  const now = Date.now();
  const windowStart = now - config.windowMs;

  try {
    // Use Redis pipeline for atomic operations
    const pipeline = redis.pipeline();
    
    // Remove old entries outside the window
    pipeline.zremrangebyscore(key, '-inf', windowStart);
    
    // Count requests in current window
    pipeline.zcard(key);
    
    // Add current request with timestamp as score
    const requestKey = `${now}-${Math.random()}`;
    pipeline.zadd(key, now, requestKey);
    
    // Set expiration to window size
    pipeline.expire(key, Math.ceil(config.windowMs / 1000));
    
    // Get the oldest request timestamp
    pipeline.zrange(key, 0, 0, 'WITHSCORES');
    
    const results = await pipeline.exec();
    
    if (!results) {
      throw new Error('Redis pipeline execution failed');
    }
    
    // The count is before adding the new request
    const requestCountBefore = (results[1]?.[1]) ? results[1][1] as number : 0;
    const requestCount = requestCountBefore + 1; // Include the current request
    const oldestRequest = (results[4]?.[1]) ? results[4][1] as string[] : [];
    
    // Calculate when the rate limit will reset
    let resetAt = new Date(now + config.windowMs);
    if (oldestRequest && oldestRequest.length >= 2) {
      const oldestTimestamp = parseInt(oldestRequest[1]);
      resetAt = new Date(oldestTimestamp + config.windowMs);
    }
    
    // Check if limit exceeded
    if (requestCount > config.maxRequests) {
      // Remove the request we just added since it's over the limit
      await redis.zrem(key, requestKey);
      
      const retryAfter = Math.ceil((resetAt.getTime() - now) / 1000);
      
      return {
        allowed: false,
        limit: config.maxRequests,
        remaining: 0,
        resetAt,
        retryAfter
      };
    }
    
    return {
      allowed: true,
      limit: config.maxRequests,
      remaining: Math.max(0, config.maxRequests - requestCount),
      resetAt
    };
  } catch (error) {
    logger.error('Rate limit check error:', error);
    
    // In case of Redis failure, allow the request but log the error
    return {
      allowed: true,
      limit: config.maxRequests,
      remaining: config.maxRequests,
      resetAt: new Date(now + config.windowMs)
    };
  }
};

/**
 * Get client IP address
 */
const getClientIP = (req: Request): string => {
  // Check various headers for real IP
  const forwardedFor = req.headers['x-forwarded-for'];
  if (forwardedFor) {
    const ips = (forwardedFor as string).split(',').map(ip => ip.trim());
    return ips[0] || 'unknown';
  }

  const realIP = req.headers['x-real-ip'] as string;
  if (realIP) {
    return realIP;
  }

  return req.ip ?? req.socket?.remoteAddress ?? 'unknown';
};

/**
 * Track abuse and potentially block IP
 */
const trackAbuse = async (ip: string, apiKeyPrefix?: string): Promise<void> => {
  const abuseKey = `abuse:${ip}`;
  const abuseWindow = 300000; // 5 minutes
  const maxViolations = 10;

  try {
    const violations = await redis.incr(abuseKey);
    
    if (violations === 1) {
      await redis.expire(abuseKey, Math.ceil(abuseWindow / 1000));
    }

    if (violations >= maxViolations) {
      blockIP(ip);
      await redis.del(abuseKey);
      
      if (apiKeyPrefix) {
        logger.warn(`Potential abuse detected from IP ${ip} using API key ${apiKeyPrefix}`);
      }
    }
  } catch (error) {
    logger.error('Error tracking abuse:', error);
  }
};

/**
 * Express middleware for API key-based rate limiting
 */
export const createApiKeyMiddleware = () => {
  return async (req: Request & { apiKey?: IApiKey }, res: Response, next: NextFunction) => {
    try {
      const apiKey = req.apiKey;
      if (!apiKey) {
        return res.status(401).json({
          error: 'API key required',
          errorCode: WIDGET_ERROR_CODES.INVALID_API_KEY
        });
      }

      // Check IP blocking first
      const clientIP = getClientIP(req);
      if (isIPBlocked(clientIP)) {
        return res.status(429).json({
          error: 'IP address is temporarily blocked',
          errorCode: WIDGET_ERROR_CODES.RATE_LIMIT_EXCEEDED
        });
      }

      // Get endpoint-specific config or fall back to global
      const endpoint = req.path;
      let endpointConfig: RateLimitConfig | undefined = undefined;
      
      if (apiKey.rateLimits?.endpoints instanceof Map) {
        endpointConfig = apiKey.rateLimits.endpoints.get(endpoint);
      }
      
      const config = endpointConfig ?? apiKey.rateLimits?.global ?? RATE_LIMIT_DEFAULTS.GLOBAL;

      // Check rate limit
      const result = await checkRateLimit(
        `api_key:${apiKey.keyPrefix}`,
        config,
        endpoint
      );

      // Set rate limit headers
      res.setHeader('X-RateLimit-Limit', result.limit);
      res.setHeader('X-RateLimit-Remaining', result.remaining);
      res.setHeader('X-RateLimit-Reset', result.resetAt.toISOString());

      if (!result.allowed) {
        res.setHeader('Retry-After', result.retryAfter!);
        
        // Track abuse - block IP if too many violations
        await trackAbuse(clientIP, apiKey.keyPrefix);
        
        return res.status(429).json({
          error: config.message ?? 'Too many requests',
          errorCode: WIDGET_ERROR_CODES.RATE_LIMIT_EXCEEDED,
          retryAfter: result.retryAfter
        });
      }

      // Warn if approaching limit
      if (result.remaining <= Math.ceil(result.limit * 0.2)) {
        res.setHeader('X-RateLimit-Warning', 'Approaching rate limit');
      }

      next();
    } catch (error) {
      logger.error('Rate limiting middleware error:', error);
      // Allow request on error but log it
      next();
    }
  };
};

/**
 * Express middleware for IP-based rate limiting
 */
export const createIPMiddleware = (config: RateLimitConfig = RATE_LIMIT_DEFAULTS.GLOBAL) => {
  return async (req: Request, res: Response, next: NextFunction) => {
    try {
      const clientIP = getClientIP(req);
      
      // Check if IP is blocked
      if (isIPBlocked(clientIP)) {
        return res.status(429).json({
          error: 'IP address is temporarily blocked',
          errorCode: WIDGET_ERROR_CODES.RATE_LIMIT_EXCEEDED
        });
      }

      const result = await checkRateLimit(`ip:${clientIP}`, config);

      // Set rate limit headers
      res.setHeader('X-RateLimit-Limit', result.limit);
      res.setHeader('X-RateLimit-Remaining', result.remaining);
      res.setHeader('X-RateLimit-Reset', result.resetAt.toISOString());

      if (!result.allowed) {
        res.setHeader('Retry-After', result.retryAfter!);
        
        // Block IP after too many violations
        await trackAbuse(clientIP);
        
        return res.status(429).json({
          error: config.message ?? 'Too many requests',
          errorCode: WIDGET_ERROR_CODES.RATE_LIMIT_EXCEEDED,
          retryAfter: result.retryAfter
        });
      }

      next();
    } catch (error) {
      logger.error('IP rate limiting error:', error);
      next();
    }
  };
};

/**
 * Express middleware for email-based rate limiting
 */
export const createEmailMiddleware = (config: RateLimitConfig = {
  windowMs: 3600000, // 1 hour
  maxRequests: 5 // 5 bookings per hour per email
}) => {
  return async (req: Request, res: Response, next: NextFunction) => {
    try {
      const email = req.body.guestEmail?.toLowerCase();
      if (!email) {
        return next();
      }

      const result = await checkRateLimit(`email:${email}`, config);

      if (!result.allowed) {
        return res.status(429).json({
          error: 'Too many bookings from this email address',
          errorCode: WIDGET_ERROR_CODES.RATE_LIMIT_EXCEEDED,
          retryAfter: result.retryAfter
        });
      }

      next();
    } catch (error) {
      logger.error('Email rate limiting error:', error);
      next();
    }
  };
};

/**
 * Reset rate limit for identifier
 */
export const resetRateLimit = async (identifier: string, endpoint?: string): Promise<void> => {
  const key = generateKey(identifier, endpoint);
  await redis.del(key);
  logger.info(`Rate limit reset for ${key}`);
};

/**
 * Get current usage for identifier
 */
export const getUsage = async (
  identifier: string, 
  config: RateLimitConfig, 
  endpoint?: string
): Promise<{
  used: number;
  limit: number;
  remaining: number;
  resetAt: Date;
}> => {
  const key = generateKey(identifier, endpoint);
  const now = Date.now();
  const windowStart = now - config.windowMs;

  try {
    // Remove old entries and count current ones
    await redis.zremrangebyscore(key, '-inf', windowStart);
    const used = await redis.zcard(key);
    
    // Get oldest request to calculate reset time
    const oldestRequest = await redis.zrange(key, 0, 0, 'WITHSCORES');
    
    let resetAt = new Date(now + config.windowMs);
    if (oldestRequest && oldestRequest.length >= 2 && oldestRequest[1]) {
      const oldestTimestamp = parseInt(oldestRequest[1]);
      resetAt = new Date(oldestTimestamp + config.windowMs);
    }

    return {
      used,
      limit: config.maxRequests,
      remaining: Math.max(0, config.maxRequests - used),
      resetAt
    };
  } catch (error) {
    logger.error('Error getting usage:', error);
    return {
      used: 0,
      limit: config.maxRequests,
      remaining: config.maxRequests,
      resetAt: new Date(now + config.windowMs)
    };
  }
};

/**
 * Close Redis connection
 */
export const close = async (): Promise<void> => {
  clearInterval(cleanupInterval);
  await redis.quit();
  logger.info('Rate limiting service closed');
};

/**
 * Initialize the service with a custom Redis instance (for testing)
 */
export const initialize = (redisInstance?: Redis): void => {
  initializeRedis(redisInstance);
};

// Export all functions as a single object for backward compatibility
export const rateLimitService = {
  checkRateLimit,
  createApiKeyMiddleware,
  createIPMiddleware,
  createEmailMiddleware,
  resetRateLimit,
  getUsage,
  close,
  initialize
}; 