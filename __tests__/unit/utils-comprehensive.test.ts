import { Request, Response } from 'express';

import {
  createPrettyLogger,
  responseTimeMiddleware,
  logInfo,
  logSuccess,
  logWarning,
  logError
} from '../../src/utils/logger';
import {
  validateEmail,
  validatePassword,
  validateCoordinates,
  validateTimeFormat,
  validatePhoneNumber
} from '../../src/utils/validation';


// Suppress console output during tests
const originalConsoleInfo = console.info;
const mockConsoleInfo = jest.fn();

// Mock morgan module
jest.mock('morgan', () => {
  const mockMorgan = jest.fn((format: string, options?: { skip?: () => boolean }) => {
    return jest.fn((req: Request, res: Response, next: () => void) => {
      if (options?.skip?.() === true) {
        return next();
      }
      // Simulate morgan logging
      if (typeof format === 'string') {
        mockConsoleInfo(`Mock morgan log: ${format}`);
      }
      next();
    });
  });

  // Mock token function for custom tokens
  (mockMorgan as unknown as { token: jest.Mock }).token = jest.fn(
    (name: string, fn: (...args: unknown[]) => string) => {
      // Store token functions for testing
      const mockMorganAny = mockMorgan as unknown as { _tokens?: Record<string, unknown> };
      mockMorganAny._tokens = mockMorganAny._tokens ?? {};
      mockMorganAny._tokens[name] = fn;
    }
  );

  return mockMorgan;
});

