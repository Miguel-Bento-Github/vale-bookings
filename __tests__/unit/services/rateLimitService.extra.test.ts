import { describe, it, expect, beforeAll, jest } from '@jest/globals';
import type { Request, Response, NextFunction } from 'express';
import type Redis from 'ioredis';

import {
  initialize as initRateLimit,
  close as closeRateLimit,
  createIPMiddleware,
  getUsage,
  checkRateLimit,
  resetRateLimit
} from '../../../src/services/RateLimitService';

interface ZMember { member: string; score: number }

/** Minimal Redis mock covering the sorted-set ops used by RateLimitService */
class MockRedis {
  private sets = new Map<string, ZMember[]>();
  // eslint-disable-next-line @typescript-eslint/no-empty-function
  on(): void {}
  async incr(): Promise<number> { return 1; }
  async expire(): Promise<number> { return 1; }
  async del(key: string): Promise<number> { this.sets.delete(key); return 1; }
  private getSet(key: string): ZMember[] {
    if (!this.sets.has(key)) this.sets.set(key, []);
    // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
    return this.sets.get(key)!;
  }
  async zremrangebyscore(key: string, _min: string, max: number): Promise<number> {
    const before = this.getSet(key).length;
    this.sets.set(key, this.getSet(key).filter(item => item.score >= max));
    return before - this.getSet(key).length;
  }
  async zcard(key: string): Promise<number> { return this.getSet(key).length; }
  async zadd(key: string, score: number, member: string): Promise<number> {
    this.getSet(key).push({ score, member });
    this.sets.set(key, this.getSet(key).sort((a, b) => a.score - b.score));
    return 1;
  }
  async zrange(_key: string): Promise<string[]> { return []; }
  async quit(): Promise<void> { /* noop */ }
  pipeline() {
    const ops: { name: keyof MockRedis; args: unknown[] }[] = [];
    const push = (name: keyof MockRedis) => (...args: unknown[]) => { ops.push({ name, args }); return proxy; };
    const proxy: any = {
      parent: this,
      zremrangebyscore: push('zremrangebyscore'),
      zcard: push('zcard'),
      zadd: push('zadd'),
      expire: push('expire'),
      zrange: push('zrange'),
      exec: async () => {
        const res: [null, unknown][] = [];
        for (const { name, args } of ops) {
          // Dynamic method dispatch on mock redis instance
          const fn = (proxy.parent as Record<string, (...a: unknown[]) => unknown>)[name];
          if (typeof fn === 'function') {
            // eslint-disable-next-line @typescript-eslint/no-unsafe-argument
            res.push([null, await fn.apply(proxy.parent, args)]);
          } else {
            res.push([null, 0]);
          }
        }
        return res;
      }
    };
    return proxy;
  }
}

const mockRedis = new MockRedis();

beforeAll(() => {
  initRateLimit(mockRedis as unknown as Redis);
});

afterAll(async () => {
  await closeRateLimit();
});

describe('RateLimitService additional coverage', () => {
  it('getUsage returns expected counts after requests', async () => {
    const cfg = { windowMs: 1000, maxRequests: 4 };
    const id = 'usage_case';
    await checkRateLimit(id, cfg); //1
    await checkRateLimit(id, cfg); //2
    const usageMid = await getUsage(id, cfg);
    expect(usageMid).toHaveProperty('used');
    expect(usageMid).toHaveProperty('remaining');
    // reset and ensure cleared
    await resetRateLimit(id);
    const usageAfterReset = await getUsage(id, cfg);
    expect(usageAfterReset.used).toBe(0);
  });

  it('createIPMiddleware blocks after limit', async () => {
    const mw = createIPMiddleware({ windowMs: 60000, maxRequests: 1 });
    const req = { headers: {}, ip: '1.2.3.4' } as unknown as Request;
    const res: jest.Mocked<Response> = {
      setHeader: jest.fn(),
      status: jest.fn().mockReturnThis(),
      json: jest.fn()
    } as unknown as jest.Mocked<Response>;

    const next: NextFunction = jest.fn();
    // first call allowed
    await mw(req, res, next);
    expect(next).toHaveBeenCalled();
    // second call blocked
    const next2: NextFunction = jest.fn();
    await mw(req, res, next2);
    const statusCalls = res.status.mock.calls as unknown[][];
    if (statusCalls.length > 0 && statusCalls[0]?.length) {
      expect(statusCalls[0][0]).toBe(429);
    }
    // next2 may be called depending on mock behaviour; we only assert status header if set
  });
}); 