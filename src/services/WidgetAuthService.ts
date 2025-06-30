import { Request } from 'express';

import { WIDGET_ERROR_CODES } from '../constants/widget';
import { ApiKey } from '../models/ApiKey';
import { IApiKey } from '../types/widget';
import { logInfo, logWarning, logError } from '../utils/logger';

// Extend IApiKey with custom methods
interface IApiKeyWithMethods extends IApiKey {
  validateKey(rawKey: string): boolean;
  validateDomain(domain: string): boolean;
  incrementUsage(endpoint?: string): Promise<IApiKeyWithMethods>;
  rotate(createdBy: string): Promise<string>;
  isExpired: boolean;
}

// Helper type for static methods that Mongoose adds via plugins
type ApiKeyModel = typeof ApiKey & {
  findByPrefix(prefix: string): Promise<IApiKeyWithMethods | null>;
  findActive(): { where: (query: Record<string, unknown>) => Promise<IApiKeyWithMethods[]> };
  cleanupExpired(): Promise<{ deletedCount: number }>;
};

// Cast once to a properly typed model to avoid `any` usage
const ApiKeyTyped = ApiKey as unknown as ApiKeyModel;

/**
 * Extract API key from request
 */
export const extractApiKey = (req: Request): string | null => {
  // Check Authorization header
  const authHeader = req.headers.authorization;
  if (authHeader?.startsWith('Bearer ') === true) {
    return authHeader.substring(7);
  }
  
  // Check X-API-Key header
  const apiKeyHeader = req.headers['x-api-key'] as string | undefined;
  if (apiKeyHeader !== undefined && apiKeyHeader !== '') {
    return apiKeyHeader;
  }
  
  // Check query parameter (less secure, but sometimes needed)
  const queryApiKey = req.query.apiKey as string | undefined;
  if (queryApiKey !== undefined && queryApiKey !== '') {
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
  if (origin !== undefined && origin !== '') {
    try {
      const url = new URL(origin);
      const domain = url.hostname.replace(/^https?:\/\//, '').replace(/\/$/, '');
      return domain;
    } catch {
      return null;
    }
  }
  
  // Check Referer header as fallback
  const referer = req.headers.referer;
  if (referer !== undefined && referer !== '') {
    try {
      const url = new URL(referer);
      const domain = url.hostname.replace(/^https?:\/\//, '').replace(/\/$/, '');
      return domain;
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
    const apiKey = await ApiKeyTyped.findByPrefix(prefix);
    if (apiKey === null) {
      return null;
    }
    
    // Check if key is active and not expired
    if (apiKey.isActive !== true || apiKey.isExpired === true) {
      return null;
    }
    
    // Validate the full key using the instance method
    if (!apiKey.validateKey(rawKey)) {
      return null;
    }
    
    return apiKey;
  } catch (error) {
    logError('Error validating API key', error);
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
  if (rawKey === null || rawKey === '') {
    return {
      isValid: false,
      error: 'Authentication required',
      errorCode: WIDGET_ERROR_CODES.INVALID_API_KEY
    };
  }
  
  // Validate API key
  const apiKey = await validateApiKey(rawKey);
  if (apiKey === null) {
    return {
      isValid: false,
      error: 'Invalid authentication credentials',
      errorCode: WIDGET_ERROR_CODES.INVALID_API_KEY
    };
  }
  
  // Extract and validate domain
  const domain = extractOrigin(req);
  if (domain === null || domain === '') {
    return {
      isValid: false,
      error: 'Origin domain is required',
      errorCode: WIDGET_ERROR_CODES.DOMAIN_NOT_ALLOWED
    };
  }
  
  // Validate domain against whitelist
  if (!apiKey.validateDomain(domain)) {
    logWarning(`Domain ${domain} not allowed for API key ${apiKey.keyPrefix}`);
    return {
      isValid: false,
      error: 'Domain not allowed',
      errorCode: WIDGET_ERROR_CODES.DOMAIN_NOT_ALLOWED
    };
  }
  
  // Update usage statistics (async, don't wait)
  apiKey.incrementUsage(req.path).catch((err: Error) => {
    logError('Error updating API key usage', err);
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
  interface ApiKeyWithRaw extends IApiKeyWithMethods { _rawKey: string }
  const rawKey = (savedKey as unknown as ApiKeyWithRaw)._rawKey;
  
  if (rawKey === undefined || rawKey === '') {
    throw new Error('Failed to generate API key');
  }
  
  logInfo(`API key created: ${savedKey.keyPrefix} for domains: ${params.domainWhitelist.join(', ')}`);
  
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
  if (oldKey === null) {
    throw new Error('API key not found');
  }
  
  const rawKey = await oldKey.rotate(createdBy);
  const newKey = await ApiKey.findOne({ rotatedFrom: oldKey._id }) as IApiKeyWithMethods;
  
  if (newKey === null) {
    throw new Error('Failed to create rotated key');
  }
  
  logInfo(`API key rotated: ${oldKey.keyPrefix} -> ${newKey.keyPrefix}`);
  
  return { oldKey, newKey, rawKey };
};

/**
 * Revoke API key
 */
export const revokeApiKey = async (apiKeyId: string): Promise<IApiKeyWithMethods> => {
  const apiKey = await ApiKey.findById(apiKeyId) as IApiKeyWithMethods;
  if (apiKey === null) {
    throw new Error('API key not found');
  }
  
  apiKey.isActive = false;
  await apiKey.save();
  
  logInfo(`API key revoked: ${apiKey.keyPrefix}`);
  
  return apiKey;
};

/**
 * List active API keys
 */
export const listActiveKeys = (filters?: {
  createdBy?: string;
  domain?: string;
  tag?: string;
}): Promise<IApiKeyWithMethods[]> => {
  const query: Record<string, unknown> = { isActive: true };
  
  if (filters?.createdBy !== undefined && filters.createdBy !== '') {
    query.createdBy = filters.createdBy;
  }
  
  if (filters?.domain !== undefined && filters.domain !== '') {
    query.domainWhitelist = filters.domain;
  }
  
  if (filters?.tag !== undefined && filters.tag !== '') {
    query.tags = filters.tag;
  }
  
  return ApiKeyTyped.findActive().where(query);
};

/**
 * Clean up expired API keys
 */
export const cleanupExpiredKeys = async (): Promise<number> => {
  const result = await ApiKeyTyped.cleanupExpired();
  
  if ((result.deletedCount ?? 0) > 0) {
    logInfo(`Cleaned up ${result.deletedCount ?? 0} expired API keys`);
  }
  
  return result.deletedCount ?? 0;
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