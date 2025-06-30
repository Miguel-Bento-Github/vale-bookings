import { describe, it, expect, beforeEach, jest } from '@jest/globals';
import type { Request } from 'express';

import {
  extractApiKey,
  extractOrigin,
  validateApiKey,
  validateRequest
} from '../../../src/services/WidgetAuthService';

// ------------------------
// Mock ApiKey model
// ------------------------

interface MockApiKey {
  keyPrefix: string;
  isActive: boolean;
  isExpired: boolean;
  validateKey: (raw: string) => boolean;
  validateDomain: (domain: string) => boolean;
  incrementUsage: () => Promise<MockApiKey>;
}

// Reusable mock document instance
let mockDoc: MockApiKey;

const createMockDoc = (): MockApiKey => ({
  keyPrefix: 'abcd1234',
  isActive: true,
  isExpired: false,
  validateKey: (raw: string): boolean => raw === 'abcd1234-SECRET',
  validateDomain: (d: string): boolean => d === 'example.com',
  incrementUsage: async (): Promise<MockApiKey> => mockDoc
});

jest.mock('../../../src/models/ApiKey', () => {
  const m = jest.fn() as jest.Mock & Record<string, unknown>;
  m.findByPrefix = jest.fn(async (prefix: string) => {
    if (prefix === 'abcd1234') {
      return mockDoc;
    }
    return null;
  });
  return { ApiKey: m };
});

// ------------------------
// Tests
// ------------------------

describe('WidgetAuthService helpers', () => {
  beforeEach(() => {
    mockDoc = createMockDoc();
    jest.clearAllMocks();
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
    });

    it('fails for invalid domain', async () => {
      const req = buildReq('abcd1234-SECRET', 'https://evil.com');
      const res = await validateRequest(req);
      expect(res.isValid).toBe(false);
    });
  });
}); 