import { validateEmail } from '../../src/utils/validation';

describe('Validation Utils', () => {
  describe('validateEmail', () => {
    it('should validate correct email format', () => {
      expect(validateEmail('test@example.com')).toBe(true);
      expect(validateEmail('user.name@domain.co.uk')).toBe(true);
      expect(validateEmail('user+tag@example.com')).toBe(true);
    });

    it('should reject invalid email format', () => {
      expect(validateEmail('invalid-email')).toBe(false);
      expect(validateEmail('missing@domain')).toBe(false);
      expect(validateEmail('@missing-local.com')).toBe(false);
      expect(validateEmail('missing-domain@')).toBe(false);
    });

    it('should enforce maximum length limits', () => {
      // Test total length limit (254 characters)
      const longEmail = 'a'.repeat(64) + '@' + 'b'.repeat(189) + '.com';
      expect(validateEmail(longEmail)).toBe(false);

      // Test local part limit (64 characters)
      const longLocalPart = 'a'.repeat(65) + '@example.com';
      expect(validateEmail(longLocalPart)).toBe(false);

      // Test domain limit (255 characters)
      const longDomain = 'user@' + 'b'.repeat(256) + '.com';
      expect(validateEmail(longDomain)).toBe(false);
    });

    it('should handle special characters correctly', () => {
      expect(validateEmail('user.name+tag@example.com')).toBe(true);
      expect(validateEmail('user-name@example.com')).toBe(true);
      expect(validateEmail('user_name@example.com')).toBe(true);
      expect(validateEmail('user.name@sub-domain.example.com')).toBe(true);
    });

    it('should reject emails with invalid characters', () => {
      expect(validateEmail('user name@example.com')).toBe(false);
      expect(validateEmail('user<name@example.com')).toBe(false);
      expect(validateEmail('user>name@example.com')).toBe(false);
      expect(validateEmail('user[name@example.com')).toBe(false);
      expect(validateEmail('user]name@example.com')).toBe(false);
    });

    it('should handle edge cases', () => {
      expect(validateEmail('')).toBe(false);
      expect(validateEmail(' ')).toBe(false);
      expect(validateEmail('@')).toBe(false);
      expect(validateEmail('user@')).toBe(false);
      expect(validateEmail('@example.com')).toBe(false);
    });
  });
}); 