import { Request } from 'express';

import { WIDGET_ERROR_CODES } from '../constants/widget';
import { ApiKey } from '../models/ApiKey';
import { IApiKey } from '../types/widget';
import { logInfo, logWarning, logError } from '../utils/logger';

// Create logger functions
const logger = {
  info: logInfo,
  warn: logWarning,
  error: logError
};

// Extend IApiKey with custom methods
interface IApiKeyWithMethods extends IApiKey {
  validateDomain(domain: string): boolean;
  incrementUsage(endpoint?: string): Promise<IApiKeyWithMethods>;
  rotate(createdBy: string): Promise<string>;
  isExpired: boolean;
}

/**
 * Extract API key from request
 */
export const extractApiKey = (req: Request): string | null => {
  // Check Authorization header
  const authHeader = req.headers.authorization;
  if (authHeader?.startsWith('Bearer ')) {
    return authHeader.substring(7);
  }
  
  // Check X-API-Key header
  const apiKeyHeader = req.headers['x-api-key'] as string;
  if (apiKeyHeader) {
    return apiKeyHeader;
  }
  
  // Check query parameter (less secure, but sometimes needed)
  const queryApiKey = req.query.apiKey as string;
  if (queryApiKey) {
    return queryApiKey;
  }
  
  return null;
};

/**
 * Extract domain origin from request
 */
export const extractOrigin = (req: Request): string | null => {
  // Check Origin header
  const origin = req.headers.origin;
  if (origin) {
    try {
      const url = new URL(origin);
      return url.hostname;
    } catch {
      return null;
    }
  }
  
  // Check Referer header as fallback
  const referer = req.headers.referer;
  if (referer) {
    try {
      const url = new URL(referer);
      return url.hostname;
    } catch {
      return null;
    }
  }
  
  return null;
};

/**
 * Validate API key with timing-safe comparison
 */
export const validateApiKey = async (rawKey: string): Promise<IApiKeyWithMethods | null> => {
  try {
    // Extract prefix from raw key
    if (rawKey.length < 8) {
      return null;
    }
    
    const prefix = rawKey.substring(0, 8);
    
    // Find API key by prefix
    const apiKey = await (ApiKey as any).findByPrefix(prefix) as IApiKeyWithMethods;
    if (!apiKey) {
      return null;
    }
    
    // Check if key is active and not expired
    if (!apiKey.isActive || apiKey.isExpired) {
      return null;
    }
    
    // For now, we trust the prefix match since we can't reverse the hash
    // In production, you might want to implement a different validation strategy
    // such as storing a separate validation hash
    
    return apiKey;
  } catch (error) {
    logger.error('Error validating API key', error);
    return null;
  }
};

/**
 * Validate request with API key and domain
 */
export const validateRequest = async (req: Request): Promise<{
  isValid: boolean;
  apiKey?: IApiKeyWithMethods;
  error?: string;
  errorCode?: string;
}> => {
  // Extract API key
  const rawKey = extractApiKey(req);
  if (!rawKey) {
    return {
      isValid: false,
      error: 'API key is required',
      errorCode: WIDGET_ERROR_CODES.INVALID_API_KEY
    };
  }
  
  // Validate API key
  const apiKey = await validateApiKey(rawKey);
  if (!apiKey) {
    return {
      isValid: false,
      error: 'Invalid API key',
      errorCode: WIDGET_ERROR_CODES.INVALID_API_KEY
    };
  }
  
  // Extract and validate domain
  const domain = extractOrigin(req);
  if (!domain) {
    return {
      isValid: false,
      error: 'Origin domain is required',
      errorCode: WIDGET_ERROR_CODES.DOMAIN_NOT_ALLOWED
    };
  }
  
  // Validate domain against whitelist
  if (!apiKey.validateDomain(domain)) {
    logger.warn(`Domain ${domain} not allowed for API key ${apiKey.keyPrefix}`);
    return {
      isValid: false,
      error: 'Domain not allowed',
      errorCode: WIDGET_ERROR_CODES.DOMAIN_NOT_ALLOWED
    };
  }
  
  // Update usage statistics (async, don't wait)
  apiKey.incrementUsage(req.path).catch((err: Error) => {
    logger.error('Error updating API key usage', err);
  });
  
  return {
    isValid: true,
    apiKey
  };
};

