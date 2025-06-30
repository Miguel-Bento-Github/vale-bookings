// This setup file runs before any tests to disable all rate limiting logic.
import { jest } from '@jest/globals';

// Fully mock RateLimitService *before* it is imported by the application code.
jest.mock('../src/services/RateLimitService', () => {
  // Simple in-memory counter to emulate per-identifier rate limits (global only)
  const counters: Record<string, number> = {};

  const original: Record<string, unknown> = jest.requireActual('../src/services/RateLimitService');

  return {
    __esModule: true,
    // Re-export anything that tests might explicitly import
    ...original,

    // Allow unlimited requests in most cases, but emulate a low global limit of 60/minute
    checkRateLimit: jest.fn(async (identifier: string, config: { maxRequests: number }) => {
      const key = identifier;
      counters[key] = (counters[key] ?? 0) + 1;

      const allowed = counters[key] <= (config?.maxRequests ?? 60);

      return {
        allowed,
        limit: config?.maxRequests ?? 60,
        remaining: Math.max(0, (config?.maxRequests ?? 60) - counters[key]),
        resetAt: new Date(Date.now() + 60000)
      };
    }),

    // No-op middlewares for IP & e-mail specific throttling
    createIPMiddleware: () => (_req: any, _res: any, next: any) => next(),
    createEmailMiddleware: () => (_req: any, _res: any, next: any) => next(),

    // API-key middleware simply calls next() so tests aren't blocked by missing usage bookkeeping
    createApiKeyMiddleware: () => (_req: any, _res: any, next: any) => next(),

    // Mock initialize, close, and other methods
    initialize: jest.fn(() => {}),
    close: jest.fn(async () => {}),
    resetRateLimit: jest.fn(async () => {}),
    getUsage: jest.fn(async () => ({
      used: 0,
      limit: 1000,
      remaining: 1000,
      resetAt: new Date(Date.now() + 60000)
    })),

    // Mock rateLimitService object
    rateLimitService: {
      checkRateLimit: jest.fn(async () => ({
        allowed: true,
        limit: 1000,
        remaining: 1000,
        resetAt: new Date(Date.now() + 60000)
      })),
      createApiKeyMiddleware: () => (_req: any, _res: any, next: any) => next(),
      createIPMiddleware: () => (_req: any, _res: any, next: any) => next(),
      createEmailMiddleware: () => (_req: any, _res: any, next: any) => next(),
      resetRateLimit: jest.fn(async () => {}),
      getUsage: jest.fn(async () => ({
        used: 0,
        limit: 1000,
        remaining: 1000,
        resetAt: new Date(Date.now() + 60000)
      })),
      close: jest.fn(async () => {}),
      initialize: jest.fn(() => {})
    }
  };
});

 