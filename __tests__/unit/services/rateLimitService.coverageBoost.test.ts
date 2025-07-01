import { describe, it, expect, beforeEach, afterAll, jest } from '@jest/globals';
import type { Request, Response, NextFunction } from 'express';
import type Redis from 'ioredis';

import { InMemoryRateLimitStore } from '../../../src/services/InMemoryRateLimitStore';
import type { RateLimitStore, RateLimitPipeline } from '../../../src/services/RateLimitStore';

// Obtain unmocked implementation (cast to actual module type).
type RateLimitModule = typeof import('../../../src/services/RateLimitService');
const realRateLimit = jest.requireActual('../../../src/services/RateLimitService');

const rlInitialize = (realRateLimit as RateLimitModule).initialize;
const rlClose = (realRateLimit as RateLimitModule).close;
const checkRateLimit = (realRateLimit as RateLimitModule).checkRateLimit;
const resetRateLimit = (realRateLimit as RateLimitModule).resetRateLimit;
const getUsage = (realRateLimit as RateLimitModule).getUsage;
const createEmailMiddleware = (realRateLimit as RateLimitModule).createEmailMiddleware;
const createIPMiddleware = (realRateLimit as RateLimitModule).createIPMiddleware;

// Shared config with a very small window so tests run fast.
const config = { windowMs: 1000, maxRequests: 2 };

beforeEach(() => {
  // Re-initialise before every test with a fresh in-memory store.
  const store = new InMemoryRateLimitStore();
  // Attach a no-op quit method so rlClose() succeeds.
  (store as unknown as { quit: () => Promise<void> }).quit = async () => Promise.resolve();
  rlInitialize(store as unknown as Redis);
});

afterAll(async () => {
  try {
    await rlClose();
  } catch {
    // Ignore if underlying store lacked quit
  }
});

