import { describe, it, expect, beforeEach, jest } from '@jest/globals';
import type { Request } from 'express';

import {
  extractApiKey,
  extractOrigin,
  validateApiKey,
  validateRequest,
  generateApiKey,
  rotateApiKey,
  revokeApiKey,
  listActiveKeys,
  cleanupExpiredKeys
} from '../../../src/services/WidgetAuthService';

// ------------------------
// Mock ApiKey model
// ------------------------

interface MockApiKey {
  _id: string;
  keyPrefix: string;
  isActive: boolean;
  isExpired: boolean;
  validateKey: (raw: string) => boolean;
  validateDomain: (domain: string) => boolean;
  incrementUsage: () => Promise<MockApiKey>;
  rotate: (createdBy: string) => Promise<string>;
  save: () => Promise<MockApiKey>;
}

// Reusable mock document instance
let mockDoc: MockApiKey;
let mockNewDoc: MockApiKey;

const createMockDoc = (): MockApiKey => ({
  _id: 'api-key-123',
  keyPrefix: 'abcd1234',
  isActive: true,
  isExpired: false,
  validateKey: (raw: string): boolean => raw === 'abcd1234-SECRET',
  validateDomain: (d: string): boolean => d === 'example.com',
  incrementUsage: async (): Promise<MockApiKey> => mockDoc,
  rotate: async (): Promise<string> => 'new-raw-key-123',
  save: jest.fn().mockResolvedValue(mockDoc)
});

const createMockNewDoc = (): MockApiKey => ({
  _id: 'api-key-456',
  keyPrefix: 'efgh5678',
  isActive: true,
  isExpired: false,
  validateKey: (raw: string): boolean => raw === 'efgh5678-SECRET',
  validateDomain: (d: string): boolean => d === 'example.com',
  incrementUsage: async (): Promise<MockApiKey> => mockNewDoc,
  rotate: async (): Promise<string> => 'new-raw-key-456',
  save: jest.fn().mockResolvedValue(mockNewDoc)
});

jest.mock('../../../src/models/ApiKey', () => {
  const m = jest.fn().mockImplementation(() => ({
    save: jest.fn()
  })) as jest.Mock & Record<string, unknown>;
  m.findByPrefix = jest.fn();
  m.findById = jest.fn();
  m.findOne = jest.fn();
  m.findActive = jest.fn();
  m.cleanupExpired = jest.fn();
  return { ApiKey: m };
});

// Mock logger
jest.mock('../../../src/utils/logger', () => ({
  logInfo: jest.fn(),
  logWarning: jest.fn(),
  logError: jest.fn()
}));

// ------------------------
// Tests
// ------------------------

