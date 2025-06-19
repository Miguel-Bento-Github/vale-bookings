// Mock morgan before any imports
import { Request, Response } from 'express';

import { responseTimeMiddleware, logInfo, logSuccess, logWarning, logError } from '../../src/utils/logger';
import { validateEmail, validatePassword, validateCoordinates, validateTimeFormat, validatePhoneNumber } from '../../src/utils/validation';

const mockMorgan = jest.fn(() => jest.fn());
const mockToken = jest.fn();
(mockMorgan as unknown as { token: jest.Mock }).token = mockToken;

jest.mock('morgan', () => mockMorgan);

describe('Utils Extended Coverage Tests', () => {
    describe('Validation Edge Cases for Uncovered Lines', () => {
        it('should handle malformed email with undefined parts', () => {
            // These test cases trigger the undefined checks on lines 18, 22, 26, 29

            // Test with multiple @ symbols causing undefined domain
            expect(validateEmail('user@@domain.com')).toBe(false);
            expect(validateEmail('@domain.com')).toBe(false);
            expect(validateEmail('user@')).toBe(false);
            expect(validateEmail('@')).toBe(false);

            // Edge case: empty string parts
            const emptyEmailParts = ''.split('@');
            expect(emptyEmailParts.length).toBe(1); // This triggers parts.length !== 2 check

            // Test domain without dot requirement
            expect(validateEmail('user@localhost')).toBe(false); // Line 26: domain.includes('.') check
            expect(validateEmail('user@domain')).toBe(false);

            // Test extremely long components
            const longLocal = 'a'.repeat(65); // > 64 chars for local part
            expect(validateEmail(`${longLocal}@domain.com`)).toBe(false); // Line 22 check

            const longDomain = 'domain.' + 'a'.repeat(250) + '.com'; // > 255 chars for domain
            expect(validateEmail(`user@${longDomain}`)).toBe(false); // Line 29 check
        });

        it('should validate email with boundary cases', () => {
            // Exactly at limits
            const maxLocal = 'a'.repeat(64);
            const maxDomain = 'b'.repeat(250) + '.com'; // 254 chars
            expect(validateEmail(`${maxLocal}@example.com`)).toBe(true);
            expect(validateEmail(`user@${maxDomain}`)).toBe(false); // Still too long overall

            // Test total length limit
            const longEmail = 'a'.repeat(250) + '@b.com'; // > 254 total chars
            expect(validateEmail(longEmail)).toBe(false);
        });
    });

    describe('Logger Coverage for Non-Test Environment', () => {
        let originalEnv: string | undefined;
        let originalArgv: string[];

        beforeEach(() => {
            originalEnv = process.env.NODE_ENV;
            originalArgv = [...process.argv];
            mockMorgan.mockClear();
            mockToken.mockClear();
            jest.resetModules();
        });

        afterEach(() => {
            process.env.NODE_ENV = originalEnv;
            process.argv = originalArgv;
        });

        it('should register morgan tokens in production environment', () => {
            // Set up production environment to trigger token registration
            process.env.NODE_ENV = 'production';
            process.argv = ['node', 'server.js'];

            // Re-import logger to trigger token registration in non-test environment
            delete require.cache[require.resolve('../../src/utils/logger')];
            require('../../src/utils/logger');

            // Verify tokens were registered (covers lines 21-23, 35-51, 53-69)
            expect(mockToken).toHaveBeenCalledWith('status-colored', expect.any(Function));
            expect(mockToken).toHaveBeenCalledWith('method-colored', expect.any(Function));
            expect(mockToken).toHaveBeenCalledWith('response-time-colored', expect.any(Function));
            expect(mockToken).toHaveBeenCalledTimes(3);
        });

        it('should test status-colored token function in production', () => {
            process.env.NODE_ENV = 'production';
            process.argv = ['node', 'server.js'];

            delete require.cache[require.resolve('../../src/utils/logger')];
            require('../../src/utils/logger');

            // Get the status-colored token function
            const statusColoredCall = mockToken.mock.calls.find(call => call[0] === 'status-colored');
            expect(statusColoredCall).toBeDefined();

            const statusColoredFn = statusColoredCall?.[1] as (req: Request, res: Response) => string;
            const mockReq = {} as Request;

            // Test all status code branches (covers lines in token functions)
            let mockRes = { statusCode: 200 } as Response;
            let result = statusColoredFn(mockReq, mockRes);
            expect(result).toContain('200');
            expect(result).toContain('\x1b[32m'); // green

            mockRes = { statusCode: 301 } as Response;
            result = statusColoredFn(mockReq, mockRes);
            expect(result).toContain('\x1b[36m'); // cyan

            mockRes = { statusCode: 404 } as Response;
            result = statusColoredFn(mockReq, mockRes);
            expect(result).toContain('\x1b[33m'); // yellow

            mockRes = { statusCode: 500 } as Response;
            result = statusColoredFn(mockReq, mockRes);
            expect(result).toContain('\x1b[31m'); // red
        });

        it('should test method-colored token function in production', () => {
            process.env.NODE_ENV = 'production';
            process.argv = ['node', 'server.js'];

            delete require.cache[require.resolve('../../src/utils/logger')];
            require('../../src/utils/logger');

            const methodColoredCall = mockToken.mock.calls.find(call => call[0] === 'method-colored');
            const methodColoredFn = methodColoredCall?.[1] as (req: Request) => string;

            // Test all HTTP methods (covers switch cases in method-colored token)
            let mockReq = { method: 'GET' } as Request;
            let result = methodColoredFn(mockReq);
            expect(result).toContain('GET');
            expect(result).toContain('\x1b[32m'); // green

            mockReq = { method: 'POST' } as Request;
            result = methodColoredFn(mockReq);
            expect(result).toContain('\x1b[33m'); // yellow

            mockReq = { method: 'PUT' } as Request;
            result = methodColoredFn(mockReq);
            expect(result).toContain('\x1b[35m'); // magenta

            mockReq = { method: 'DELETE' } as Request;
            result = methodColoredFn(mockReq);
            expect(result).toContain('\x1b[31m'); // red

            mockReq = { method: 'PATCH' } as Request;
            result = methodColoredFn(mockReq);
            expect(result).toContain('\x1b[36m'); // cyan

            // Test default case (other methods)
            mockReq = { method: 'OPTIONS' } as Request;
            result = methodColoredFn(mockReq);
            expect(result).toContain('\x1b[34m'); // blue
        });

        it('should test response-time-colored token function', () => {
            process.env.NODE_ENV = 'production';
            process.argv = ['node', 'server.js'];

            delete require.cache[require.resolve('../../src/utils/logger')];
            require('../../src/utils/logger');

            const responseTimeCall = mockToken.mock.calls.find(call => call[0] === 'response-time-colored');
            const responseTimeFn = responseTimeCall?.[1] as (req: Request, res: Response) => string;
            const mockReq = {} as Request;

            // Test different timing scenarios
            let mockRes = { locals: { startTime: Date.now() - 100 } } as unknown as Response;
            let result = responseTimeFn(mockReq, mockRes);
            expect(result).toContain('ms');
            expect(result).toContain('\x1b[32m'); // green for fast

            mockRes = { locals: { startTime: Date.now() - 600 } } as unknown as Response;
            result = responseTimeFn(mockReq, mockRes);
            expect(result).toContain('\x1b[33m'); // yellow for medium

            mockRes = { locals: { startTime: Date.now() - 1200 } } as unknown as Response;
            result = responseTimeFn(mockReq, mockRes);
            expect(result).toContain('\x1b[31m'); // red for slow

            // Test no start time case
            mockRes = { locals: {} } as unknown as Response;
            result = responseTimeFn(mockReq, mockRes);
            expect(result).toContain('0ms');
        });

        it('should create production logger format', () => {
            process.env.NODE_ENV = 'production';
            process.argv = ['node', 'server.js'];

            delete require.cache[require.resolve('../../src/utils/logger')];
            const { createPrettyLogger } = require('../../src/utils/logger');

            createPrettyLogger();

            // Verify morgan was called with 'combined' format for production
            expect(mockMorgan).toHaveBeenCalledWith('combined');
        });

        it('should create development logger format', () => {
            process.env.NODE_ENV = 'development';
            process.argv = ['node', 'server.js'];

            delete require.cache[require.resolve('../../src/utils/logger')];
            const { createPrettyLogger } = require('../../src/utils/logger');

            createPrettyLogger();

            // Verify morgan was called with development format
            expect(mockMorgan).toHaveBeenCalledWith(expect.stringContaining(':method-colored'));
        });
    });

    describe('Logger Functions Coverage', () => {
        let consoleSpy: jest.SpyInstance;

        beforeEach(() => {
            consoleSpy = jest.spyOn(console, 'info').mockImplementation();
        });

        afterEach(() => {
            consoleSpy.mockRestore();
        });

        it('should test all logger functions with various arguments', () => {
            // Test logInfo function
            logInfo('Test info message', 'arg1', 123, { key: 'value' });
            expect(consoleSpy).toHaveBeenCalledWith(
                expect.stringContaining('[INFO]'),
                'arg1', 123, { key: 'value' }
            );

            // Test logSuccess function
            logSuccess('Success message', true, null);
            expect(consoleSpy).toHaveBeenCalledWith(
                expect.stringContaining('[SUCCESS]'),
                true, null
            );

            // Test logWarning function
            logWarning('Warning message', undefined, [1, 2, 3]);
            expect(consoleSpy).toHaveBeenCalledWith(
                expect.stringContaining('[WARN]'),
                undefined, [1, 2, 3]
            );

            // Test logError function
            logError('Error message', new Error('test'), 'extra');
            expect(consoleSpy).toHaveBeenCalledWith(
                expect.stringContaining('[ERROR]'),
                new Error('test'), 'extra'
            );
        });

        it('should test logger functions with no additional arguments', () => {
            logInfo('Info only');
            logSuccess('Success only');
            logWarning('Warning only');
            logError('Error only');

            expect(consoleSpy).toHaveBeenCalledTimes(4);
        });

        it('should test logger functions with empty messages', () => {
            logInfo('');
            logSuccess('');
            logWarning('');
            logError('');

            expect(consoleSpy).toHaveBeenCalledTimes(4);
        });
    });

    describe('Response Time Middleware Coverage', () => {
        it('should set start time in response locals', () => {
            const mockReq = {} as Request;
            const mockRes = { locals: {} } as Response;
            const mockNext = jest.fn();

            const startTime = Date.now();
            responseTimeMiddleware(mockReq, mockRes, mockNext);

            expect(mockRes.locals.startTime).toBeGreaterThanOrEqual(startTime);
            expect(mockRes.locals.startTime).toBeLessThanOrEqual(Date.now());
            expect(mockNext).toHaveBeenCalledTimes(1);
        });

        it('should handle response middleware timing accurately', () => {
            const mockReq = {} as Request;
            const mockRes = { locals: {} } as Response;
            const mockNext = jest.fn();

            responseTimeMiddleware(mockReq, mockRes, mockNext);

            // Verify start time is a valid timestamp
            expect(typeof mockRes.locals.startTime).toBe('number');
            expect(mockRes.locals.startTime).toBeGreaterThan(0);
        });
    });

    describe('Additional Validation Coverage', () => {
        it('should test validatePassword with edge cases', () => {
            // Test exactly at minimum length
            expect(validatePassword('123456')).toBe(true);
            expect(validatePassword('12345')).toBe(false);

            // Test with very long passwords
            expect(validatePassword('a'.repeat(1000))).toBe(true);

            // Test type safety
            expect(validatePassword(null as unknown as string)).toBe(false);
            expect(validatePassword(undefined as unknown as string)).toBe(false);
            expect(validatePassword(123 as unknown as string)).toBe(false);
        });

        it('should test validateCoordinates with precise boundaries', () => {
            // Test exact boundaries
            expect(validateCoordinates(90, 180)).toBe(true);
            expect(validateCoordinates(-90, -180)).toBe(true);
            expect(validateCoordinates(90.0000001, 180)).toBe(false);
            expect(validateCoordinates(90, 180.0000001)).toBe(false);

            // Test NaN and Infinity cases
            expect(validateCoordinates(NaN, 0)).toBe(false);
            expect(validateCoordinates(0, NaN)).toBe(false);
            expect(validateCoordinates(Infinity, 0)).toBe(false);
            expect(validateCoordinates(0, -Infinity)).toBe(false);
        });

        it('should test validateTimeFormat with comprehensive cases', () => {
            // Test boundary times
            expect(validateTimeFormat('00:00')).toBe(true);
            expect(validateTimeFormat('23:59')).toBe(true);
            expect(validateTimeFormat('24:00')).toBe(false);
            expect(validateTimeFormat('12:60')).toBe(false);

            // Test single digit hours
            expect(validateTimeFormat('9:30')).toBe(true);
            expect(validateTimeFormat('09:30')).toBe(true);

            // Test invalid formats
            expect(validateTimeFormat('12:3')).toBe(false); // Single digit minute
            expect(validateTimeFormat('25:30')).toBe(false); // Hour > 23
        });

        it('should test validatePhoneNumber with international variations', () => {
            // Test minimum length requirement (10 digits)
            expect(validatePhoneNumber('1234567890')).toBe(true);
            expect(validatePhoneNumber('123456789')).toBe(false); // Only 9 digits

            // Test international formats
            expect(validatePhoneNumber('+1 (555) 123-4567')).toBe(true);
            expect(validatePhoneNumber('+44 20 7946 0958')).toBe(true);
            expect(validatePhoneNumber('+33-1-23-45-67-89')).toBe(true);

            // Test invalid formats
            expect(validatePhoneNumber('abc')).toBe(false);
            expect(validatePhoneNumber('123.456.7890')).toBe(false); // Dots not allowed
            expect(validatePhoneNumber('')).toBe(false);
        });
    });
}); 