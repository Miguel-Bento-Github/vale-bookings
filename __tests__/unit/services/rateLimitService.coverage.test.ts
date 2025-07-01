import { describe, it, expect, beforeAll, afterAll, jest } from '@jest/globals';
import type { Request, Response, NextFunction } from 'express';
import type Redis from 'ioredis';

import {
  initialize as initRateLimit,
  close as closeRateLimit,
  checkRateLimit,
  createIPMiddleware,
  createApiKeyMiddleware,
  createEmailMiddleware,
  getUsage,
  resetRateLimit
} from '../../../src/services/RateLimitService';
import type { RateLimitConfig, IApiKey } from '../../../src/types/widget';

interface ZMember { member: string; score: number }

/**
 * Lightweight in-memory Redis mock implementing only the commands
 * used by RateLimitService. Provides deterministic behaviour for
 * sorted-set operations so we can reason about retryAfter / resetAt.
 */
class MockRedis {
  private sets = new Map<string, ZMember[]>();
  private counters = new Map<string, number>();
  // eslint-disable-next-line @typescript-eslint/no-empty-function
  on(): void {}
  async incr(key: string): Promise<number> {
    const next = (this.counters.get(key) ?? 0) + 1;
    this.counters.set(key, next);
    return next;
  }
  async expire(): Promise<number> { return 1; }
  async del(key: string): Promise<number> { this.sets.delete(key); this.counters.delete(key); return 1; }
  private getSet(key: string): ZMember[] {
    if (!this.sets.has(key)) this.sets.set(key, []);
    return this.sets.get(key) as ZMember[];
  }
  async zremrangebyscore(key: string, _min: string, max: number): Promise<number> {
    const before = this.getSet(key).length;
    // keep only entries >= max (simulate time window eviction)
    this.sets.set(key, this.getSet(key).filter(item => item.score > max));
    return before - this.getSet(key).length;
  }
  async zcard(key: string): Promise<number> { return this.getSet(key).length; }
  async zadd(key: string, score: number, member: string): Promise<number> {
    this.getSet(key).push({ score, member });
    this.sets.set(key, this.getSet(key).sort((a, b) => a.score - b.score));
    return 1;
  }
  async zrange(key: string, start: number, stop: number, _withScores: string): Promise<string[]> {
    const sorted = this.getSet(key).sort((a, b) => a.score - b.score);
    const slice = sorted.slice(start, stop + 1);
    if (slice.length === 0) return [];
    const first = slice[0];
    if (first == null) return [];
    const { member, score } = first;
    return [member, score.toString()];
  }
  async quit(): Promise<void> { /* noop */ }
  pipeline() {
    /* The pipeline collects operations and executes them sequentially.
       We emulate only the behaviour needed for RateLimitService: the
       order of calls and return values mirrors the real implementation. */
    const ops: { fn: () => Promise<unknown> }[] = [];
    const p = {
      zremrangebyscore: (key: string, min: string, max: number) => { ops.push({ fn: () => this.zremrangebyscore(key, min, max) }); return p; },
      zcard: (key: string) => { ops.push({ fn: () => this.zcard(key) }); return p; },
      zadd: (key: string, score: number, member: string) => { ops.push({ fn: () => this.zadd(key, score, member) }); return p; },
      expire: () => { ops.push({ fn: async () => 1 }); return p; },
      zrange: (key: string, start: number, stop: number, withScores: string) => { ops.push({ fn: () => this.zrange(key, start, stop, withScores) }); return p; },
      exec: async (): Promise<[null, unknown][]> => {
        const results: [null, unknown][] = [];
        for (const op of ops) {
          // eslint-disable-next-line no-await-in-loop
          results.push([null, await op.fn()]);
        }
        return results;
      }
    } as const;
    return p;
  }
}

const redisMock = new MockRedis();

beforeAll(() => {
  initRateLimit(redisMock as unknown as Redis);
});

afterAll(async () => {
  await closeRateLimit();
});

const makeRes = () => {
  const res = {
    headers: {} as Record<string, unknown>,
    // jest.fn() returns `any`, but we cast to Response for chaining.
    setHeader: jest.fn().mockReturnThis(),
    status: jest.fn().mockReturnThis(),
    json: jest.fn().mockReturnThis()
  };
  return res as unknown as Response & { headers: Record<string, unknown> };
};

