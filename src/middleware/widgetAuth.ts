import { Request, Response, NextFunction } from 'express';

import { WIDGET_ERROR_CODES } from '../constants/widget';
import { checkRateLimit } from '../services/RateLimitService';
import { validateApiKey, extractApiKey as extractKey, extractOrigin } from '../services/WidgetAuthService';
import { IApiKey } from '../types/widget';
import { logWarning, logError } from '../utils/logger';

// Define the extended interface locally
interface IApiKeyWithMethods extends IApiKey {
  _id?: string;
  validateDomain(domain: string): boolean;
  incrementUsage(endpoint?: string): Promise<IApiKeyWithMethods>;
  rotate(createdBy: string): Promise<string>;
  isExpired?: boolean;
}

// Extract API key from request headers
export const extractApiKey = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const apiKey = extractKey(req);
    
    if (apiKey === null || apiKey === undefined || apiKey === '') {
      res.status(401).json({
        success: false,
        error: 'Authentication required',
        errorCode: WIDGET_ERROR_CODES.INVALID_API_KEY
      });
      return;
    }

    // Validate API key
    const keyData = await validateApiKey(apiKey);
    if (!keyData) {
      res.status(401).json({
        success: false,
        error: 'Invalid authentication credentials',
        errorCode: WIDGET_ERROR_CODES.INVALID_API_KEY
      });
      return;
    }

    // Attach API key data to request with type casting
    (req as Request & { apiKey?: IApiKeyWithMethods }).apiKey = keyData;
    next();
  } catch (error) {
    logError('Error in API key extraction', { error: error instanceof Error ? error.message : 'Unknown error' });
    res.status(500).json({
      success: false,
      error: 'Authentication error',
      errorCode: 'INTERNAL_ERROR'
    });
  }
};

// Rate limiting middleware
export const rateLimitRequest = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const reqWithApiKey = req as Request & { apiKey?: IApiKeyWithMethods };
    if (!reqWithApiKey.apiKey) {
      next();
      return;
    }

    const identifier = `${reqWithApiKey.apiKey._id ?? reqWithApiKey.apiKey.keyPrefix}:${req.ip}`;
    const config = {
      windowMs: 60000, // 1 minute
      maxRequests: 100,
      keyPrefix: 'widget'
    };
    
    const rateLimit = await checkRateLimit(identifier, config);
    
    if (!rateLimit.allowed) {
      logWarning('Rate limit exceeded', {
        apiKey: reqWithApiKey.apiKey.keyPrefix,
        ip: req.ip,
        endpoint: req.path,
        limit: rateLimit.limit,
        remaining: rateLimit.remaining
      });

      res.status(429).json({
        success: false,
        error: 'Rate limit exceeded',
        errorCode: WIDGET_ERROR_CODES.RATE_LIMIT_EXCEEDED,
        retryAfter: rateLimit.retryAfter
      });
      return;
    }

    // Set rate limit headers
    res.setHeader('X-RateLimit-Limit', rateLimit.limit);
    res.setHeader('X-RateLimit-Remaining', rateLimit.remaining);
    res.setHeader('X-RateLimit-Reset', rateLimit.resetAt.toISOString());

    next();
  } catch (error) {
    logError('Error in rate limiting', { error: error instanceof Error ? error.message : 'Unknown error' });
    // Continue on rate limit errors - don't block requests
    next();
  }
};

// Request validation middleware
export const validateRequest = (req: Request, res: Response, next: NextFunction): void => {
  try {
    const reqWithApiKey = req as Request & { apiKey?: IApiKeyWithMethods };
    if (!reqWithApiKey.apiKey) {
      next();
      return;
    }

    const origin = extractOrigin(req);
    
    // Validate origin against whitelist
    if (!reqWithApiKey.apiKey.domainWhitelist.includes('*')) {
      const isAllowed = reqWithApiKey.apiKey.domainWhitelist.some(domain => {
        if (domain.startsWith('*.')) {
          const baseDomain = domain.slice(2);
          return origin?.endsWith(baseDomain) ?? false;
        }
        return origin === domain;
      });

      if (!isAllowed) {
        logWarning('Origin not in whitelist', {
          apiKey: reqWithApiKey.apiKey.keyPrefix,
          origin,
          whitelist: reqWithApiKey.apiKey.domainWhitelist
        });

        res.status(403).json({
          success: false,
          error: 'Origin not allowed',
          errorCode: WIDGET_ERROR_CODES.DOMAIN_NOT_ALLOWED
        });
        return;
      }
    }

    next();
  } catch (error) {
    logError('Error in request validation', { error: error instanceof Error ? error.message : 'Unknown error' });
    res.status(500).json({
      success: false,
      error: 'Validation error',
      errorCode: 'INTERNAL_ERROR'
    });
  }
}; 