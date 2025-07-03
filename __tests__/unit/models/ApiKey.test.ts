import { API_KEY_CONFIG, DATA_RETENTION_PERIODS } from '../../../src/constants/widget';
import { ApiKey } from '../../../src/models/ApiKey';
import { IApiKey } from '../../../src/types/widget';
import { encryptionService } from '../../../src/utils/encryption';

// Mock encryption service
jest.mock('../../../src/utils/encryption', () => ({
  encryptionService: {
    generateSecureToken: jest.fn(() => 'test-secure-token-32-chars-long'),
    hash: jest.fn((input: string) => `hashed-${input}`)
  }
}));

const getExpectedPrefix = (token: string) => token.substring(0, API_KEY_CONFIG.PREFIX_LENGTH);

describe('ApiKey Model Unit Tests', () => {
  const mockEncryptionService = encryptionService as jest.Mocked<typeof encryptionService>;

  beforeEach(() => {
    jest.clearAllMocks();
  });

  afterEach(async () => {
    await ApiKey.deleteMany({});
  });

  describe('Schema validation', () => {
    it('should create a valid API key with required fields', async () => {
      const apiKeyData = {
        name: 'Test API Key',
        domainWhitelist: ['example.com'],
        createdBy: 'test-user'
      };

      const apiKey = new ApiKey(apiKeyData);
      await expect(apiKey.save()).resolves.toBeDefined();

      expect(apiKey.name).toBe('Test API Key');
      expect(apiKey.domainWhitelist).toEqual(['example.com']);
      expect(apiKey.createdBy).toBe('test-user');
      expect(apiKey.isActive).toBe(true);
      expect(apiKey.allowWildcardSubdomains).toBe(false);
    });

    it('should validate required fields', async () => {
      const apiKeyData = {
        // Missing name
        domainWhitelist: ['example.com'],
        createdBy: 'test-user'
      };

      const apiKey = new ApiKey(apiKeyData);
      await expect(apiKey.validate()).rejects.toThrow();
    });

    it('should validate domain whitelist maximum length', async () => {
      const tooManyDomains = Array.from({ length: API_KEY_CONFIG.MAX_DOMAINS_PER_KEY + 1 }, (_, i) => `domain${i}.com`);
      
      const apiKeyData = {
        name: 'Test API Key',
        domainWhitelist: tooManyDomains,
        createdBy: 'test-user'
      };

      const apiKey = new ApiKey(apiKeyData);
      await expect(apiKey.validate()).rejects.toThrow(`Maximum ${API_KEY_CONFIG.MAX_DOMAINS_PER_KEY} domains allowed per API key`);
    });

    it('should validate rate limit window constraints', async () => {
      const apiKeyData = {
        name: 'Test API Key',
        domainWhitelist: ['example.com'],
        createdBy: 'test-user',
        rateLimits: {
          global: {
            windowMs: 500, // Too short
            maxRequests: 100
          }
        }
      };

      const apiKey = new ApiKey(apiKeyData);
      await expect(apiKey.validate()).rejects.toThrow();
    });

    it('should validate rate limit max requests constraints', async () => {
      const apiKeyData = {
        name: 'Test API Key',
        domainWhitelist: ['example.com'],
        createdBy: 'test-user',
        rateLimits: {
          global: {
            windowMs: 60000,
            maxRequests: 0 // Too low
          }
        }
      };

      const apiKey = new ApiKey(apiKeyData);
      await expect(apiKey.validate()).rejects.toThrow();
    });

    it('should validate name maximum length', async () => {
      const apiKeyData = {
        name: 'A'.repeat(101), // Too long
        domainWhitelist: ['example.com'],
        createdBy: 'test-user'
      };

      const apiKey = new ApiKey(apiKeyData);
      await expect(apiKey.validate()).rejects.toThrow();
    });

    it('should validate notes maximum length', async () => {
      const apiKeyData = {
        name: 'Test API Key',
        domainWhitelist: ['example.com'],
        createdBy: 'test-user',
        notes: 'A'.repeat(501) // Too long
      };

      const apiKey = new ApiKey(apiKeyData);
      await expect(apiKey.validate()).rejects.toThrow();
    });
  });

  describe('Pre-save middleware', () => {
    it('should generate key and prefix for new API keys', async () => {
      const apiKeyData = {
        name: 'Test API Key',
        domainWhitelist: ['example.com'],
        createdBy: 'test-user'
      };

      const apiKey = new ApiKey(apiKeyData);
      await apiKey.save();

      expect(mockEncryptionService.generateSecureToken).toHaveBeenCalledWith(API_KEY_CONFIG.KEY_LENGTH);
      expect(mockEncryptionService.hash).toHaveBeenCalledWith('test-secure-token-32-chars-long');
      expect(apiKey.key).toBe('hashed-test-secure-token-32-chars-long');
      expect(apiKey.keyPrefix).toBe(getExpectedPrefix('test-secure-token-32-chars-long'));
    });

    it('should not regenerate key for existing API keys', async () => {
      const apiKeyData = {
        name: 'Test API Key',
        domainWhitelist: ['example.com'],
        createdBy: 'test-user'
      };

      const apiKey = new ApiKey(apiKeyData);
      await apiKey.save();

      const originalKey = apiKey.key;
      const originalPrefix = apiKey.keyPrefix;

      apiKey.name = 'Updated Name';
      await apiKey.save();

      expect(apiKey.key).toBe(originalKey);
      expect(apiKey.keyPrefix).toBe(originalPrefix);
    });

    it('should set default expiration date when rotation days is configured', async () => {
      const apiKeyData = {
        name: 'Test API Key',
        domainWhitelist: ['example.com'],
        createdBy: 'test-user'
      };

      const apiKey = new ApiKey(apiKeyData);
      await apiKey.save();

      expect(apiKey.expiresAt).toBeDefined();
      expect(apiKey.expiresAt).toBeInstanceOf(Date);
      
      const expectedExpiration = new Date();
      expectedExpiration.setDate(expectedExpiration.getDate() + API_KEY_CONFIG.ROTATION_DAYS);
      
      // Allow for small time differences
      expect(apiKey.expiresAt).toBeDefined();
      if (apiKey.expiresAt) {
        expect(Math.abs(apiKey.expiresAt.getTime() - expectedExpiration.getTime())).toBeLessThan(1000);
      }
    });

    it('should not set expiration if rotation days is 0', async () => {
      // Temporarily modify the constant for this test
      const originalRotationDays = API_KEY_CONFIG.ROTATION_DAYS;
      (API_KEY_CONFIG as any).ROTATION_DAYS = 0;

      const apiKeyData = {
        name: 'Test API Key',
        domainWhitelist: ['example.com'],
        createdBy: 'test-user'
      };

      const apiKey = new ApiKey(apiKeyData);
      await apiKey.save();

      expect(apiKey.expiresAt).toBeUndefined();

      // Restore original value
      (API_KEY_CONFIG as any).ROTATION_DAYS = originalRotationDays;
    });
  });

  describe('Virtual properties', () => {
    it('should correctly identify expired keys', async () => {
      const pastDate = new Date();
      pastDate.setDate(pastDate.getDate() - 1);

      const apiKeyData = {
        name: 'Expired API Key',
        domainWhitelist: ['example.com'],
        createdBy: 'test-user',
        expiresAt: pastDate
      };

      const apiKey = new ApiKey(apiKeyData);
      await apiKey.save();

      expect(apiKey.isExpired).toBe(true);
    });

    it('should correctly identify non-expired keys', async () => {
      const futureDate = new Date();
      futureDate.setDate(futureDate.getDate() + 30);

      const apiKeyData = {
        name: 'Valid API Key',
        domainWhitelist: ['example.com'],
        createdBy: 'test-user',
        expiresAt: futureDate
      };

      const apiKey = new ApiKey(apiKeyData);
      await apiKey.save();

      expect(apiKey.isExpired).toBe(false);
    });

    it('should correctly identify keys that need rotation', async () => {
      const oldDate = new Date();
      oldDate.setDate(oldDate.getDate() - (API_KEY_CONFIG.ROTATION_DAYS + 1));

      const apiKeyData = {
        name: 'Old API Key',
        domainWhitelist: ['example.com'],
        createdBy: 'test-user',
        createdAt: oldDate
      };

      const apiKey = new ApiKey(apiKeyData);
      await apiKey.save();

      expect(apiKey.needsRotation).toBe(true);
    });

    it('should correctly identify keys that do not need rotation', async () => {
      const recentDate = new Date();
      recentDate.setDate(recentDate.getDate() - (API_KEY_CONFIG.ROTATION_DAYS - 10));

      const apiKeyData = {
        name: 'Recent API Key',
        domainWhitelist: ['example.com'],
        createdBy: 'test-user',
        createdAt: recentDate
      };

      const apiKey = new ApiKey(apiKeyData);
      await apiKey.save();

      expect(apiKey.needsRotation).toBe(false);
    });

    it('should handle keys without createdAt for rotation check', async () => {
      const apiKeyData = {
        name: 'API Key without createdAt',
        domainWhitelist: ['example.com'],
        createdBy: 'test-user'
      };

      const apiKey = new ApiKey(apiKeyData);
      // Manually set createdAt to undefined to test edge case
      (apiKey as any).createdAt = undefined;
      await apiKey.save();

      expect(apiKey.needsRotation).toBe(false);
    });
  });

  describe('Instance methods', () => {
    let apiKey: IApiKey;

    beforeEach(async () => {
      const apiKeyData = {
        name: 'Test API Key',
        domainWhitelist: ['example.com', '*.subdomain.com'],
        createdBy: 'test-user',
        key: 'hashed-test-key',
        keyPrefix: 'test-key'
      };

      apiKey = new ApiKey(apiKeyData);
      await apiKey.save();
    });

    describe('validateKey', () => {
      it('should validate correct key', async () => {
        mockEncryptionService.hash.mockReturnValueOnce('hashed-test-key-valid-suffix');
        const isValid = (apiKey as any).validateKey('test-key-valid-suffix');
        expect(isValid).toBe(true);
      });

      it('should reject key with wrong prefix', async () => {
        const isValid = (apiKey as any).validateKey('wrong-prefix-valid-suffix');
        expect(isValid).toBe(false);
      });

      it('should handle hash comparison errors gracefully', async () => {
        mockEncryptionService.hash.mockImplementationOnce(() => { throw new Error('Hash error'); });
        const isValid = (apiKey as any).validateKey('test-key-valid-suffix');
        expect(isValid).toBe(false);
      });


    });

    describe('validateDomain', () => {
      it('should validate exact domain match', async () => {
        const isValid = (apiKey as any).validateDomain('example.com');
        expect(isValid).toBe(true);
      });

      it('should validate wildcard subdomain', async () => {
        const isValid = (apiKey as any).validateDomain('test.subdomain.com');
        expect(isValid).toBe(true);
      });

      it('should validate exact subdomain match', async () => {
        const isValid = (apiKey as any).validateDomain('subdomain.com');
        expect(isValid).toBe(true);
      });

      it('should reject non-matching domain', async () => {
        const isValid = (apiKey as any).validateDomain('other.com');
        expect(isValid).toBe(false);
      });

      it('should reject domain for inactive key', async () => {
        apiKey.isActive = false;
        await apiKey.save();
        const isValid = (apiKey as any).validateDomain('example.com');
        expect(isValid).toBe(false);
      });

      it('should reject domain for expired key', async () => {
        const pastDate = new Date();
        pastDate.setDate(pastDate.getDate() - 1);
        apiKey.expiresAt = pastDate;
        await apiKey.save();
        const isValid = (apiKey as any).validateDomain('example.com');
        expect(isValid).toBe(false);
      });



      it('should handle non-array domain whitelist', async () => {
        apiKey.domainWhitelist = 'not-an-array' as any;
        await apiKey.save();

        const isValid = (apiKey as any).validateDomain('example.com');
        expect(isValid).toBe(false);
      });

      it('should normalize domains with protocol prefixes', async () => {
        apiKey.domainWhitelist = ['https://example.com', 'http://test.com'];
        await apiKey.save();

        expect((apiKey as any).validateDomain('example.com')).toBe(true);
        expect((apiKey as any).validateDomain('test.com')).toBe(true);
      });

      it('should normalize domains with trailing slashes', async () => {
        apiKey.domainWhitelist = ['example.com/', 'test.com/'];
        await apiKey.save();

        expect((apiKey as any).validateDomain('example.com')).toBe(true);
        expect((apiKey as any).validateDomain('test.com')).toBe(true);
      });
    });

    describe('incrementUsage', () => {
      it('should increment total requests', async () => {
        apiKey.usage = {
          totalRequests: 0,
          lastResetAt: new Date(),
          endpoints: {}
        };
        await apiKey.save();
        const initialTotal = apiKey.usage.totalRequests;
        await (apiKey as any).incrementUsage();
        expect(apiKey.usage.totalRequests).toBe(initialTotal + 1);
      });

      it('should increment endpoint-specific usage', async () => {
        const endpoint = '/api/widget/v1/bookings';
        await (apiKey as any).incrementUsage(endpoint);
        expect(apiKey.usage.endpoints[endpoint]).toBe(1);
      });

      it('should update lastUsedAt timestamp', async () => {
        const beforeTime = new Date();
        await (apiKey as any).incrementUsage();
        const afterTime = new Date();
        expect(apiKey.lastUsedAt).toBeInstanceOf(Date);
        expect(apiKey.lastUsedAt).toBeDefined();
        if (apiKey.lastUsedAt) {
          expect(apiKey.lastUsedAt.getTime()).toBeGreaterThanOrEqual(beforeTime.getTime());
          expect(apiKey.lastUsedAt.getTime()).toBeLessThanOrEqual(afterTime.getTime());
        }
      });

      it('should handle multiple endpoint increments', async () => {
        const endpoint1 = '/api/widget/v1/bookings';
        const endpoint2 = '/api/widget/v1/locations';
        await (apiKey as any).incrementUsage(endpoint1);
        await (apiKey as any).incrementUsage(endpoint1);
        await (apiKey as any).incrementUsage(endpoint2);
        expect(apiKey.usage.endpoints[endpoint1]).toBe(2);
        expect(apiKey.usage.endpoints[endpoint2]).toBe(1);
      });

      it('should ignore invalid endpoints for security', async () => {
        const invalidEndpoint = 'invalid-endpoint';
        await (apiKey as any).incrementUsage(invalidEndpoint);
        expect(apiKey.usage.endpoints[invalidEndpoint]).toBeUndefined();
      });

      it('should reset usage after 30 days', async () => {
        const oldDate = new Date();
        oldDate.setDate(oldDate.getDate() - 31);
        apiKey.usage.lastResetAt = oldDate;
        apiKey.usage.totalRequests = 100;
        apiKey.usage.endpoints = { '/api/widget/v1/bookings': 50 };
        await apiKey.save();
        await (apiKey as any).incrementUsage('/api/widget/v1/bookings');
        expect(apiKey.usage.totalRequests).toBe(1);
        expect(apiKey.usage.endpoints['/api/widget/v1/bookings']).toBe(1);
        expect(apiKey.usage.lastResetAt.getTime()).toBeGreaterThan(oldDate.getTime());
      });


    });

    describe('rotate', () => {
      it('should create new API key with rotated data', async () => {
        apiKey.key = `hashed-test-key-${Date.now()}`;
        await apiKey.save();
        const newRawKey = await (apiKey as any).rotate('new-user');
        expect(newRawKey).toBe('test-secure-token-32-chars-long');
        expect(apiKey.isActive).toBe(false);
        const newKey = await ApiKey.findOne({ name: 'Test API Key (Rotated)' });
        expect(newKey).toBeDefined();
        expect(newKey).toBeDefined();
        if (newKey) {
          expect(newKey.isActive).toBe(true);
          expect(newKey.domainWhitelist).toEqual(['example.com', '*.subdomain.com']);
          expect(newKey.allowWildcardSubdomains).toBe(false);
          expect(newKey.createdBy).toBe('new-user');
          expect(newKey.rotatedFrom).toBe(apiKey._id?.toString());
          expect(newKey.rotatedAt).toBeInstanceOf(Date);
          expect(newKey.tags).toContain('rotated');
        }
      });



      it('should handle null tags during rotation', async () => {
        apiKey.tags = null as any;
        await apiKey.save();
        await (apiKey as any).rotate('new-user');
        const newKey = await ApiKey.findOne({ name: 'Test API Key (Rotated)' });
        expect(newKey).toBeDefined();
        if (newKey) {
          expect(newKey.tags).toEqual(['rotated']);
        }
      });

      it('should handle existing tags during rotation', async () => {
        apiKey.tags = ['existing-tag'];
        await apiKey.save();
        await (apiKey as any).rotate('new-user');
        const newKey = await ApiKey.findOne({ name: 'Test API Key (Rotated)' });
        expect(newKey).toBeDefined();
        if (newKey) {
          expect(newKey.tags).toEqual(['existing-tag', 'rotated']);
        }
      });
    });
  });

  describe('Static methods', () => {
    beforeEach(async () => {
      const now = Date.now();
      await ApiKey.create([
        {
          name: 'Active Key 1',
          domainWhitelist: ['example.com'],
          createdBy: 'user1',
          isActive: true,
          keyPrefix: 'prefix1',
          key: `hashed-key1-${now}`
        },
        {
          name: 'Active Key 2',
          domainWhitelist: ['test.com'],
          createdBy: 'user2',
          isActive: true,
          keyPrefix: 'prefix2',
          expiresAt: new Date(Date.now() + 86400000),
          key: `hashed-key2-${now}`
        },
        {
          name: 'Inactive Key',
          domainWhitelist: ['inactive.com'],
          createdBy: 'user3',
          isActive: false,
          keyPrefix: 'prefix3',
          key: `hashed-key3-${now}`
        },
        {
          name: 'Expired Key',
          domainWhitelist: ['expired.com'],
          createdBy: 'user4',
          isActive: true,
          keyPrefix: 'prefix4',
          expiresAt: new Date(Date.now() - 86400000),
          key: `hashed-key4-${now}`
        }
      ]);
    });

    describe('findByPrefix', () => {
      it('should find active key by prefix', async () => {
        const key = await (ApiKey as any).findByPrefix('prefix1');
        
        expect(key).toBeDefined();
        expect(key.name).toBe('Active Key 1');
        expect(key.isActive).toBe(true);
      });

      it('should not find inactive key by prefix', async () => {
        const key = await (ApiKey as any).findByPrefix('prefix3');
        
        expect(key).toBeNull();
      });

      it('should not find expired key by prefix', async () => {
        const key = await (ApiKey as any).findByPrefix('prefix4');
        
        expect(key).toBeNull();
      });

      it('should return null for non-existent prefix', async () => {
        const key = await (ApiKey as any).findByPrefix('nonexistent');
        
        expect(key).toBeNull();
      });
    });

    describe('findActive', () => {
      it('should find all active non-expired keys', async () => {
        const keys = await (ApiKey as any).findActive() as IApiKey[];
        
        expect(keys).toHaveLength(2);
        expect(keys.map((k: IApiKey) => k.name)).toContain('Active Key 1');
        expect(keys.map((k: IApiKey) => k.name)).toContain('Active Key 2');
        expect(keys.every((k: IApiKey) => k.isActive)).toBe(true);
      });

      it('should not include inactive keys', async () => {
        const keys = await (ApiKey as any).findActive() as IApiKey[];
        
        expect(keys.map((k: IApiKey) => k.name)).not.toContain('Inactive Key');
      });

      it('should not include expired keys', async () => {
        const keys = await (ApiKey as any).findActive() as IApiKey[];
        
        expect(keys.map((k: IApiKey) => k.name)).not.toContain('Expired Key');
      });
    });

    describe('cleanupExpired', () => {
      it('should delete expired inactive keys', async () => {
        // Create an expired inactive key
        const cutoffDate = new Date();
        cutoffDate.setDate(cutoffDate.getDate() - (DATA_RETENTION_PERIODS.API_KEY_USAGE + 1));
        
        await ApiKey.create({
          name: 'Old Expired Key',
          domainWhitelist: ['old.com'],
          createdBy: 'old-user',
          isActive: false,
          expiresAt: cutoffDate
        });

        const result = await (ApiKey as any).cleanupExpired();
        
        expect(result.deletedCount).toBe(1);
        
        const remainingKey = await ApiKey.findOne({ name: 'Old Expired Key' });
        expect(remainingKey).toBeNull();
      });

      it('should not delete active keys', async () => {
        const result = await (ApiKey as any).cleanupExpired();
        
        // Should not delete any active keys
        expect(result.deletedCount).toBe(0);
        
        const activeKeys = await ApiKey.find({ isActive: true });
        expect(activeKeys.length).toBeGreaterThan(0);
      });

      it('should not delete recently expired keys', async () => {
        const result = await (ApiKey as any).cleanupExpired();
        
        // Should not delete recently expired keys
        expect(result.deletedCount).toBe(0);
      });
    });
  });

  describe('Indexes', () => {
    it('should have correct indexes defined', async () => {
      const indexes = await ApiKey.collection.indexes();
      const indexNames = indexes.map((index) => {
        const key = (index as { key: Record<string, unknown> }).key;
        return Object.keys(key)[0];
      });
      
      expect(indexNames).toContain('key');
      expect(indexNames).toContain('keyPrefix');
      expect(indexNames).toContain('isActive');
      expect(indexNames).toContain('domainWhitelist');
      expect(indexNames).toContain('createdAt');
      expect(indexNames).toContain('lastUsedAt');
      expect(indexNames).toContain('expiresAt');
    });
  });
}); 