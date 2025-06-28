import { Request } from 'express';

import { WIDGET_ERROR_CODES } from '../../../src/constants/widget';
import { ApiKey } from '../../../src/models/ApiKey';
import { widgetAuthService } from '../../../src/services/WidgetAuthService';

// Mock the ApiKey model
jest.mock('../../../src/models/ApiKey');

describe('Widget Auth Service', () => {
  const mockApiKey = {
    _id: 'api-key-id',
    keyPrefix: 'test1234',
    isActive: true,
    isExpired: false,
    domainWhitelist: ['example.com', '*.subdomain.com'],
    allowWildcardSubdomains: true,
    validateDomain: jest.fn(),
    incrementUsage: jest.fn(),
    rotate: jest.fn(),
    rateLimits: {
      global: { windowMs: 900000, maxRequests: 100 },
      endpoints: new Map()
    }
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('extractApiKey', () => {
    it('should extract API key from Authorization header', () => {
      const req = {
        headers: {
          authorization: 'Bearer test-api-key-123'
        },
        query: {}
      } as unknown as Request;

      const key = (widgetAuthService as any).extractApiKey(req);
      expect(key).toBe('test-api-key-123');
    });

    it('should extract API key from X-API-Key header', () => {
      const req = {
        headers: {
          'x-api-key': 'test-api-key-456'
        },
        query: {}
      } as unknown as Request;

      const key = (widgetAuthService as any).extractApiKey(req);
      expect(key).toBe('test-api-key-456');
    });

    it('should extract API key from query parameter', () => {
      const req = {
        headers: {},
        query: {
          apiKey: 'test-api-key-789'
        }
      } as unknown as Request;

      const key = (widgetAuthService as any).extractApiKey(req);
      expect(key).toBe('test-api-key-789');
    });

    it('should return null if no API key found', () => {
      const req = {
        headers: {},
        query: {}
      } as unknown as Request;

      const key = (widgetAuthService as any).extractApiKey(req);
      expect(key).toBeNull();
    });

    it('should prioritize Authorization header over other sources', () => {
      const req = {
        headers: {
          authorization: 'Bearer auth-key',
          'x-api-key': 'header-key'
        },
        query: {
          apiKey: 'query-key'
        }
      } as unknown as Request;

      const key = (widgetAuthService as any).extractApiKey(req);
      expect(key).toBe('auth-key');
    });
  });

  describe('extractOrigin', () => {
    it('should extract domain from Origin header', () => {
      const req = {
        headers: {
          origin: 'https://example.com'
        }
      } as unknown as Request;

      const domain = (widgetAuthService as any).extractOrigin(req);
      expect(domain).toBe('example.com');
    });

    it('should extract domain from Referer header as fallback', () => {
      const req = {
        headers: {
          referer: 'https://app.example.com/page'
        }
      } as unknown as Request;

      const domain = (widgetAuthService as any).extractOrigin(req);
      expect(domain).toBe('app.example.com');
    });

    it('should return null for invalid URLs', () => {
      const req = {
        headers: {
          origin: 'not-a-valid-url'
        }
      } as unknown as Request;

      const domain = (widgetAuthService as any).extractOrigin(req);
      expect(domain).toBeNull();
    });

    it('should return null if no origin headers present', () => {
      const req = {
        headers: {}
      } as unknown as Request;

      const domain = (widgetAuthService as any).extractOrigin(req);
      expect(domain).toBeNull();
    });
  });

  describe('validateApiKey', () => {
    it('should return null for keys shorter than 8 characters', async () => {
      const result = await widgetAuthService.validateApiKey('short');
      expect(result).toBeNull();
    });

    it('should find and return valid API key', async () => {
      (ApiKey as any).findByPrefix = jest.fn().mockResolvedValue(mockApiKey);
      
      const result = await widgetAuthService.validateApiKey('test1234567890');
      expect(result).toEqual(mockApiKey);
      expect(ApiKey.findByPrefix).toHaveBeenCalledWith('test1234');
    });

    it('should return null if API key not found', async () => {
      (ApiKey as any).findByPrefix = jest.fn().mockResolvedValue(null);
      
      const result = await widgetAuthService.validateApiKey('notfound567890');
      expect(result).toBeNull();
    });

    it('should return null if API key is inactive', async () => {
      const inactiveKey = { ...mockApiKey, isActive: false };
      (ApiKey as any).findByPrefix = jest.fn().mockResolvedValue(inactiveKey);
      
      const result = await widgetAuthService.validateApiKey('test1234567890');
      expect(result).toBeNull();
    });

    it('should return null if API key is expired', async () => {
      const expiredKey = { ...mockApiKey, isExpired: true };
      (ApiKey as any).findByPrefix = jest.fn().mockResolvedValue(expiredKey);
      
      const result = await widgetAuthService.validateApiKey('test1234567890');
      expect(result).toBeNull();
    });
  });

  describe('validateRequest', () => {
    const mockRequest = (headers: any = {}, query: any = {}, path = '/test') => ({
      headers,
      query,
      path
    } as unknown as Request);

    beforeEach(() => {
      (ApiKey as any).findByPrefix = jest.fn().mockResolvedValue(mockApiKey);
      mockApiKey.validateDomain.mockReturnValue(true);
      mockApiKey.incrementUsage.mockResolvedValue(true);
    });

    it('should validate a valid request', async () => {
      const req = mockRequest(
        {
          authorization: 'Bearer test1234567890',
          origin: 'https://example.com'
        }
      );

      const result = await widgetAuthService.validateRequest(req);
      
      expect(result.isValid).toBe(true);
      expect(result.apiKey).toEqual(mockApiKey);
      expect(result.error).toBeUndefined();
      expect(mockApiKey.validateDomain).toHaveBeenCalledWith('example.com');
      expect(mockApiKey.incrementUsage).toHaveBeenCalledWith('/test');
    });

    it('should reject request without API key', async () => {
      const req = mockRequest({
        origin: 'https://example.com'
      });

      const result = await widgetAuthService.validateRequest(req);
      
      expect(result.isValid).toBe(false);
      expect(result.error).toBe('API key is required');
      expect(result.errorCode).toBe(WIDGET_ERROR_CODES.INVALID_API_KEY);
    });

    it('should reject request with invalid API key', async () => {
      (ApiKey as any).findByPrefix = jest.fn().mockResolvedValue(null);
      
      const req = mockRequest({
        authorization: 'Bearer invalid-key',
        origin: 'https://example.com'
      });

      const result = await widgetAuthService.validateRequest(req);
      
      expect(result.isValid).toBe(false);
      expect(result.error).toBe('Invalid API key');
      expect(result.errorCode).toBe(WIDGET_ERROR_CODES.INVALID_API_KEY);
    });

    it('should reject request without origin', async () => {
      const req = mockRequest({
        authorization: 'Bearer test1234567890'
      });

      const result = await widgetAuthService.validateRequest(req);
      
      expect(result.isValid).toBe(false);
      expect(result.error).toBe('Origin domain is required');
      expect(result.errorCode).toBe(WIDGET_ERROR_CODES.DOMAIN_NOT_ALLOWED);
    });

    it('should reject request from non-whitelisted domain', async () => {
      mockApiKey.validateDomain.mockReturnValue(false);
      
      const req = mockRequest({
        authorization: 'Bearer test1234567890',
        origin: 'https://evil.com'
      });

      const result = await widgetAuthService.validateRequest(req);
      
      expect(result.isValid).toBe(false);
      expect(result.error).toBe('Domain not allowed');
      expect(result.errorCode).toBe(WIDGET_ERROR_CODES.DOMAIN_NOT_ALLOWED);
      expect(mockApiKey.validateDomain).toHaveBeenCalledWith('evil.com');
    });
  });

  describe('generateApiKey', () => {
    it('should generate new API key with provided parameters', async () => {
      const savedKey = {
        ...mockApiKey,
        save: jest.fn().mockResolvedValue({ ...mockApiKey, _rawKey: 'generated-raw-key' })
      };
      
      (ApiKey as any).mockImplementation(() => savedKey);
      
      const params = {
        name: 'Test API Key',
        domainWhitelist: ['test.com'],
        createdBy: 'user-123'
      };
      
      const result = await widgetAuthService.generateApiKey(params);
      
      expect(result.rawKey).toBe('generated-raw-key');
      expect(result.apiKey).toBeDefined();
      expect(savedKey.save).toHaveBeenCalled();
    });

    it('should throw error if raw key generation fails', async () => {
      const savedKey = {
        save: jest.fn().mockResolvedValue({ ...mockApiKey })
      };
      
      (ApiKey as any).mockImplementation(() => savedKey);
      
      await expect(widgetAuthService.generateApiKey({
        name: 'Test',
        domainWhitelist: ['test.com'],
        createdBy: 'user-123'
      })).rejects.toThrow('Failed to generate API key');
    });
  });

  describe('rotateApiKey', () => {
    it('should rotate API key successfully', async () => {
      const oldKey = {
        ...mockApiKey,
        rotate: jest.fn().mockResolvedValue('new-raw-key')
      };
      
      const newKey = {
        ...mockApiKey,
        keyPrefix: 'new12345'
      };
      
      (ApiKey.findById as jest.Mock).mockResolvedValue(oldKey);
      (ApiKey.findOne as jest.Mock).mockResolvedValue(newKey);
      
      const result = await widgetAuthService.rotateApiKey('api-key-id', 'user-123');
      
      expect(result.oldKey).toEqual(oldKey);
      expect(result.newKey).toEqual(newKey);
      expect(result.rawKey).toBe('new-raw-key');
      expect(oldKey.rotate).toHaveBeenCalledWith('user-123');
    });

    it('should throw error if API key not found', async () => {
      (ApiKey.findById as jest.Mock).mockResolvedValue(null);
      
      await expect(widgetAuthService.rotateApiKey('invalid-id', 'user-123'))
        .rejects.toThrow('API key not found');
    });
  });

  describe('revokeApiKey', () => {
    it('should revoke API key successfully', async () => {
      const apiKey = {
        ...mockApiKey,
        save: jest.fn().mockResolvedValue(true)
      };
      
      (ApiKey.findById as jest.Mock).mockResolvedValue(apiKey);
      
      const result = await widgetAuthService.revokeApiKey('api-key-id');
      
      expect(result.isActive).toBe(false);
      expect(apiKey.save).toHaveBeenCalled();
    });

    it('should throw error if API key not found', async () => {
      (ApiKey.findById as jest.Mock).mockResolvedValue(null);
      
      await expect(widgetAuthService.revokeApiKey('invalid-id'))
        .rejects.toThrow('API key not found');
    });
  });

  describe('cleanupExpiredKeys', () => {
    it('should return count of deleted keys', async () => {
      (ApiKey as any).cleanupExpired = jest.fn().mockResolvedValue({ deletedCount: 5 });
      
      const count = await widgetAuthService.cleanupExpiredKeys();
      
      expect(count).toBe(5);
      expect(ApiKey.cleanupExpired).toHaveBeenCalled();
    });

    it('should return 0 if no keys deleted', async () => {
      (ApiKey as any).cleanupExpired = jest.fn().mockResolvedValue({ deletedCount: 0 });
      
      const count = await widgetAuthService.cleanupExpiredKeys();
      
      expect(count).toBe(0);
    });
  });
}); 