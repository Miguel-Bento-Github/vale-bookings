import { Request, Response, NextFunction } from 'express';
import Redis from 'ioredis';

import { WIDGET_ERROR_CODES, RATE_LIMIT_DEFAULTS } from '../constants/widget';
import { RateLimitConfig, IApiKey } from '../types/widget';
import { logInfo, logError } from '../utils/logger';

import { RateLimitStore, RateLimitPipeline } from './RateLimitStore';

type Redict = Redis;

// Initialize Redict connection
let redict: Redict | null;
let store: RateLimitStore | null;

const initializeRedict = (redictInstance?: Redict): Redict => {
  if (redictInstance) {
    redict = redictInstance;
    // Use the provided instance as the store as long as it structurally matches
    store = redict as RateLimitStore;
    return redict;
  }

  if (redict !== undefined && redict !== null) {
    return redict;
  }

  redict = new Redis({
    host: process.env.REDICT_HOST ?? 'localhost',
    port: parseInt(process.env.REDICT_PORT ?? '6379'),
    password: process.env.REDICT_PASSWORD,
    keyPrefix: 'rate_limit:',
    retryStrategy: (times: number): number => {
      const delay = Math.min(times * 50, 2000);
      return delay;
    }
  });

  // After creating the real Redict connection, use it as the default store
  store = redict as unknown as RateLimitStore;

  redict.on('error', (err: Error) => {
    logError('Redict connection error:', err);
  });

  redict.on('connect', () => {
    logInfo('Connected to Redict for rate limiting');
  });

  return redict;
};

// Initialize Redict only if not in test environment
if (process.env.NODE_ENV !== 'test') {
  initializeRedict();
}

// Blocked IPs storage
const blockedIPs: Map<string, Date> = new Map();

// Clean up blocked IPs periodically - only in non-test environments
let cleanupInterval: NodeJS.Timeout | null = null;
if (process.env.NODE_ENV !== 'test') {
  cleanupInterval = setInterval(() => {
    const now = new Date();
    for (const [ip, blockedUntil] of blockedIPs.entries()) {
      if (blockedUntil <= now) {
        blockedIPs.delete(ip);
      }
    }
  }, 60000); // Every minute
}

/**
 * Generate rate limit key
 */
const generateKey = (identifier: string, endpoint?: string): string => {
  if (endpoint != null && endpoint !== '') {
    return `${identifier}:${endpoint}`;
  }
  return identifier;
};

/**
 * Check if IP is blocked
 */
