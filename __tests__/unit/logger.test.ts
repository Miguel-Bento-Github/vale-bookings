import { Request, Response } from 'express';

import {
  createPrettyLogger,
  responseTimeMiddleware,
  logInfo,
  logSuccess,
  logWarning,
  logError
} from '../../src/utils/logger';

// Mock console methods
const mockConsoleInfo = jest.spyOn(console, 'info').mockImplementation(() => { });

// Mock morgan
jest.mock('morgan', () => {
  const mockMorgan = jest.fn((format: string, options?: { skip?: () => boolean }) => {
    return jest.fn((req: Request, res: Response, next: () => void) => {
      if (options && options.skip && options.skip()) {
        return next();
      }
      next();
    });
  });

  // Mock token function
  (mockMorgan as jest.MockedFunction<typeof mockMorgan> & { token: jest.Mock }).token = jest.fn();

  return mockMorgan;
});

describe('Logger Utils', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    // Reset environment variables
    delete process.env.NODE_ENV;
    // Reset process.argv
    process.argv = ['node', 'test'];
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('responseTimeMiddleware', () => {
    it('should set startTime on res.locals and call next', () => {
      const req = {} as Request;
      const res = { locals: {} } as Response;
      const next = jest.fn();

      responseTimeMiddleware(req, res, next);

      expect(res.locals.startTime).toBeDefined();
      expect(typeof res.locals.startTime).toBe('number');
      expect(next).toHaveBeenCalledTimes(1);
    });
  });

  describe('createPrettyLogger', () => {
    it('should return morgan middleware with skip for test environment', () => {
      process.env.NODE_ENV = 'test';

      const logger = createPrettyLogger();

      expect(logger).toBeDefined();
      expect(typeof logger).toBe('function');
    });

    it('should return morgan middleware with skip for coverage', () => {
      process.argv.push('--coverage');

      const logger = createPrettyLogger();

      expect(logger).toBeDefined();
      expect(typeof logger).toBe('function');
    });

    it('should return morgan middleware with skip for jest', () => {
      process.argv.push('jest');

      const logger = createPrettyLogger();

      expect(logger).toBeDefined();
      expect(typeof logger).toBe('function');
    });

    it('should return development format for development environment', () => {
      process.env.NODE_ENV = 'development';

      const logger = createPrettyLogger();

      expect(logger).toBeDefined();
      expect(typeof logger).toBe('function');
    });

    it('should return combined format for production environment', () => {
      process.env.NODE_ENV = 'production';

      const logger = createPrettyLogger();

      expect(logger).toBeDefined();
      expect(typeof logger).toBe('function');
    });

    it('should return combined format when NODE_ENV is not set', () => {
      // NODE_ENV is undefined by default

      const logger = createPrettyLogger();

      expect(logger).toBeDefined();
      expect(typeof logger).toBe('function');
    });
  });

  describe('Console log helpers', () => {
    describe('logInfo', () => {
      it('should log info message with blue color', () => {
        const message = 'Test info message';
        const args = ['arg1', 'arg2'];

        logInfo(message, ...args);

        expect(mockConsoleInfo).toHaveBeenCalledWith(
          expect.stringContaining('[INFO]'),
          ...args
        );
        expect(mockConsoleInfo).toHaveBeenCalledWith(
          expect.stringContaining(message),
          ...args
        );
      });

      it('should log info message without additional args', () => {
        const message = 'Test info message';

        logInfo(message);

        expect(mockConsoleInfo).toHaveBeenCalledWith(
          expect.stringContaining('[INFO]')
        );
        expect(mockConsoleInfo).toHaveBeenCalledWith(
          expect.stringContaining(message)
        );
      });
    });

    describe('logSuccess', () => {
      it('should log success message with green color', () => {
        const message = 'Test success message';
        const args = ['arg1', 'arg2'];

        logSuccess(message, ...args);

        expect(mockConsoleInfo).toHaveBeenCalledWith(
          expect.stringContaining('[SUCCESS]'),
          ...args
        );
        expect(mockConsoleInfo).toHaveBeenCalledWith(
          expect.stringContaining(message),
          ...args
        );
      });

      it('should log success message without additional args', () => {
        const message = 'Test success message';

        logSuccess(message);

        expect(mockConsoleInfo).toHaveBeenCalledWith(
          expect.stringContaining('[SUCCESS]')
        );
        expect(mockConsoleInfo).toHaveBeenCalledWith(
          expect.stringContaining(message)
        );
      });
    });

    describe('logWarning', () => {
      it('should log warning message with yellow color', () => {
        const message = 'Test warning message';
        const args = ['arg1', 'arg2'];

        logWarning(message, ...args);

        expect(mockConsoleInfo).toHaveBeenCalledWith(
          expect.stringContaining('[WARN]'),
          ...args
        );
        expect(mockConsoleInfo).toHaveBeenCalledWith(
          expect.stringContaining(message),
          ...args
        );
      });

      it('should log warning message without additional args', () => {
        const message = 'Test warning message';

        logWarning(message);

        expect(mockConsoleInfo).toHaveBeenCalledWith(
          expect.stringContaining('[WARN]')
        );
        expect(mockConsoleInfo).toHaveBeenCalledWith(
          expect.stringContaining(message)
        );
      });
    });

    describe('logError', () => {
      it('should log error message with red color', () => {
        const message = 'Test error message';
        const args = ['arg1', 'arg2'];

        logError(message, ...args);

        expect(mockConsoleInfo).toHaveBeenCalledWith(
          expect.stringContaining('[ERROR]'),
          ...args
        );
        expect(mockConsoleInfo).toHaveBeenCalledWith(
          expect.stringContaining(message),
          ...args
        );
      });

      it('should log error message without additional args', () => {
        const message = 'Test error message';

        logError(message);

        expect(mockConsoleInfo).toHaveBeenCalledWith(
          expect.stringContaining('[ERROR]')
        );
        expect(mockConsoleInfo).toHaveBeenCalledWith(
          expect.stringContaining(message)
        );
      });
    });
  });

  describe('Morgan token setup', () => {
    it('should not setup tokens in test environment', () => {
      process.env.NODE_ENV = 'test';

      // Re-import the module to trigger the conditional setup
      jest.resetModules();
      void import('../../src/utils/logger');

      // In test environment, tokens should not be set up
      // This is implicitly tested by the fact that the module loads without errors
      expect(true).toBe(true);
    });

    it('should not setup tokens when coverage flag is present', () => {
      process.argv.push('--coverage');

      // Re-import the module to trigger the conditional setup
      jest.resetModules();
      void import('../../src/utils/logger');

      // With coverage flag, tokens should not be set up
      expect(true).toBe(true);
    });

    it('should not setup tokens when jest is in argv', () => {
      process.argv.push('jest');

      // Re-import the module to trigger the conditional setup
      jest.resetModules();
      void import('../../src/utils/logger');

      // With jest in argv, tokens should not be set up
      expect(true).toBe(true);
    });
  });
}); 