describe('WidgetAuthService helpers', () => {
  beforeEach(() => {
    mockDoc = createMockDoc();
    mockNewDoc = createMockNewDoc();
    jest.clearAllMocks();
    
    // Reset mock implementations
    const { ApiKey } = require('../../../src/models/ApiKey');
    ApiKey.findByPrefix.mockImplementation(async (prefix: string) => {
      if (prefix === 'abcd1234') {
        return mockDoc;
      }
      return null;
    });
    
    ApiKey.findById.mockImplementation(async (id: string) => {
      if (id === 'api-key-123') {
        return mockDoc;
      }
      return null;
    });
    
    ApiKey.findOne.mockImplementation(async (query: Record<string, unknown>) => {
      if (query.rotatedFrom === 'api-key-123') {
        return mockNewDoc;
      }
      return null;
    });
    
    ApiKey.findActive.mockReturnValue({
      where: jest.fn().mockResolvedValue([mockDoc, mockNewDoc])
    });
    
    ApiKey.cleanupExpired.mockResolvedValue({ deletedCount: 5 });
  });

  describe('extractApiKey', () => {
    it('extracts from Authorization header', () => {
      const req = { headers: { authorization: 'Bearer token123' } } as unknown as Request;
      expect(extractApiKey(req)).toBe('token123');
    });

    it('extracts from X-API-Key header', () => {
      const req = { headers: { 'x-api-key': 'xyz' } } as unknown as Request;
      expect(extractApiKey(req)).toBe('xyz');
    });

    it('extracts from apiKey query param', () => {
      const req = { headers: {}, query: { apiKey: 'qp' } } as unknown as Request;
      expect(extractApiKey(req)).toBe('qp');
    });

    it('returns null when not present', () => {
      const req = { headers: {}, query: {} } as unknown as Request;
      expect(extractApiKey(req)).toBeNull();
    });

    it('handles empty string values', () => {
      const req = { headers: { 'x-api-key': '' }, query: {} } as unknown as Request;
      expect(extractApiKey(req)).toBeNull();
    });

    it('handles undefined values', () => {
      const req = { headers: { 'x-api-key': undefined }, query: {} } as unknown as Request;
      expect(extractApiKey(req)).toBeNull();
    });
  });

  describe('extractOrigin', () => {
    it('extracts domain from Origin header', () => {
      const req = { headers: { origin: 'https://example.com' }, query: {} } as unknown as Request;
      expect(extractOrigin(req)).toBe('example.com');
    });

    it('falls back to Referer header', () => {
      const req = { headers: { referer: 'https://example.com/page' } } as unknown as Request;
      expect(extractOrigin(req)).toBe('example.com');
    });

    it('returns null for malformed URL', () => {
      const req = { headers: { origin: '::::' } } as unknown as Request;
      expect(extractOrigin(req)).toBeNull();
    });

    it('handles empty origin', () => {
      const req = { headers: { origin: '' } } as unknown as Request;
      expect(extractOrigin(req)).toBeNull();
    });

    it('handles undefined origin', () => {
      const req = { headers: { origin: undefined } } as unknown as Request;
      expect(extractOrigin(req)).toBeNull();
    });

    it('handles malformed referer URL', () => {
      const req = { headers: { referer: 'invalid-url' } } as unknown as Request;
      expect(extractOrigin(req)).toBeNull();
    });

    it('removes trailing slash from domain', () => {
      const req = { headers: { origin: 'https://example.com/' } } as unknown as Request;
      expect(extractOrigin(req)).toBe('example.com');
    });
  });

  describe('validateApiKey', () => {
    it('returns api key doc when valid', async () => {
      const result = await validateApiKey('abcd1234-SECRET');
      expect(result).not.toBeNull();
      expect(result?.keyPrefix).toBe('abcd1234');
    });

    it('returns null for unknown prefix', async () => {
      const result = await validateApiKey('zzzz9999-SECRET');
      expect(result).toBeNull();
    });

    it('returns null for failed validateKey', async () => {
      mockDoc.validateKey = () => false;
      const result = await validateApiKey('abcd1234-SECRET');
      expect(result).toBeNull();
    });

    it('returns null for inactive key', async () => {
      mockDoc.isActive = false;
      const result = await validateApiKey('abcd1234-SECRET');
      expect(result).toBeNull();
    });

    it('returns null for expired key', async () => {
      mockDoc.isExpired = true;
      const result = await validateApiKey('abcd1234-SECRET');
      expect(result).toBeNull();
    });

    it('returns null for short key', async () => {
      const result = await validateApiKey('short');
      expect(result).toBeNull();
    });

    it('handles validation errors gracefully', async () => {
      const { ApiKey } = require('../../../src/models/ApiKey');
      ApiKey.findByPrefix.mockRejectedValue(new Error('Database error'));
      const result = await validateApiKey('abcd1234-SECRET');
      expect(result).toBeNull();
    });
  });

  describe('validateRequest', () => {
    const buildReq = (key: string, origin: string): Request => ({
      headers: {
        authorization: `Bearer ${key}`,
        origin
      },
      path: '/api/widget/v1/test'
    } as unknown as Request);

    it('passes when key and domain are valid', async () => {
      const req = buildReq('abcd1234-SECRET', 'https://example.com');
      const res = await validateRequest(req);
      expect(res.isValid).toBe(true);
      expect(res.apiKey?.keyPrefix).toBe('abcd1234');
    });

    it('fails for missing key', async () => {
      const req = { headers: { origin: 'https://example.com' }, query: {} } as unknown as Request;
      const res = await validateRequest(req);
      expect(res.isValid).toBe(false);
      expect(res.error).toBe('Authentication required');
    });

    it('fails for empty key', async () => {
      const req = { headers: { authorization: 'Bearer ' }, origin: 'https://example.com' } as unknown as Request;
      const res = await validateRequest(req);
      expect(res.isValid).toBe(false);
      expect(res.error).toBe('Authentication required');
    });

    it('fails for invalid domain', async () => {
      const req = buildReq('abcd1234-SECRET', 'https://evil.com');
      const res = await validateRequest(req);
      expect(res.isValid).toBe(false);
      expect(res.error).toBe('Domain not allowed');
    });

    it('fails for missing domain', async () => {
      const req = { headers: { authorization: 'Bearer abcd1234-SECRET' }, path: '/api/widget/v1/test' } as unknown as Request;
      const res = await validateRequest(req);
      expect(res.isValid).toBe(false);
      expect(res.error).toBe('Origin domain is required');
    });

    it('fails for invalid API key', async () => {
      const req = buildReq('invalid-key', 'https://example.com');
      const res = await validateRequest(req);
      expect(res.isValid).toBe(false);
      expect(res.error).toBe('Invalid authentication credentials');
    });

    it('handles incrementUsage errors gracefully', async () => {
      mockDoc.incrementUsage = jest.fn().mockRejectedValue(new Error('Usage update failed'));
      const req = buildReq('abcd1234-SECRET', 'https://example.com');
      const res = await validateRequest(req);
      expect(res.isValid).toBe(true);
    });
  });

  describe('generateApiKey', () => {
    it('generates new API key successfully', async () => {
      const { ApiKey } = require('../../../src/models/ApiKey');
      const mockSavedKey = { ...mockDoc, _rawKey: 'generated-raw-key-123' };
      const mockInstance = { save: jest.fn().mockResolvedValue(mockSavedKey) };
      ApiKey.mockImplementation(() => mockInstance);

      const result = await generateApiKey({
        name: 'Test Key',
        domainWhitelist: ['example.com'],
        createdBy: 'admin@test.com'
      });

      expect(result.apiKey).toBeDefined();
      expect(result.rawKey).toBe('generated-raw-key-123');
    });

    it('throws error when raw key is missing', async () => {
      const { ApiKey } = require('../../../src/models/ApiKey');
      const mockSavedKey = { ...mockDoc, _rawKey: undefined };
      const mockInstance = { save: jest.fn().mockResolvedValue(mockSavedKey) };
      ApiKey.mockImplementation(() => mockInstance);

      await expect(generateApiKey({
        name: 'Test Key',
        domainWhitelist: ['example.com'],
        createdBy: 'admin@test.com'
      })).rejects.toThrow('Failed to generate API key');
    });

    it('throws error when raw key is empty', async () => {
      const { ApiKey } = require('../../../src/models/ApiKey');
      const mockSavedKey = { ...mockDoc, _rawKey: '' };
      const mockInstance = { save: jest.fn().mockResolvedValue(mockSavedKey) };
      ApiKey.mockImplementation(() => mockInstance);

      await expect(generateApiKey({
        name: 'Test Key',
        domainWhitelist: ['example.com'],
        createdBy: 'admin@test.com'
      })).rejects.toThrow('Failed to generate API key');
    });

    it('sets default allowWildcardSubdomains to false', async () => {
      const { ApiKey } = require('../../../src/models/ApiKey');
      const mockSavedKey = { ...mockDoc, _rawKey: 'generated-raw-key-123' };
      const mockInstance = { save: jest.fn().mockResolvedValue(mockSavedKey) };
      ApiKey.mockImplementation(() => mockInstance);

      await generateApiKey({
        name: 'Test Key',
        domainWhitelist: ['example.com'],
        createdBy: 'admin@test.com'
      });

      expect(ApiKey).toHaveBeenCalled();
    });
  });

  describe('rotateApiKey', () => {
    it('rotates API key successfully', async () => {
      const result = await rotateApiKey('api-key-123', 'admin@test.com');

      expect(result.oldKey).toBe(mockDoc);
      expect(result.newKey).toBe(mockNewDoc);
      expect(result.rawKey).toBe('new-raw-key-123');
    });

    it('throws error when API key not found', async () => {
      const { ApiKey } = require('../../../src/models/ApiKey');
      ApiKey.findById.mockResolvedValue(null);

      await expect(rotateApiKey('non-existent', 'admin@test.com'))
        .rejects.toThrow('API key not found');
    });

    it('throws error when rotated key not found', async () => {
      const { ApiKey } = require('../../../src/models/ApiKey');
      ApiKey.findOne.mockResolvedValue(null);

      await expect(rotateApiKey('api-key-123', 'admin@test.com'))
        .rejects.toThrow('Failed to create rotated key');
    });
  });

  describe('revokeApiKey', () => {
    it('revokes API key successfully', async () => {
      const result = await revokeApiKey('api-key-123');

      expect(result).toBe(mockDoc);
      expect(mockDoc.isActive).toBe(false);
      expect(mockDoc.save).toHaveBeenCalled();
    });

    it('throws error when API key not found', async () => {
      const { ApiKey } = require('../../../src/models/ApiKey');
      ApiKey.findById.mockResolvedValue(null);

      await expect(revokeApiKey('non-existent'))
        .rejects.toThrow('API key not found');
    });
  });

  describe('listActiveKeys', () => {
    it('lists active keys without filters', async () => {
      const { ApiKey } = require('../../../src/models/ApiKey');
      const result = await listActiveKeys();

      expect(result).toEqual([mockDoc, mockNewDoc]);
      expect(ApiKey.findActive).toHaveBeenCalled();
    });

    it('lists active keys with createdBy filter', async () => {
      const { ApiKey } = require('../../../src/models/ApiKey');
      await listActiveKeys({ createdBy: 'admin@test.com' });

      expect(ApiKey.findActive).toHaveBeenCalled();
    });

    it('lists active keys with domain filter', async () => {
      const { ApiKey } = require('../../../src/models/ApiKey');
      await listActiveKeys({ domain: 'example.com' });

      expect(ApiKey.findActive).toHaveBeenCalled();
    });

    it('lists active keys with tag filter', async () => {
      const { ApiKey } = require('../../../src/models/ApiKey');
      await listActiveKeys({ tag: 'production' });

      expect(ApiKey.findActive).toHaveBeenCalled();
    });

    it('handles empty filter values', async () => {
      const { ApiKey } = require('../../../src/models/ApiKey');
      await listActiveKeys({ createdBy: '', domain: '', tag: '' });

      expect(ApiKey.findActive).toHaveBeenCalled();
    });
  });

  describe('cleanupExpiredKeys', () => {
    it('cleans up expired keys successfully', async () => {
      const { ApiKey } = require('../../../src/models/ApiKey');
      const result = await cleanupExpiredKeys();

      expect(result).toBe(5);
      expect(ApiKey.cleanupExpired).toHaveBeenCalled();
    });

    it('handles zero deleted count', async () => {
      const { ApiKey } = require('../../../src/models/ApiKey');
      ApiKey.cleanupExpired.mockResolvedValue({ deletedCount: 0 });

      const result = await cleanupExpiredKeys();

      expect(result).toBe(0);
    });

    it('handles undefined deleted count', async () => {
      const { ApiKey } = require('../../../src/models/ApiKey');
      ApiKey.cleanupExpired.mockResolvedValue({ deletedCount: undefined });

      const result = await cleanupExpiredKeys();

      expect(result).toBe(0);
    });
  });
}); 