const isIPBlocked = (ip: string): boolean => {
  const blockedUntil = blockedIPs.get(ip);
  if (blockedUntil == null) return false;
  
  if (blockedUntil > new Date()) {
    return true;
  }
  
  // Remove expired block
  blockedIPs.delete(ip);
  return false;
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
  
  if (store == null) {
    throw new Error('RateLimit store is not initialized');
  }
  
  try {
    // Use store pipeline for atomic operations (could be Redict or in-memory)
    const pipeline: RateLimitPipeline = store.pipeline();
    
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
    
    if (results == null) {
      throw new Error('Redict pipeline execution failed');
    }
    
    // The count is before adding the new request
    const countResult = results[1]?.[1];
    const requestCountBefore = typeof countResult === 'number' ? countResult : 0;
    const requestCount = requestCountBefore + 1; // Include the current request
    const oldestResult = results[4]?.[1];
    const oldestRequest = Array.isArray(oldestResult) ? oldestResult as string[] : [];
    
    // Calculate when the rate limit will reset
    let resetAt = new Date(now + config.windowMs);
    if (Array.isArray(oldestRequest) && oldestRequest.length >= 2 && oldestRequest[1] != null) {
      const tsParsed = Number(oldestRequest[1]);
      if (!Number.isNaN(tsParsed)) {
        resetAt = new Date(tsParsed + config.windowMs);
      }
    }
    
    // Check if limit exceeded
    if (requestCount > config.maxRequests) {
      // Remove the request we just added since it's over the limit
      await store.zrem(key, requestKey);
      
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
    logError('Rate limit check error:', error);
    
    // In case of Redict failure, allow the request but log the error
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
  const forwardedForHeader = req.headers['x-forwarded-for'];
  if (typeof forwardedForHeader === 'string' && forwardedForHeader.trim() !== '') {
    const ips = forwardedForHeader.split(',').map(ip => ip.trim());
    if (Array.isArray(ips) && typeof ips[0] === 'string' && ips[0].trim() !== '') {
      return ips[0];
    }
  }

  const realIPHeader = req.headers['x-real-ip'];
  if (typeof realIPHeader === 'string' && realIPHeader.trim() !== '') {
    return realIPHeader;
  }

  if (typeof req.ip === 'string' && req.ip.trim() !== '') {
    return req.ip;
  }
  const remoteAddress = req.socket?.remoteAddress;
  if (remoteAddress == null) {
    return 'unknown';
  }
  if (typeof remoteAddress === 'string') {
    if (remoteAddress.trim() !== '') {
      return remoteAddress;
    }
  }
  return 'unknown';
};

/**
 * Track abuse and potentially block IP
 */
const trackAbuse = async (ip: string, apiKeyPrefix?: string): Promise<void> => {
  const key = typeof apiKeyPrefix === 'string' && apiKeyPrefix.trim() !== '' 
    ? `abuse:${apiKeyPrefix}:${ip}` 
    : `abuse:${ip}`;
  const now = Date.now();
  const windowStart = now - 3600000; // 1 hour
  
  if (store == null) {
    throw new Error('RateLimit store is not initialized');
  }
  
  try {
    await store.zremrangebyscore(key, '-inf', windowStart);
    await store.zadd(key, now, `${now}-${Math.random()}`);
    await store.expire(key, 3600);
  } catch (error) {
    logError('trackAbuse error:', error);
  }
};

export function validateApiKeyPresence(req: { apiKey?: IApiKey }): boolean {
  return typeof req.apiKey !== 'undefined';
}

/**
 * Express middleware for API key-based rate limiting
 */
export const createApiKeyMiddleware = (): (
  req: Request & { apiKey?: IApiKey },
  res: Response,
  next: NextFunction
) => void => {
  return (req: Request & { apiKey?: IApiKey }, res: Response, next: NextFunction): void => {
    Promise.resolve().then(async () => {
      try {
        if (!validateApiKeyPresence(req)) {
          res.status(401).json({
            error: 'API key required',
            errorCode: WIDGET_ERROR_CODES.INVALID_API_KEY
          });
          return;
        }

        // Check IP blocking first
        const clientIP = getClientIP(req);
        if (isIPBlocked(clientIP)) {
          res.status(429).json({
            error: 'IP address is temporarily blocked',
            errorCode: WIDGET_ERROR_CODES.RATE_LIMIT_EXCEEDED
          });
          return;
        }

        // Get endpoint-specific config or fall back to global
        const endpoint = req.path;
        let endpointConfig: RateLimitConfig | undefined = undefined;
        
        if (req.apiKey && req.apiKey.rateLimits?.endpoints instanceof Map) {
          const endpoints = req.apiKey.rateLimits.endpoints as Map<string, RateLimitConfig>;
          const endpointValue: unknown = endpoints.get(endpoint);
          endpointConfig = endpointValue as RateLimitConfig | undefined;
        }
        
        const config = endpointConfig ?? req.apiKey?.rateLimits?.global ?? RATE_LIMIT_DEFAULTS.GLOBAL;

        // Check rate limit
        const result = await checkRateLimit(
          `api_key:${req.apiKey?.keyPrefix}`,
          config,
          endpoint
        );

        // Set rate limit headers
        res.setHeader('X-RateLimit-Limit', result.limit);
        res.setHeader('X-RateLimit-Remaining', result.remaining);
        res.setHeader('X-RateLimit-Reset', result.resetAt.toISOString());

        if (!result.allowed) {
          if (typeof result.retryAfter === 'number') {
            res.setHeader('Retry-After', result.retryAfter);
          }
          
          // Track abuse - block IP if too many violations
          await trackAbuse(clientIP, req.apiKey?.keyPrefix);
          
          res.status(429).json({
            error: (config as RateLimitConfig)?.message ?? 'Too many requests',
            errorCode: WIDGET_ERROR_CODES.RATE_LIMIT_EXCEEDED,
            retryAfter: result.retryAfter
          });
          return;
        }

        // Warn if approaching limit
        if (result.remaining <= Math.ceil(result.limit * 0.2)) {
          res.setHeader('X-RateLimit-Warning', 'Approaching rate limit');
        }

        next();
      } catch (error) {
        logError('Rate limiting middleware error:', error);
        // Allow request on error but log it
        next();
      }
    }).catch((error) => {
      logError('Rate limiting middleware error:', error);
      next();
    });
  };
};

/**
 * Express middleware for IP-based rate limiting
 */
export const createIPMiddleware = (
  config: RateLimitConfig = RATE_LIMIT_DEFAULTS.GLOBAL
): (req: Request, res: Response, next: NextFunction) => void => {
  return (req: Request, res: Response, next: NextFunction): void => {
    Promise.resolve().then(async () => {
      try {
        const clientIP = getClientIP(req);
        
        // Check if IP is blocked
        if (isIPBlocked(clientIP)) {
          res.status(429).json({
            error: 'IP address is temporarily blocked',
            errorCode: WIDGET_ERROR_CODES.RATE_LIMIT_EXCEEDED
          });
          return;
        }

        const result = await checkRateLimit(`ip:${clientIP}`, config);

        // Set rate limit headers
        res.setHeader('X-RateLimit-Limit', result.limit);
        res.setHeader('X-RateLimit-Remaining', result.remaining);
        res.setHeader('X-RateLimit-Reset', result.resetAt.toISOString());

        if (!result.allowed) {
          if (typeof result.retryAfter === 'number') {
            res.setHeader('Retry-After', result.retryAfter);
          }
          
          // Block IP after too many violations
          await trackAbuse(clientIP);
          
          res.status(429).json({
            error: (config)?.message ?? 'Too many requests',
            errorCode: WIDGET_ERROR_CODES.RATE_LIMIT_EXCEEDED,
            retryAfter: result.retryAfter
          });
          return;
        }

        next();
        
      } catch (error) {
        logError('IP rate limiting error:', error);
        next();
        
      }
    }).catch((error) => {
      logError('IP rate limiting error:', error);
      next();
    });
  };
};

/**
 * Type guard for valid email string
 */
const isValidEmail = (email: unknown): email is string => {
  return typeof email === 'string' && email.trim() !== '';
};

/**
 * Express middleware for email-based rate limiting
 */
export const createEmailMiddleware = (config: RateLimitConfig = {
  windowMs: 3600000, // 1 hour
  maxRequests: 5 // 5 bookings per hour per email
}): (req: Request, res: Response, next: NextFunction) => void => {
  return (req: Request, res: Response, next: NextFunction): void => {
    Promise.resolve().then(async () => {
      try {
        const requestBody = req.body as { guestEmail?: string };
        const email = requestBody.guestEmail?.toLowerCase();
        
        if (!isValidEmail(email)) {
          return next();
        }

        const result = await checkRateLimit(`email:${email}`, config);

        if (!result.allowed) {
          res.status(429).json({
            error: 'Too many bookings from this email address',
            errorCode: WIDGET_ERROR_CODES.RATE_LIMIT_EXCEEDED,
            retryAfter: result.retryAfter
          });
          return;
        }

        next();
      } catch (error) {
        logError('Email rate limiting error:', error);
        next();
      }
    }).catch((error) => {
      logError('Email rate limiting error:', error);
      next();
    });
  };
};

/**
 * Reset rate limit for identifier
 */
export const resetRateLimit = async (identifier: string, endpoint?: string): Promise<void> => {
  const key = generateKey(identifier, endpoint);
  
  if (store == null) {
    throw new Error('RateLimit store is not initialized');
  }
  
  await store.del(key);
  logInfo(`Rate limit reset for ${key}`);
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
  
  if (store == null) {
    throw new Error('RateLimit store is not initialized');
  }
  
  try {
    // Remove old entries outside the window
    await store.zremrangebyscore(key, '-inf', windowStart);
    
    // Count current requests in the window
    const used = await store.zcard(key);
    
    // Get oldest request to calculate reset time
    const oldestRequest = await store.zrange(key, 0, 0, 'WITHSCORES');
    
    let resetAt = new Date(now + config.windowMs);
    if (Array.isArray(oldestRequest) && oldestRequest.length >= 2 && oldestRequest[1] != null) {
      const tsParsed = Number(oldestRequest[1]);
      if (!Number.isNaN(tsParsed)) {
        resetAt = new Date(tsParsed + config.windowMs);
      }
    }

    return {
      used,
      limit: config.maxRequests,
      remaining: Math.max(0, config.maxRequests - used),
      resetAt
    };
  } catch (error) {
    logError('Error getting usage:', error);
    return {
      used: 0,
      limit: config.maxRequests,
      remaining: config.maxRequests,
      resetAt: new Date(now + config.windowMs)
    };
  }
};

/**
 * Close Redict connection
 */
export const close = async (customRedict?: Redict | null): Promise<void> => {
  if (cleanupInterval !== null) {
    clearInterval(cleanupInterval);
    cleanupInterval = null;
  }
  const targetRedict = customRedict ?? redict;
  
  if (targetRedict !== undefined && targetRedict !== null) {
    await targetRedict.quit();
    if (!customRedict) {
      redict = null;
    }
  }
  logInfo('Rate limiting service closed');
};

/**
 * Initialize the service with a custom Redict instance (for testing)
 */
export const initialize = (redictInstance?: Redict): void => {
  initializeRedict(redictInstance);
};

// Test-only reset function to clear global state
export const __resetForTest = (): void => {
  store = null;
  redict = null;
  cleanupInterval = null;
};

// Test-only getter and setter for redict (for testing purposes only)
export const __setRedictForTest = (instance: Redict | null): void => { redict = instance; };
export const __getRedictForTest = (): Redict | null => redict;

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