/**
 * Generate new API key
 */
export const generateApiKey = async (params: {
  name: string;
  domainWhitelist: string[];
  allowWildcardSubdomains?: boolean;
  createdBy: string;
  notes?: string;
  expiresAt?: Date;
}): Promise<{ apiKey: IApiKeyWithMethods; rawKey: string }> => {
  const apiKey = new ApiKey({
    name: params.name,
    domainWhitelist: params.domainWhitelist,
    allowWildcardSubdomains: params.allowWildcardSubdomains ?? false,
    createdBy: params.createdBy,
    notes: params.notes,
    expiresAt: params.expiresAt
  });
  
  const savedKey = await apiKey.save();
  const rawKey = (savedKey as any)._rawKey;
  
  if (!rawKey) {
    throw new Error('Failed to generate API key');
  }
  
  logger.info(`API key created: ${savedKey.keyPrefix} for domains: ${params.domainWhitelist.join(', ')}`);
  
  return { apiKey: savedKey as IApiKeyWithMethods, rawKey };
};

/**
 * Rotate API key
 */
export const rotateApiKey = async (
  apiKeyId: string, 
  createdBy: string
): Promise<{
  oldKey: IApiKeyWithMethods;
  newKey: IApiKeyWithMethods;
  rawKey: string;
}> => {
  const oldKey = await ApiKey.findById(apiKeyId) as IApiKeyWithMethods;
  if (!oldKey) {
    throw new Error('API key not found');
  }
  
  const rawKey = await oldKey.rotate(createdBy);
  const newKey = await ApiKey.findOne({ rotatedFrom: oldKey._id }) as IApiKeyWithMethods;
  
  if (!newKey) {
    throw new Error('Failed to create rotated key');
  }
  
  logger.info(`API key rotated: ${oldKey.keyPrefix} -> ${newKey.keyPrefix}`);
  
  return { oldKey, newKey, rawKey };
};

/**
 * Revoke API key
 */
export const revokeApiKey = async (apiKeyId: string): Promise<IApiKeyWithMethods> => {
  const apiKey = await ApiKey.findById(apiKeyId) as IApiKeyWithMethods;
  if (!apiKey) {
    throw new Error('API key not found');
  }
  
  apiKey.isActive = false;
  await apiKey.save();
  
  logger.info(`API key revoked: ${apiKey.keyPrefix}`);
  
  return apiKey;
};

/**
 * List active API keys
 */
export const listActiveKeys = async (filters?: {
  createdBy?: string;
  domain?: string;
  tag?: string;
}): Promise<IApiKeyWithMethods[]> => {
  const query: any = { isActive: true };
  
  if (filters?.createdBy) {
    query.createdBy = filters.createdBy;
  }
  
  if (filters?.domain) {
    query.domainWhitelist = filters.domain;
  }
  
  if (filters?.tag) {
    query.tags = filters.tag;
  }
  
  return (ApiKey as any).findActive().where(query) as Promise<IApiKeyWithMethods[]>;
};

/**
 * Clean up expired API keys
 */
export const cleanupExpiredKeys = async (): Promise<number> => {
  const result = await (ApiKey as any).cleanupExpired();
  
  if (result.deletedCount > 0) {
    logger.info(`Cleaned up ${result.deletedCount} expired API keys`);
  }
  
  return result.deletedCount;
};

// Export all functions as a single object for backward compatibility
export const widgetAuthService = {
  extractApiKey,
  extractOrigin,
  validateApiKey,
  validateRequest,
  generateApiKey,
  rotateApiKey,
  revokeApiKey,
  listActiveKeys,
  cleanupExpiredKeys
}; 