describe('RateLimitService – extended coverage', () => {
  it('implements a sliding-window allowing and then rejecting requests', async () => {
    const id = 'cov:sliding';

    // First request ‑ should be allowed.
    const first = await checkRateLimit(id, config);
    expect(first.allowed).toBe(true);
    expect(first.remaining).toBe(1);

    // Second within window ‑ still allowed but at limit.
    const second = await checkRateLimit(id, config);
    expect(second.allowed).toBe(true);
    expect(second.remaining).toBe(0);

    // Third within same window ‑ blocked.
    const third = await checkRateLimit(id, config);
    expect(third.allowed).toBe(false);
    expect(third.retryAfter).toBeGreaterThanOrEqual(0);
  });

  it('resets usage once the time window has elapsed', async () => {
    jest.useFakeTimers({ now: Date.now() });

    const id = 'cov:reset';

    // Exhaust the limit.
    await checkRateLimit(id, config);
    await checkRateLimit(id, config);

    // Advance beyond window to simulate passage of time.
    jest.setSystemTime(Date.now() + config.windowMs + 5);

    const postWindow = await checkRateLimit(id, config);
    expect(postWindow.allowed).toBe(true);

    jest.useRealTimers();
  });

  it('getUsage reflects requests and resetRateLimit clears state', async () => {
    const id = 'cov:usage';
    await checkRateLimit(id, config); // 1
    await checkRateLimit(id, config); // 2

    const usage = await getUsage(id, config);
    expect(usage.used).toBe(2);
    expect(usage.remaining).toBe(0);

    await resetRateLimit(id);
    const afterReset = await getUsage(id, config);
    expect(afterReset.used).toBe(0);
    expect(afterReset.remaining).toBe(2);
  });

  it('falls back gracefully when the underlying store fails', async () => {
    // Store that always throws to exercise error path.
    class FailingStore implements RateLimitStore {
      // eslint-disable-next-line class-methods-use-this
      pipeline(): RateLimitPipeline {
        throw new Error('Pipeline failure');
      }
      // Sorted-set commands
      async zadd(): Promise<number> { throw new Error('fail'); }
      async zcard(): Promise<number> { throw new Error('fail'); }
      async zremrangebyscore(): Promise<number> { throw new Error('fail'); }
      async zrem(): Promise<number> { throw new Error('fail'); }
      async zrange(): Promise<string[]> { throw new Error('fail'); }
      // Counter commands
      async incr(): Promise<number> { throw new Error('fail'); }
      async expire(): Promise<number> { throw new Error('fail'); }
      async del(): Promise<number> { throw new Error('fail'); }
    }

    rlInitialize(new FailingStore() as unknown as Redis);

    const result = await checkRateLimit('cov:error', config);
    expect(result.allowed).toBe(true);
    expect(result.remaining).toBe(config.maxRequests);
  });

  it('createEmailMiddleware respects limits for email field', async () => {
    const middleware = createEmailMiddleware({ windowMs: 60000, maxRequests: 1 });

    const makeReq = (email?: string): Request =>
      ({ body: { guestEmail: email } } as unknown as Request);

    const makeRes = (): jest.Mocked<Response> =>
      ({
        status: jest.fn().mockReturnThis(),
        json: jest.fn()
      } as unknown as jest.Mocked<Response>);

    const next: NextFunction = jest.fn();

    // First attempt allowed – wrap in promise to wait for async path inside middleware.
    await new Promise<void>((resolve) => {
      middleware(makeReq('user@example.com'), makeRes(), (...args: unknown[]) => {
        // Forward to original jest spy
        (next as jest.Mock)(...args);
        resolve();
      });
    });

    expect(next).toHaveBeenCalled();

    // Second attempt exceeds and should respond with 429
    const resBlocked = makeRes();
    const nextBlocked: NextFunction = jest.fn();
    await new Promise<void>((resolve) => {
      middleware(makeReq('user@example.com'), resBlocked, (...args: unknown[]) => {
        (nextBlocked as jest.Mock)(...args);
        resolve();
      });
      // Fallback resolve in case next is not invoked
      setImmediate(resolve);
    });
    const callsEmail = (resBlocked.status as jest.Mock).mock.calls;
    const [firstEmailCall] = callsEmail;
    const emailStatus = firstEmailCall ? (firstEmailCall[0] as number) : undefined;
    expect(emailStatus).toBe(429);
  });

  it('createIPMiddleware blocks an IP after repeated violations', async () => {
    const ipLimitMw = createIPMiddleware({ windowMs: 60000, maxRequests: 0 });

    const resFactory = (): jest.Mocked<Response> =>
      ({
        setHeader: jest.fn(),
        status: jest.fn().mockReturnThis(),
        json: jest.fn()
      } as unknown as jest.Mocked<Response>);

    const makeReq = (): Request => ({ headers: {}, ip: '10.0.0.1' } as unknown as Request);

    // Trigger violations – 11 is > maxViolations (10)
    for (let i = 0; i < 11; i++) {
      // Await each async middleware execution
      // eslint-disable-next-line no-await-in-loop
      await new Promise<void>((resolve) => {
        ipLimitMw(makeReq(), resFactory(), () => resolve());
        setImmediate(resolve);
      });
    }

    // Subsequent request should be short-circuited by IP block check.
    const resAfterBlock = resFactory();
    const nextAfterBlock: NextFunction = jest.fn();
    await new Promise<void>((resolve) => {
      ipLimitMw(makeReq(), resAfterBlock, (...args: unknown[]) => {
        (nextAfterBlock as jest.Mock)(...args);
        resolve();
      });
      setImmediate(resolve);
    });
    const callsIP = (resAfterBlock.status as jest.Mock).mock.calls;
    const [firstIPCall] = callsIP;
    const statusCode = firstIPCall ? (firstIPCall[0] as number) : undefined;
    expect(statusCode).toBe(429);
    expect(nextAfterBlock).not.toHaveBeenCalled();
  });
}); 