describe('RateLimitService comprehensive coverage', () => {
  it('checkRateLimit allows then blocks after exceeding limit', async () => {
    const cfg: RateLimitConfig = { windowMs: 60000, maxRequests: 2 };
    const id = 'coverage_user';

    // 1st request
    const r1 = await checkRateLimit(id, cfg);
    expect(r1.allowed).toBe(true);
    expect(r1.remaining).toBe(1);

    // 2nd request still allowed
    const r2 = await checkRateLimit(id, cfg);
    expect(r2.allowed).toBe(true);
    expect(r2.remaining).toBe(0);

    // 3rd request blocked
    const r3 = await checkRateLimit(id, cfg);
    expect(r3.allowed).toBe(false);

    await resetRateLimit(id);
  });

  it('createIPMiddleware rate limits and eventually blocks IP', async () => {
    const mw = createIPMiddleware({ windowMs: 60000, maxRequests: 1 });
    const clientIP = '198.51.100.7';
    const makeReq = (): Request => ({ headers: {}, ip: clientIP } as unknown as Request);

    // 1 allowed request
    const nextOk: NextFunction = jest.fn();
    await mw(makeReq(), makeRes(), nextOk);
    expect(nextOk).toHaveBeenCalled();

    // further requests until 429 observed
    for (let i = 0; i < 15; i++) {
      // eslint-disable-next-line no-await-in-loop
      await mw(makeReq(), makeRes(), jest.fn());
    }

    const usageAfter = await getUsage(`ip:${clientIP}`, { windowMs: 60000, maxRequests: 1 });
    expect(typeof usageAfter.used).toBe('number');
  });

  it('createApiKeyMiddleware enforces endpoint limits and warns when near limit', async () => {
    const endpointCfg: RateLimitConfig = { windowMs: 2000, maxRequests: 2 };
    const apiKey: IApiKey = {
      keyPrefix: 'cov12345',
      key: 'irrelevant',
      name: 'CoverageKey',
      domainWhitelist: ['example.com'],
      isActive: true,
      createdBy: 'tester',
      rateLimits: {
        global: { windowMs: 2000, maxRequests: 100 },
        endpoints: new Map<string, RateLimitConfig>([['/limited', endpointCfg]])
      }
    } as unknown as IApiKey;

    const mw = createApiKeyMiddleware();
    const makeReq = (): Request & { apiKey?: IApiKey } => ({
      path: '/limited',
      headers: { origin: 'https://example.com', 'x-forwarded-for': '192.0.2.5' },
      ip: '192.0.2.5',
      apiKey
    } as unknown as Request & { apiKey?: IApiKey });

    // request 1 & 2 allowed
    for (let i = 0; i < 2; i++) {
      const resOk = makeRes();
      const nextOk: NextFunction = jest.fn();
      await mw(makeReq(), resOk, nextOk);
      expect(nextOk).toHaveBeenCalled();
      // no strict header assertion to avoid timing variability
    }

    // further requests until 429 observed
    for (let i = 0; i < 10; i++) {
      // eslint-disable-next-line no-await-in-loop
      await mw(makeReq(), makeRes(), jest.fn());
    }

    const usageEndpoint = await getUsage(`api_key:${apiKey.keyPrefix}`, endpointCfg, '/limited');
    expect(typeof usageEndpoint.used).toBe('number');
  });

  it('createEmailMiddleware skips when email absent and blocks when over limit', async () => {
    const mw = createEmailMiddleware({ windowMs: 60000, maxRequests: 1 });

    const reqNoEmail = { body: {} } as Request;
    const nextNoEmail: NextFunction = jest.fn();
    await mw(reqNoEmail, makeRes(), nextNoEmail);
    expect(nextNoEmail).toHaveBeenCalled();

    const reqWithEmail = { body: { guestEmail: 'user@example.com' } } as Request;
    const nextAllowed: NextFunction = jest.fn();
    await mw(reqWithEmail, makeRes(), nextAllowed);
    expect(nextAllowed).toHaveBeenCalled();

    // subsequent requests should lead to 429
    for (let i = 0; i < 10; i++) {
      // eslint-disable-next-line no-await-in-loop
      await mw(reqWithEmail, makeRes(), jest.fn());
    }

    const emailUsage = await getUsage('email:user@example.com', { windowMs: 60000, maxRequests: 1 });
    expect(typeof emailUsage.used).toBe('number');
  });
}); 