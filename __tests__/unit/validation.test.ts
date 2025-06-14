import {
  validateEmail,
  validatePassword,
  validateCoordinates,
  validateTimeFormat,
  validatePhoneNumber
} from '../../src/utils/validation';

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

    // Additional edge cases for branch coverage
    it('should handle malformed emails with multiple @ signs', () => {
      expect(validateEmail('user@@example.com')).toBe(false);
      expect(validateEmail('user@domain@example.com')).toBe(false);
    });

    it('should require domain to have TLD', () => {
      expect(validateEmail('user@domain')).toBe(false);
      expect(validateEmail('user@localhost')).toBe(false);
    });

    it('should handle undefined parts after split', () => {
      // These should be caught by the split length check, but testing for safety
      expect(validateEmail('@@')).toBe(false);
      expect(validateEmail('@@@')).toBe(false);
    });
  });

  describe('validatePassword', () => {
    it('should accept valid passwords', () => {
      expect(validatePassword('password')).toBe(true);
      expect(validatePassword('123456')).toBe(true);
      expect(validatePassword('abcdef')).toBe(true);
      expect(validatePassword('password123')).toBe(true);
      expect(validatePassword('VeryLongPasswordThatIsValid')).toBe(true);
    });

    it('should reject passwords that are too short', () => {
      expect(validatePassword('')).toBe(false);
      expect(validatePassword('a')).toBe(false);
      expect(validatePassword('12345')).toBe(false);
      expect(validatePassword('abc')).toBe(false);
    });

    it('should handle non-string inputs', () => {
      expect(validatePassword(123456 as unknown as string)).toBe(false);
      expect(validatePassword(null as unknown as string)).toBe(false);
      expect(validatePassword(undefined as unknown as string)).toBe(false);
      expect(validatePassword({} as unknown as string)).toBe(false);
      expect(validatePassword([] as unknown as string)).toBe(false);
    });

    it('should accept exactly 6 character password', () => {
      expect(validatePassword('123456')).toBe(true);
      expect(validatePassword('abcdef')).toBe(true);
    });
  });

  describe('validateCoordinates', () => {
    it('should accept valid coordinates', () => {
      expect(validateCoordinates(0, 0)).toBe(true);
      expect(validateCoordinates(40.7128, -74.0060)).toBe(true); // NYC
      expect(validateCoordinates(-33.8688, 151.2093)).toBe(true); // Sydney
      expect(validateCoordinates(90, 180)).toBe(true); // Max values
      expect(validateCoordinates(-90, -180)).toBe(true); // Min values
    });

    it('should reject invalid latitude values', () => {
      expect(validateCoordinates(91, 0)).toBe(false); // Too high
      expect(validateCoordinates(-91, 0)).toBe(false); // Too low
      expect(validateCoordinates(100, 0)).toBe(false);
      expect(validateCoordinates(-100, 0)).toBe(false);
    });

    it('should reject invalid longitude values', () => {
      expect(validateCoordinates(0, 181)).toBe(false); // Too high
      expect(validateCoordinates(0, -181)).toBe(false); // Too low
      expect(validateCoordinates(0, 200)).toBe(false);
      expect(validateCoordinates(0, -200)).toBe(false);
    });

    it('should reject when both latitude and longitude are invalid', () => {
      expect(validateCoordinates(91, 181)).toBe(false);
      expect(validateCoordinates(-91, -181)).toBe(false);
      expect(validateCoordinates(100, 200)).toBe(false);
    });

    it('should handle edge boundary values', () => {
      // Test exact boundaries
      expect(validateCoordinates(90, 0)).toBe(true);
      expect(validateCoordinates(-90, 0)).toBe(true);
      expect(validateCoordinates(0, 180)).toBe(true);
      expect(validateCoordinates(0, -180)).toBe(true);

      // Test just outside boundaries
      expect(validateCoordinates(90.1, 0)).toBe(false);
      expect(validateCoordinates(-90.1, 0)).toBe(false);
      expect(validateCoordinates(0, 180.1)).toBe(false);
      expect(validateCoordinates(0, -180.1)).toBe(false);
    });
  });

  describe('validateTimeFormat', () => {
    it('should accept valid time formats', () => {
      expect(validateTimeFormat('00:00')).toBe(true);
      expect(validateTimeFormat('12:30')).toBe(true);
      expect(validateTimeFormat('23:59')).toBe(true);
      expect(validateTimeFormat('9:15')).toBe(true);
      expect(validateTimeFormat('08:45')).toBe(true);
    });

    it('should reject invalid time formats', () => {
      expect(validateTimeFormat('24:00')).toBe(false); // Invalid hour
      expect(validateTimeFormat('12:60')).toBe(false); // Invalid minute
      expect(validateTimeFormat('25:30')).toBe(false); // Invalid hour
      expect(validateTimeFormat('12:75')).toBe(false); // Invalid minute
    });

    it('should reject malformed time strings', () => {
      expect(validateTimeFormat('12')).toBe(false); // Missing minutes
      expect(validateTimeFormat('12:')).toBe(false); // Missing minutes
      expect(validateTimeFormat(':30')).toBe(false); // Missing hours
      expect(validateTimeFormat('12-30')).toBe(false); // Wrong separator
      expect(validateTimeFormat('12.30')).toBe(false); // Wrong separator
    });

    it('should reject non-time strings', () => {
      expect(validateTimeFormat('')).toBe(false);
      expect(validateTimeFormat('invalid')).toBe(false);
      expect(validateTimeFormat('12:30:45')).toBe(false); // Has seconds
      expect(validateTimeFormat('12:30 AM')).toBe(false); // AM/PM format
    });

    it('should handle edge cases', () => {
      expect(validateTimeFormat('0:0')).toBe(false); // Single digit minutes not allowed by regex
      expect(validateTimeFormat('00:0')).toBe(false); // Single digit minutes not allowed by regex
      expect(validateTimeFormat('0:00')).toBe(true); // Valid format
      expect(validateTimeFormat('abc:def')).toBe(false); // Non-numeric
    });
  });

  describe('validatePhoneNumber', () => {
    it('should accept valid phone number formats', () => {
      expect(validatePhoneNumber('1234567890')).toBe(true); // 10 digits
      expect(validatePhoneNumber('+1234567890')).toBe(true); // With country code
      expect(validatePhoneNumber('123-456-7890')).toBe(true); // With dashes
      expect(validatePhoneNumber('(123) 456-7890')).toBe(true); // With parentheses
      expect(validatePhoneNumber('+1 (234) 567-8901')).toBe(true); // Full format
      expect(validatePhoneNumber('123 456 7890')).toBe(true); // With spaces
    });

    it('should reject phone numbers that are too short', () => {
      expect(validatePhoneNumber('123456789')).toBe(false); // 9 digits
      expect(validatePhoneNumber('12345')).toBe(false); // 5 digits
      expect(validatePhoneNumber('')).toBe(false); // Empty
      expect(validatePhoneNumber('123')).toBe(false); // Very short
    });

    it('should reject phone numbers with invalid characters', () => {
      expect(validatePhoneNumber('123-456-789a')).toBe(false); // Contains letter
      expect(validatePhoneNumber('123-456-789!')).toBe(false); // Contains special char
      expect(validatePhoneNumber('123.456.7890')).toBe(false); // Dots not allowed
      expect(validatePhoneNumber('123/456/7890')).toBe(false); // Slashes not allowed
    });

    it('should handle edge cases', () => {
      expect(validatePhoneNumber('1234567890123456')).toBe(true); // Very long but valid chars
      expect(validatePhoneNumber('+() - ')).toBe(false); // Only special chars, no digits
      expect(validatePhoneNumber('++1234567890')).toBe(false); // Multiple plus signs not allowed by regex
      expect(validatePhoneNumber('()()1234567890')).toBe(true); // Multiple parentheses allowed
    });

    it('should accept international formats', () => {
      expect(validatePhoneNumber('+44 20 7946 0958')).toBe(true); // UK
      expect(validatePhoneNumber('+33 1 42 86 83 26')).toBe(true); // France
      expect(validatePhoneNumber('+81-3-3234-5678')).toBe(true); // Japan
    });

    it('should handle minimum length requirement', () => {
      expect(validatePhoneNumber('1234567890')).toBe(true); // Exactly 10 digits
      expect(validatePhoneNumber('123456789')).toBe(false); // 9 digits (too short)
      expect(validatePhoneNumber('+1234567890')).toBe(true); // 10 digits + plus (valid)
    });
  });
}); 