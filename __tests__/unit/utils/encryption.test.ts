import { encryptionService, resetEncryptionKey } from '../../../src/utils/encryption';

describe('Encryption Utils', () => {
  // Store original env vars
  const originalEnv = process.env;

  beforeEach(() => {
    jest.resetModules();
    process.env = { ...originalEnv };
    process.env.ENCRYPTION_KEY = 'test-encryption-key-32-bytes-long';
    process.env.ENCRYPTION_SALT = 'test-salt';
    resetEncryptionKey(); // Reset the encryption key cache
  });

  afterEach(() => {
    process.env = originalEnv;
    resetEncryptionKey(); // Reset the encryption key cache
  });

  describe('encrypt', () => {
    it('should encrypt a string and return base64 encoded result', () => {
      const plaintext = 'sensitive data';
      const encrypted = encryptionService.encrypt(plaintext);

      expect(encrypted).toBeDefined();
      expect(typeof encrypted).toBe('string');
      expect(encrypted).not.toBe(plaintext);
      // Base64 encoded string should match pattern
      expect(encrypted).toMatch(/^[A-Za-z0-9+/]+=*$/);
    });

    it('should produce different ciphertext for same plaintext (due to random IV)', () => {
      const plaintext = 'sensitive data';
      const encrypted1 = encryptionService.encrypt(plaintext);
      const encrypted2 = encryptionService.encrypt(plaintext);

      expect(encrypted1).not.toBe(encrypted2);
    });

    it('should handle empty string', () => {
      const encrypted = encryptionService.encrypt('');
      expect(encrypted).toBeDefined();
      expect(typeof encrypted).toBe('string');
    });

    it('should handle unicode characters', () => {
      const plaintext = '你好世界 🌍';
      const encrypted = encryptionService.encrypt(plaintext);
      const decrypted = encryptionService.decrypt(encrypted);

      expect(decrypted).toBe(plaintext);
    });
  });

  describe('decrypt', () => {
    it('should decrypt encrypted data back to original', () => {
      const plaintext = 'sensitive data';
      const encrypted = encryptionService.encrypt(plaintext);
      const decrypted = encryptionService.decrypt(encrypted);

      expect(decrypted).toBe(plaintext);
    });

    it('should throw error for invalid encrypted data', () => {
      expect(() => {
        encryptionService.decrypt('invalid-base64-data');
      }).toThrow('Decryption failed');
    });

    it('should throw error for tampered data', () => {
      const plaintext = 'sensitive data';
      const encrypted = encryptionService.encrypt(plaintext);
      
      // Tamper with the encrypted data
      const tampered = encrypted.slice(0, -4) + 'XXXX';
      
      expect(() => {
        encryptionService.decrypt(tampered);
      }).toThrow('Decryption failed');
    });
  });

  describe('hash', () => {
    it('should create consistent hash for same input', () => {
      const data = 'api-key-value';
      const hash1 = encryptionService.hash(data);
      const hash2 = encryptionService.hash(data);

      expect(hash1).toBe(hash2);
      expect(hash1).toHaveLength(64); // SHA-256 produces 64 hex chars
    });

    it('should create different hash with different salt', () => {
      const data = 'api-key-value';
      const hash1 = encryptionService.hash(data, 'salt1');
      const hash2 = encryptionService.hash(data, 'salt2');

      expect(hash1).not.toBe(hash2);
    });

    it('should handle empty string', () => {
      const hash = encryptionService.hash('');
      expect(hash).toBeDefined();
      expect(hash).toHaveLength(64);
    });
  });

  describe('generateSecureToken', () => {
    it('should generate token of specified length', () => {
      const token = encryptionService.generateSecureToken(32);
      expect(token).toHaveLength(64); // 32 bytes = 64 hex chars
    });

    it('should generate unique tokens', () => {
      const tokens = new Set();
      for (let i = 0; i < 100; i++) {
        tokens.add(encryptionService.generateSecureToken(16));
      }
      expect(tokens.size).toBe(100);
    });

    it('should use default length when not specified', () => {
      const token = encryptionService.generateSecureToken();
      expect(token).toHaveLength(64); // Default 32 bytes = 64 hex chars
    });
  });

  describe('generateReferenceNumber', () => {
    it('should generate reference number with correct format', () => {
      const reference = encryptionService.generateReferenceNumber();
      expect(reference).toHaveLength(8);
      expect(reference).toMatch(/^W[A-Z0-9]{7}$/);
      expect(reference).not.toMatch(/[IO1]/); // Should not contain confusing chars
    });

    it('should generate unique reference numbers', () => {
      const references = new Set();
      for (let i = 0; i < 100; i++) {
        references.add(encryptionService.generateReferenceNumber());
      }
      expect(references.size).toBe(100);
    });
  });

  describe('timingSafeCompare', () => {
    it('should return true for identical strings', () => {
      const result = encryptionService.timingSafeCompare('secret123', 'secret123');
      expect(result).toBe(true);
    });

    it('should return false for different strings', () => {
      const result = encryptionService.timingSafeCompare('secret123', 'secret456');
      expect(result).toBe(false);
    });

    it('should return false for different length strings', () => {
      const result = encryptionService.timingSafeCompare('short', 'longer-string');
      expect(result).toBe(false);
    });

    it('should handle empty strings', () => {
      const result = encryptionService.timingSafeCompare('', '');
      expect(result).toBe(true);
    });
  });

  describe('initialization errors', () => {
    it('should throw error when ENCRYPTION_KEY is missing', () => {
      delete process.env.ENCRYPTION_KEY;
      resetEncryptionKey(); // Clear the cached key
      
      expect(() => {
        encryptionService.encrypt('test');
      }).toThrow('ENCRYPTION_KEY environment variable is required');
    });
  });
}); 