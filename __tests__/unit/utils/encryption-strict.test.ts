import {
  encrypt,
  decrypt,
  hash,
  generateSecureToken,
  generateReferenceNumber,
  timingSafeCompare,
  resetEncryptionKey
} from '../../../src/utils/encryption';

describe('Encryption Service - Strict Type Safety', () => {
  beforeEach(() => {
    // Reset encryption key before each test for isolation
    resetEncryptionKey();
    
    // Set test environment variables
    process.env.ENCRYPTION_KEY = 'test-encryption-key-for-testing-only';
    process.env.ENCRYPTION_SALT = 'test-salt';
  });

  afterEach(() => {
    // Clean up environment variables
    delete process.env.ENCRYPTION_KEY;
    delete process.env.ENCRYPTION_SALT;
  });

  describe('encrypt function', () => {
    it('should encrypt strings without any type violations', () => {
      const plaintext = 'sensitive-data';
      const encrypted = encrypt(plaintext);

      expect(typeof encrypted).toBe('string');
      expect(encrypted).not.toBe(plaintext);
      expect(encrypted.length).toBeGreaterThan(0);
    });

    it('should handle empty strings', () => {
      const plaintext = '';
      const encrypted = encrypt(plaintext);

      expect(typeof encrypted).toBe('string');
      expect(encrypted.length).toBeGreaterThan(0);
    });

    it('should handle unicode characters', () => {
      const plaintext = 'Hello 🌍 Unicode ñáéíóú';
      const encrypted = encrypt(plaintext);

      expect(typeof encrypted).toBe('string');
      expect(encrypted).not.toBe(plaintext);
    });

    it('should produce different outputs for same input (IV randomization)', () => {
      const plaintext = 'same-input';
      const encrypted1 = encrypt(plaintext);
      const encrypted2 = encrypt(plaintext);

      expect(encrypted1).not.toBe(encrypted2);
      expect(typeof encrypted1).toBe('string');
      expect(typeof encrypted2).toBe('string');
    });

    it('should throw error for null input', () => {
      expect(() => {
        // @ts-expect-error - Testing runtime error handling
        encrypt(null);
      }).toThrow();
    });

    it('should throw error for undefined input', () => {
      expect(() => {
        // @ts-expect-error - Testing runtime error handling
        encrypt(undefined);
      }).toThrow();
    });
  });

  describe('decrypt function', () => {
    it('should decrypt encrypted data correctly', () => {
      const plaintext = 'confidential-information';
      const encrypted = encrypt(plaintext);
      const decrypted = decrypt(encrypted);

      expect(decrypted).toBe(plaintext);
      expect(typeof decrypted).toBe('string');
    });

    it('should handle empty string encryption/decryption', () => {
      const plaintext = '';
      const encrypted = encrypt(plaintext);
      const decrypted = decrypt(encrypted);

      expect(decrypted).toBe(plaintext);
      expect(decrypted).toBe('');
    });

    it('should handle unicode characters correctly', () => {
      const plaintext = '🔐 Secure Data ñáéíóú 中文';
      const encrypted = encrypt(plaintext);
      const decrypted = decrypt(encrypted);

      expect(decrypted).toBe(plaintext);
    });

    it('should throw error for invalid encrypted data', () => {
      const invalidEncrypted = 'invalid-encrypted-data';

      expect(() => {
        decrypt(invalidEncrypted);
      }).toThrow();
    });

    it('should throw error for null input', () => {
      expect(() => {
        // @ts-expect-error - Testing runtime error handling
        decrypt(null);
      }).toThrow();
    });

    it('should throw error for undefined input', () => {
      expect(() => {
        // @ts-expect-error - Testing runtime error handling
        decrypt(undefined);
      }).toThrow();
    });

    it('should throw error for empty string input', () => {
      expect(() => {
        decrypt('');
      }).toThrow();
    });
  });

  describe('hash function', () => {
    it('should hash strings consistently', () => {
      const data = 'data-to-hash';
      const hashed1 = hash(data);
      const hashed2 = hash(data);

      expect(hashed1).toBe(hashed2);
      expect(typeof hashed1).toBe('string');
      expect(hashed1.length).toBeGreaterThan(0);
    });

    it('should produce different hashes for different inputs', () => {
      const data1 = 'first-data';
      const data2 = 'second-data';
      const hashed1 = hash(data1);
      const hashed2 = hash(data2);

      expect(hashed1).not.toBe(hashed2);
      expect(typeof hashed1).toBe('string');
      expect(typeof hashed2).toBe('string');
    });

    it('should use custom salt when provided', () => {
      const data = 'data-to-hash';
      const salt1 = 'salt1';
      const salt2 = 'salt2';
      
      const hashed1 = hash(data, salt1);
      const hashed2 = hash(data, salt2);

      expect(hashed1).not.toBe(hashed2);
      expect(typeof hashed1).toBe('string');
      expect(typeof hashed2).toBe('string');
    });

    it('should handle empty strings', () => {
      const hashed = hash('');

      expect(typeof hashed).toBe('string');
      expect(hashed.length).toBeGreaterThan(0);
    });

    it('should throw error for null input', () => {
      expect(() => {
        // @ts-expect-error - Testing runtime error handling
        hash(null);
      }).toThrow();
    });

    it('should throw error for undefined input', () => {
      expect(() => {
        // @ts-expect-error - Testing runtime error handling
        hash(undefined);
      }).toThrow();
    });
  });

  describe('generateSecureToken function', () => {
    it('should generate tokens of specified length', () => {
      const token8 = generateSecureToken(8);
      const token16 = generateSecureToken(16);
      const token32 = generateSecureToken(32);

      expect(token8.length).toBe(16); // hex encoding doubles length
      expect(token16.length).toBe(32);
      expect(token32.length).toBe(64);
      expect(typeof token8).toBe('string');
      expect(typeof token16).toBe('string');
      expect(typeof token32).toBe('string');
    });

    it('should generate different tokens each time', () => {
      const token1 = generateSecureToken(16);
      const token2 = generateSecureToken(16);

      expect(token1).not.toBe(token2);
      expect(token1.length).toBe(token2.length);
    });

    it('should only contain hex characters', () => {
      const token = generateSecureToken(16);
      const hexRegex = /^[0-9a-f]+$/;

      expect(hexRegex.test(token)).toBe(true);
    });

    it('should handle minimum length', () => {
      const token = generateSecureToken(1);

      expect(token.length).toBe(2); // 1 byte = 2 hex chars
      expect(typeof token).toBe('string');
    });

    it('should handle zero length (generates empty token)', () => {
      const token = generateSecureToken(0);

      expect(token.length).toBe(0); // 0 bytes = 0 hex chars
      expect(typeof token).toBe('string');
    });

    it('should handle negative length gracefully', () => {
      // crypto.randomBytes with negative length will throw internally
      expect(() => {
        generateSecureToken(-1);
      }).toThrow();
    });
  });

  describe('generateReferenceNumber function', () => {
    it('should generate reference numbers with correct format', () => {
      const ref = generateReferenceNumber();

      expect(typeof ref).toBe('string');
      expect(ref.length).toBeGreaterThan(0);
      expect(ref).toMatch(/^[A-Z0-9]+$/); // Should be uppercase alphanumeric
    });

    it('should generate unique reference numbers', () => {
      const ref1 = generateReferenceNumber();
      const ref2 = generateReferenceNumber();

      expect(ref1).not.toBe(ref2);
      expect(typeof ref1).toBe('string');
      expect(typeof ref2).toBe('string');
    });

    it('should generate reference numbers of consistent length', () => {
      const ref1 = generateReferenceNumber();
      const ref2 = generateReferenceNumber();

      expect(ref1.length).toBe(ref2.length);
      expect(ref1.length).toBeGreaterThan(5); // Should be reasonably long
    });

    it('should not contain lowercase letters', () => {
      const ref = generateReferenceNumber();
      const hasLowercase = /[a-z]/.test(ref);

      expect(hasLowercase).toBe(false);
    });

    it('should not contain special characters', () => {
      const ref = generateReferenceNumber();
      const hasSpecialChars = /[^A-Z0-9]/.test(ref);

      expect(hasSpecialChars).toBe(false);
    });
  });

  describe('timingSafeCompare function', () => {
    it('should return true for identical strings', () => {
      const str = 'identical-string';
      const result = timingSafeCompare(str, str);

      expect(result).toBe(true);
      expect(typeof result).toBe('boolean');
    });

    it('should return false for different strings', () => {
      const str1 = 'first-string';
      const str2 = 'second-string';
      const result = timingSafeCompare(str1, str2);

      expect(result).toBe(false);
      expect(typeof result).toBe('boolean');
    });

    it('should handle empty strings', () => {
      const result1 = timingSafeCompare('', '');
      const result2 = timingSafeCompare('', 'non-empty');
      const result3 = timingSafeCompare('non-empty', '');

      expect(result1).toBe(true);
      expect(result2).toBe(false);
      expect(result3).toBe(false);
    });

    it('should handle unicode characters', () => {
      const str1 = 'Hello 🌍 Unicode';
      const str2 = 'Hello 🌍 Unicode';
      const str3 = 'Different 🌍 Unicode';

      expect(timingSafeCompare(str1, str2)).toBe(true);
      expect(timingSafeCompare(str1, str3)).toBe(false);
    });

    it('should be case sensitive', () => {
      const str1 = 'CaseSensitive';
      const str2 = 'casesensitive';

      expect(timingSafeCompare(str1, str2)).toBe(false);
    });

    it('should throw error for null inputs', () => {
      expect(() => {
        // @ts-expect-error - Testing runtime error handling
        timingSafeCompare(null, 'string');
      }).toThrow();

      expect(() => {
        // @ts-expect-error - Testing runtime error handling
        timingSafeCompare('string', null);
      }).toThrow();
    });

    it('should throw error for undefined inputs', () => {
      expect(() => {
        // @ts-expect-error - Testing runtime error handling
        timingSafeCompare(undefined, 'string');
      }).toThrow();

      expect(() => {
        // @ts-expect-error - Testing runtime error handling
        timingSafeCompare('string', undefined);
      }).toThrow();
    });
  });

  describe('Environment Variable Handling', () => {
    it('should throw error when ENCRYPTION_KEY is not set', () => {
      delete process.env.ENCRYPTION_KEY;
      resetEncryptionKey();

      expect(() => {
        encrypt('test-data');
      }).toThrow('ENCRYPTION_KEY environment variable is required');
    });

    it('should throw error when ENCRYPTION_KEY is empty string', () => {
      process.env.ENCRYPTION_KEY = '';
      resetEncryptionKey();

      expect(() => {
        encrypt('test-data');
      }).toThrow('ENCRYPTION_KEY environment variable is required');
    });

    it('should use default salt when ENCRYPTION_SALT is not provided', () => {
      delete process.env.ENCRYPTION_SALT;
      process.env.ENCRYPTION_KEY = 'test-key';
      resetEncryptionKey();

      const encrypted = encrypt('test-data');
      
      expect(typeof encrypted).toBe('string');
      expect(encrypted.length).toBeGreaterThan(0);
    });

    it('should handle null ENCRYPTION_KEY as string', () => {
      // Node.js converts null to string "null" in process.env
      process.env.ENCRYPTION_KEY = 'null';
      resetEncryptionKey();

      // Should work since "null" is a valid string
      const encrypted = encrypt('test-data');
      
      expect(typeof encrypted).toBe('string');
      expect(encrypted.length).toBeGreaterThan(0);
    });
  });

  describe('Integration Tests', () => {
    it('should handle full encryption/decryption cycle with complex data', () => {
      const complexData = JSON.stringify({
        email: 'user@example.com',
        phone: '+1234567890',
        name: 'John Doe ñáéíóú',
        notes: 'Special chars: !@#$%^&*()_+{}|:"<>?[]\\;\',./',
        unicode: '🔐💼📧📱',
        multiline: 'Line 1\nLine 2\nLine 3'
      });

      const encrypted = encrypt(complexData);
      const decrypted = decrypt(encrypted);
      const parsed = JSON.parse(decrypted);

      expect(parsed.email).toBe('user@example.com');
      expect(parsed.name).toBe('John Doe ñáéíóú');
      expect(parsed.unicode).toBe('🔐💼📧📱');
      expect(parsed.multiline).toBe('Line 1\nLine 2\nLine 3');
    });

    it('should maintain data integrity across multiple operations', () => {
      const originalData = 'critical-business-data-2024';
      
      // Encrypt, decrypt, hash, compare
      const encrypted = encrypt(originalData);
      const decrypted = decrypt(encrypted);
      const hashed = hash(originalData);
      const isMatch = timingSafeCompare(originalData, decrypted);

      expect(decrypted).toBe(originalData);
      expect(isMatch).toBe(true);
      expect(typeof hashed).toBe('string');
      expect(hashed.length).toBeGreaterThan(0);
    });
  });
}); 