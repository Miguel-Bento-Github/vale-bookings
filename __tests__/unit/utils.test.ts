import { 
  validateEmail, 
  validatePassword, 
  validateCoordinates, 
  validateTimeFormat, 
  validatePhoneNumber 
} from '../../src/utils/validation';

describe('Utility Functions', () => {
  describe('validateEmail', () => {
    it('should return true for valid email addresses', () => {
      const validEmails = [
        'test@example.com',
        'user.name@domain.co.uk',
        'user+tag@example.org',
        'user123@test-domain.com',
        'a@b.co'
      ];

      validEmails.forEach(email => {
        expect(validateEmail(email)).toBe(true);
      });
    });

    it('should return false for invalid email addresses', () => {
      const invalidEmails = [
        'invalid-email',
        '@example.com',
        'user@',
        '',
        'user name@example.com'
      ];

      invalidEmails.forEach(email => {
        expect(validateEmail(email)).toBe(false);
      });
    });
  });

  describe('validatePassword', () => {
    it('should return true for valid passwords', () => {
      const validPasswords = [
        'password123',
        'mypassword',
        'verylongpassword',
        '123456'
      ];

      validPasswords.forEach(password => {
        expect(validatePassword(password)).toBe(true);
      });
    });

    it('should return false for invalid passwords', () => {
      const invalidPasswords = [
        '12345',  // Too short
        '',       // Empty
        'abc'     // Too short
      ];

      invalidPasswords.forEach(password => {
        expect(validatePassword(password)).toBe(false);
      });
    });

    it('should handle non-string inputs', () => {
      expect(validatePassword(null as unknown as string)).toBe(false);
      expect(validatePassword(undefined as unknown as string)).toBe(false);
      expect(validatePassword(123 as unknown as string)).toBe(false);
    });
  });

  describe('validateCoordinates', () => {
    it('should return true for valid coordinates', () => {
      expect(validateCoordinates(40.7128, -74.0060)).toBe(true);  // NYC
      expect(validateCoordinates(0, 0)).toBe(true);               // Equator/Prime Meridian
      expect(validateCoordinates(90, 180)).toBe(true);            // North Pole, Date Line
      expect(validateCoordinates(-90, -180)).toBe(true);          // South Pole, Date Line
    });

    it('should return false for invalid coordinates', () => {
      expect(validateCoordinates(91, 0)).toBe(false);     // Latitude too high
      expect(validateCoordinates(-91, 0)).toBe(false);    // Latitude too low
      expect(validateCoordinates(0, 181)).toBe(false);    // Longitude too high
      expect(validateCoordinates(0, -181)).toBe(false);   // Longitude too low
    });
  });

  describe('validateTimeFormat', () => {
    it('should return true for valid time formats', () => {
      const validTimes = [
        '09:00',
        '23:59',
        '00:00',
        '12:30'
      ];

      validTimes.forEach(time => {
        expect(validateTimeFormat(time)).toBe(true);
      });
    });

    it('should return false for invalid time formats', () => {
      const invalidTimes = [
        '24:00',    // Invalid hour
        '12:60',    // Invalid minute
        'abc',      // Not a time
        '',         // Empty
        '12',       // Missing minute
        '12:',      // Missing minute
        ':30'       // Missing hour
      ];

      invalidTimes.forEach(time => {
        expect(validateTimeFormat(time)).toBe(false);
      });
    });
  });

  describe('validatePhoneNumber', () => {
    it('should return true for valid phone numbers', () => {
      const validPhones = [
        '+1234567890',
        '1234567890',
        '+1 (234) 567-8900',
        '234-567-8900',
        '+44 20 7946 0958'
      ];

      validPhones.forEach(phone => {
        expect(validatePhoneNumber(phone)).toBe(true);
      });
    });

    it('should return false for invalid phone numbers', () => {
      const invalidPhones = [
        '123',        // Too short
        'abc',        // Not a number
        '',           // Empty
        '12345'       // Too short
      ];

      invalidPhones.forEach(phone => {
        expect(validatePhoneNumber(phone)).toBe(false);
      });
    });
  });
}); 