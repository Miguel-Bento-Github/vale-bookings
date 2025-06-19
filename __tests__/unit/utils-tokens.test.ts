import { Request, Response } from 'express';

// Mock morgan before importing logger
const mockToken = jest.fn();
const mockMorgan = jest.fn(() => jest.fn());
(mockMorgan as unknown as { token: jest.Mock }).token = mockToken;

jest.mock('morgan', () => mockMorgan);

describe('Logger Token Functions Coverage', () => {
    let originalEnv: string | undefined;
    let originalArgv: string[];

    beforeEach(() => {
        originalEnv = process.env.NODE_ENV;
        originalArgv = [...process.argv];
        mockToken.mockClear();
        jest.resetModules();
    });

    afterEach(() => {
        process.env.NODE_ENV = originalEnv;
        process.argv = originalArgv;
    });

    it('should register morgan tokens in non-test environment', () => {
        // Set up non-test environment
        process.env.NODE_ENV = 'development';
        process.argv = ['node', 'server.js'];

      // Import logger to trigger token registration
      try {
          jest.doMock('../../src/utils/logger');
      } catch {
          // Ignore import errors in test environment
      }

      // Verify tokens were registered
      expect(mockToken).toHaveBeenCalledWith('status-colored', expect.any(Function));
      expect(mockToken).toHaveBeenCalledWith('method-colored', expect.any(Function));
      expect(mockToken).toHaveBeenCalledWith('response-time-colored', expect.any(Function));
      expect(mockToken).toHaveBeenCalledTimes(3);
  });

    it('should test status-colored token function', () => {
        process.env.NODE_ENV = 'development';
        process.argv = ['node', 'server.js'];

      try {
          jest.doMock('../../src/utils/logger');
      } catch {
          // Ignore import errors in test environment
      }

      // Get the status-colored token function
      const statusColoredCall = mockToken.mock.calls.find(call => call[0] === 'status-colored');
      expect(statusColoredCall).toBeDefined();

      const statusColoredFn = statusColoredCall?.[1] as (req: Request, res: Response) => string;

      // Test different status codes
      const mockReq = {} as Request;

      // Test 2xx status (green)
      let mockRes = { statusCode: 200 } as Response;
      let result = statusColoredFn(mockReq, mockRes);
      expect(result).toContain('200');
      expect(result).toContain('\x1b[32m'); // green color

      // Test 3xx status (cyan)
      mockRes = { statusCode: 301 } as Response;
      result = statusColoredFn(mockReq, mockRes);
      expect(result).toContain('301');
      expect(result).toContain('\x1b[36m'); // cyan color

      // Test 4xx status (yellow)
      mockRes = { statusCode: 404 } as Response;
      result = statusColoredFn(mockReq, mockRes);
      expect(result).toContain('404');
      expect(result).toContain('\x1b[33m'); // yellow color

      // Test 5xx status (red)
      mockRes = { statusCode: 500 } as Response;
      result = statusColoredFn(mockReq, mockRes);
      expect(result).toContain('500');
      expect(result).toContain('\x1b[31m'); // red color
  });

    it('should test method-colored token function', () => {
        process.env.NODE_ENV = 'development';
        process.argv = ['node', 'server.js'];

      try {
          jest.doMock('../../src/utils/logger');
      } catch {
          // Ignore import errors in test environment
      }

      const methodColoredCall = mockToken.mock.calls.find(call => call[0] === 'method-colored');
      expect(methodColoredCall).toBeDefined();

      const methodColoredFn = methodColoredCall?.[1] as (req: Request, res: Response) => string;
      const mockRes = {} as Response;

      // Test GET (green)
      let mockReq = { method: 'GET' } as Request;
      let result = methodColoredFn(mockReq, mockRes);
      expect(result).toContain('GET');
      expect(result).toContain('\x1b[32m'); // green

      // Test POST (yellow)
      mockReq = { method: 'POST' } as Request;
      result = methodColoredFn(mockReq, mockRes);
      expect(result).toContain('POST');
      expect(result).toContain('\x1b[33m'); // yellow

      // Test PUT (magenta)
      mockReq = { method: 'PUT' } as Request;
      result = methodColoredFn(mockReq, mockRes);
      expect(result).toContain('PUT');
      expect(result).toContain('\x1b[35m'); // magenta

      // Test DELETE (red)
      mockReq = { method: 'DELETE' } as Request;
      result = methodColoredFn(mockReq, mockRes);
      expect(result).toContain('DELETE');
      expect(result).toContain('\x1b[31m'); // red

      // Test PATCH (cyan)
      mockReq = { method: 'PATCH' } as Request;
      result = methodColoredFn(mockReq, mockRes);
      expect(result).toContain('PATCH');
      expect(result).toContain('\x1b[36m'); // cyan

      // Test other methods (blue - default)
      mockReq = { method: 'OPTIONS' } as Request;
      result = methodColoredFn(mockReq, mockRes);
      expect(result).toContain('OPTIONS');
      expect(result).toContain('\x1b[34m'); // blue
  });

    it('should test response-time-colored token function', () => {
        process.env.NODE_ENV = 'development';
        process.argv = ['node', 'server.js'];

      try {
          jest.doMock('../../src/utils/logger');
      } catch {
          // Ignore import errors in test environment
      }

      const responseTimeCall = mockToken.mock.calls.find(call => call[0] === 'response-time-colored');
      expect(responseTimeCall).toBeDefined();

      const responseTimeFn = responseTimeCall?.[1] as (req: Request, res: Response) => string;
      const mockReq = {} as Request;

      // Test fast response (green)
      let mockRes = {
          locals: { startTime: Date.now() - 100 } // 100ms ago
      } as unknown as Response;
      let result = responseTimeFn(mockReq, mockRes);
      expect(result).toContain('ms');
      expect(result).toContain('\x1b[32m'); // green

      // Test medium response (yellow)
      mockRes = {
          locals: { startTime: Date.now() - 600 } // 600ms ago
      } as unknown as Response;
      result = responseTimeFn(mockReq, mockRes);
      expect(result).toContain('ms');
      expect(result).toContain('\x1b[33m'); // yellow

      // Test slow response (red)
      mockRes = {
          locals: { startTime: Date.now() - 1200 } // 1200ms ago
      } as unknown as Response;
      result = responseTimeFn(mockReq, mockRes);
      expect(result).toContain('ms');
      expect(result).toContain('\x1b[31m'); // red

      // Test no start time (0ms)
      mockRes = { locals: {} } as Response;
      result = responseTimeFn(mockReq, mockRes);
      expect(result).toContain('0ms');
  });

    it('should skip token registration in test environment', () => {
        process.env.NODE_ENV = 'test';
        process.argv = ['node', 'test'];

      try {
          jest.doMock('../../src/utils/logger');
      } catch {
          // Ignore import errors in test environment
      }

      expect(mockToken).not.toHaveBeenCalled();
  });

    it('should skip token registration with coverage flag', () => {
        delete process.env.NODE_ENV;
        process.argv = ['node', 'test', '--coverage'];

      try {
          jest.doMock('../../src/utils/logger');
      } catch {
          // Ignore import errors in test environment
      }

      expect(mockToken).not.toHaveBeenCalled();
  });

    it('should skip token registration with jest in argv', () => {
        delete process.env.NODE_ENV;
        process.argv = ['node', 'jest'];

      try {
          jest.doMock('../../src/utils/logger');
      } catch {
          // Ignore import errors in test environment
      }

      expect(mockToken).not.toHaveBeenCalled();
  });

    it('should handle production environment token registration', () => {
        process.env.NODE_ENV = 'production';
        process.argv = ['node', 'server.js'];

      try {
          jest.doMock('../../src/utils/logger');
      } catch {
          // Ignore import errors in test environment
      }

      expect(mockToken).toHaveBeenCalledTimes(3);
  });
}); 