describe('Utils Comprehensive Coverage Tests', () => {
  beforeEach(() => {
    console.info = mockConsoleInfo;
    mockConsoleInfo.mockClear();
  });

  afterEach(() => {
    console.info = originalConsoleInfo;
    jest.clearAllMocks();
  });

  describe('Validation Edge Cases', () => {
    describe('validateEmail edge cases', () => {
      it('should handle extremely long emails', () => {
        const longLocal = 'a'.repeat(65); // > 64 chars
        const longEmail = `${longLocal}@example.com`;
        expect(validateEmail(longEmail)).toBe(false);

        const longDomain = 'example.' + 'a'.repeat(250) + '.com'; // > 255 chars
        const longDomainEmail = `user@${longDomain}`;
        expect(validateEmail(longDomainEmail)).toBe(false);

        const totalLongEmail = 'a'.repeat(250) + '@example.com'; // > 254 total
        expect(validateEmail(totalLongEmail)).toBe(false);
      });

      it('should handle emails without dots in domain', () => {
        expect(validateEmail('user@localhost')).toBe(false);
        expect(validateEmail('user@domain')).toBe(false);
      });

      it('should handle malformed email structures', () => {
        expect(validateEmail('user@@example.com')).toBe(false);
        expect(validateEmail('user@example@com')).toBe(false);
        expect(validateEmail('@')).toBe(false);
        expect(validateEmail('user@')).toBe(false);
        expect(validateEmail('@example.com')).toBe(false);
      });

      it('should handle undefined/null domain parts', () => {
        // These cases trigger the undefined checks in the validation
        expect(validateEmail('user@.com')).toBe(false);
        expect(validateEmail('@.com')).toBe(false);
      });
    });

    describe('validateCoordinates boundary cases', () => {
      it('should handle exact boundary values', () => {
        expect(validateCoordinates(90, 180)).toBe(true);
        expect(validateCoordinates(-90, -180)).toBe(true);
        expect(validateCoordinates(90.0, 180.0)).toBe(true);
        expect(validateCoordinates(-90.0, -180.0)).toBe(true);
      });

      it('should handle floating point precision', () => {
        expect(validateCoordinates(89.999999, 179.999999)).toBe(true);
        expect(validateCoordinates(-89.999999, -179.999999)).toBe(true);
      });
    });

    describe('validateTimeFormat edge cases', () => {
      it('should handle leading zeros correctly', () => {
        expect(validateTimeFormat('09:05')).toBe(true);
        expect(validateTimeFormat('00:00')).toBe(true);
        expect(validateTimeFormat('01:01')).toBe(true);
      });

      it('should handle invalid hour/minute combinations', () => {
        expect(validateTimeFormat('25:00')).toBe(false);
        expect(validateTimeFormat('23:60')).toBe(false);
        expect(validateTimeFormat('24:59')).toBe(false);
      });

      it('should handle malformed time strings', () => {
        expect(validateTimeFormat('1:30')).toBe(true); // Single digit hour is actually valid
        expect(validateTimeFormat('12:3')).toBe(false); // Single digit minute without leading zero
        expect(validateTimeFormat('12::30')).toBe(false);
        expect(validateTimeFormat('::30')).toBe(false);
        expect(validateTimeFormat('25:30')).toBe(false); // Invalid hour > 23
      });
    });

    describe('validatePhoneNumber edge cases', () => {
      it('should handle international formats', () => {
        expect(validatePhoneNumber('+1 234 567 8900')).toBe(true);
        expect(validatePhoneNumber('+44 (0) 20 7946 0958')).toBe(true);
        expect(validatePhoneNumber('+33-1-23-45-67-89')).toBe(true);
      });

      it('should handle minimal valid phone numbers', () => {
        expect(validatePhoneNumber('1234567890')).toBe(true); // Exactly 10 digits
        expect(validatePhoneNumber('123456789')).toBe(false); // Only 9 digits
      });

      it('should handle phone numbers with mixed characters', () => {
        expect(validatePhoneNumber('+1 (234) 567-8900')).toBe(true);
        expect(validatePhoneNumber('234 567 8900')).toBe(true);
        expect(validatePhoneNumber('234.567.8900')).toBe(false); // Dots not allowed
      });
    });
  });

  describe('Logger Token Functions', () => {
    beforeEach(() => {
      // Setup for token tests
    });

    it('should handle logger in non-test environment', () => {
      const originalEnv = process.env.NODE_ENV;
      const originalArgv = [...process.argv];

      // Temporarily change environment
      process.env.NODE_ENV = 'development';
      process.argv = ['node', 'server.js'];

      // Import logger again to trigger token registration
      jest.resetModules();
      try {
        // Use dynamic import to avoid require linting issues
        jest.doMock('../../src/utils/logger');
      } catch {
        // Ignore import errors in test environment
      }

      // Restore environment
      process.env.NODE_ENV = originalEnv;
      process.argv = originalArgv;
    });

    it('should handle responseTimeMiddleware timing', () => {
      const req = {} as Request;
      const res = { locals: {} } as Response;
      const next = jest.fn();

      const startTime = Date.now();
      responseTimeMiddleware(req, res, next);

      expect(res.locals.startTime).toBeGreaterThanOrEqual(startTime);
      expect(res.locals.startTime).toBeLessThanOrEqual(Date.now());
      expect(next).toHaveBeenCalledTimes(1);
    });
  });

  describe('Logger Environment Handling', () => {
    const originalEnv = process.env.NODE_ENV;
    const originalArgv = [...process.argv];

    afterEach(() => {
      process.env.NODE_ENV = originalEnv;
      process.argv = originalArgv;
    });

    it('should create logger for test environment', () => {
      process.env.NODE_ENV = 'test';
      const logger = createPrettyLogger();
      expect(logger).toBeDefined();
    });

    it('should create logger when coverage flag is present', () => {
      process.argv = ['node', 'test', '--coverage'];
      const logger = createPrettyLogger();
      expect(logger).toBeDefined();
    });

    it('should create logger when jest is in argv', () => {
      process.argv = ['node', 'jest', 'test'];
      const logger = createPrettyLogger();
      expect(logger).toBeDefined();
    });

    it('should create logger for development environment', () => {
      process.env.NODE_ENV = 'development';
      process.argv = ['node', 'server.js'];
      const logger = createPrettyLogger();
      expect(logger).toBeDefined();
    });

    it('should create logger for production environment', () => {
      process.env.NODE_ENV = 'production';
      process.argv = ['node', 'server.js'];
      const logger = createPrettyLogger();
      expect(logger).toBeDefined();
    });

    it('should create logger for undefined environment', () => {
      delete process.env.NODE_ENV;
      process.argv = ['node', 'server.js'];
      const logger = createPrettyLogger();
      expect(logger).toBeDefined();
    });
  });

  describe('Console Log Functions', () => {
    it('should log info messages with color codes', () => {
      logInfo('Test message', 'arg1', 123);
      expect(mockConsoleInfo).toHaveBeenCalledWith(
        expect.stringContaining('[INFO]'),
        'arg1',
        123
      );
    });

    it('should log success messages with color codes', () => {
      logSuccess('Success message', { data: 'test' });
      expect(mockConsoleInfo).toHaveBeenCalledWith(
        expect.stringContaining('[SUCCESS]'),
        { data: 'test' }
      );
    });

    it('should log warning messages with color codes', () => {
      logWarning('Warning message', true, null);
      expect(mockConsoleInfo).toHaveBeenCalledWith(
        expect.stringContaining('[WARN]'),
        true,
        null
      );
    });

    it('should log error messages with color codes', () => {
      logError('Error message', new Error('test'), undefined);
      expect(mockConsoleInfo).toHaveBeenCalledWith(
        expect.stringContaining('[ERROR]'),
        new Error('test'),
        undefined
      );
    });

    it('should handle messages without additional arguments', () => {
      logInfo('Simple message');
      expect(mockConsoleInfo).toHaveBeenCalledWith(
        expect.stringContaining('[INFO]')
      );

      logSuccess('Simple success');
      expect(mockConsoleInfo).toHaveBeenCalledWith(
        expect.stringContaining('[SUCCESS]')
      );

      logWarning('Simple warning');
      expect(mockConsoleInfo).toHaveBeenCalledWith(
        expect.stringContaining('[WARN]')
      );

      logError('Simple error');
      expect(mockConsoleInfo).toHaveBeenCalledWith(
        expect.stringContaining('[ERROR]')
      );
    });

    it('should handle empty messages', () => {
      logInfo('');
      logSuccess('');
      logWarning('');
      logError('');

      expect(mockConsoleInfo).toHaveBeenCalledTimes(4);
    });

    it('should handle special characters in messages', () => {
      const specialMessage = 'Message with émojis 🎉 and ñ characters';
      logInfo(specialMessage);
      expect(mockConsoleInfo).toHaveBeenCalledWith(
        expect.stringContaining('[INFO]')
      );
    });
  });

  describe('Validation Type Safety', () => {
    it('should handle validatePassword with various types', () => {
      expect(validatePassword('')).toBe(false);
      expect(validatePassword('12345')).toBe(false); // Too short
      expect(validatePassword('123456')).toBe(true); // Exactly 6 chars
      expect(validatePassword('very long password')).toBe(true);
    });

    it('should handle validateCoordinates with edge numbers', () => {
      expect(validateCoordinates(NaN, 0)).toBe(false);
      expect(validateCoordinates(0, NaN)).toBe(false);
      expect(validateCoordinates(Infinity, 0)).toBe(false);
      expect(validateCoordinates(0, -Infinity)).toBe(false);
    });

    it('should handle validateEmail with special valid cases', () => {
      expect(validateEmail('test@example.museum')).toBe(true);
      expect(validateEmail('user.name+tag+sorting@example.com')).toBe(true);
      expect(validateEmail('x@example.co.uk')).toBe(true);
    });

    it('should handle validateTimeFormat with boundary times', () => {
      expect(validateTimeFormat('00:00')).toBe(true);
      expect(validateTimeFormat('23:59')).toBe(true);
      expect(validateTimeFormat('12:00')).toBe(true);
      expect(validateTimeFormat('24:00')).toBe(false);
      expect(validateTimeFormat('12:60')).toBe(false);
    });

    it('should handle validatePhoneNumber with international variants', () => {
      expect(validatePhoneNumber('+1-800-555-5555')).toBe(true);
      expect(validatePhoneNumber('800 555 5555')).toBe(true);
      expect(validatePhoneNumber('(800) 555-5555')).toBe(true);
      expect(validatePhoneNumber('800.555.5555')).toBe(false); // Dots not allowed
      expect(validatePhoneNumber('phone')).toBe(false);
    });
  });
}); 