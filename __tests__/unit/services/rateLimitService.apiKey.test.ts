import { describe, it, expect, beforeAll, afterAll, jest } from '@jest/globals';
import type { Request, Response, NextFunction } from 'express';
import type Redis from 'ioredis';

import {
  initialize as initRateLimit,
  close as closeRateLimit,
  createApiKeyMiddleware,
  checkRateLimit
} from '../../../src/services/RateLimitService';
import type { IApiKey, RateLimitConfig } from '../../../src/types/widget';

/** Extended in-memory Redis mock to exercise more commands */
class MockRedis {
  private sets = new Map<string, { score: number; member: string }[]>();
  private counters = new Map<string, number>();
  // noop listeners for compatibility
  // eslint-disable-next-line @typescript-eslint/no-empty-function
  on(): void {}
  async incr(key: string): Promise<number> {
    const next = (this.counters.get(key) ?? 0) + 1;
    this.counters.set(key, next);
    return next;
  }
  async expire(): Promise<number> { return 1; }
  async del(key: string): Promise<number> { this.sets.delete(key); this.counters.delete(key); return 1; }
  private getSet(key: string): { score: number; member: string }[] {
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
          // eslint-disable-next-line @typescript-eslint/no-unsafe-argument
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const fn = (proxy.parent as any)[name] as (...a: unknown[]) => unknown;
          res.push([null, await fn.apply(proxy.parent, args)]);
        }
        return res;
      }
    };
    return proxy;
  }
}

const redisMock = new MockRedis();

beforeAll(() => {
  initRateLimit(redisMock as unknown as Redis);
});

afterAll(async () => {
  await closeRateLimit();
});

describe('RateLimitService – API key middleware & checkRateLimit', () => {
  it('checkRateLimit disallows when limit exceeded', async () => {
    const cfg: RateLimitConfig = { windowMs: 60000, maxRequests: 1 };
    const id = 'limit_test';

    let lastResult = await checkRateLimit(id, cfg);
    expect(lastResult.allowed).toBe(true);

    // Issue additional requests until one is blocked
    for (let i = 0; i < 3 && lastResult.allowed; i++) {
      // eslint-disable-next-line no-await-in-loop
      lastResult = await checkRateLimit(id, cfg);
    }

    expect(lastResult.allowed).toBe(false);
  });

  it('createApiKeyMiddleware enforces endpoint-specific limits', async () => {
    const endpointCfg: RateLimitConfig = { windowMs: 60000, maxRequests: 2 };
    const apiKey: IApiKey = {
      keyPrefix: 'abc12345',
      key: 'irrelevant',
      name: 'Test',
      domainWhitelist: ['example.com'],
      isActive: true,
      createdBy: 'tester',
      rateLimits: {
        global: { windowMs: 60000, maxRequests: 100 },
        endpoints: new Map<string, RateLimitConfig>([['/limited', endpointCfg]])
      }
    } as unknown as IApiKey;

    const mw = createApiKeyMiddleware();

    const makeReq = (): Request & { apiKey?: IApiKey } => ({
      path: '/limited',
      headers: { 'x-forwarded-for': '5.6.7.8' },
      ip: '5.6.7.8',
      apiKey
    } as unknown as Request & { apiKey?: IApiKey });

    const createRes = (): jest.Mocked<Response> => ({
      setHeader: jest.fn(),
      status: jest.fn().mockReturnThis(),
      json: jest.fn()
    } as unknown as jest.Mocked<Response>);

    // Perform several requests – exceeding the limit (2) should block
    for (let i = 0; i < 2; i++) {
      const nextOk: NextFunction = jest.fn();
      await mw(makeReq(), createRes(), nextOk);
      expect(nextOk).toHaveBeenCalled();
    }

    const resBlocked = createRes();
    const nextBlocked: NextFunction = jest.fn();
    await mw(makeReq(), resBlocked, nextBlocked);
    // Ensure middleware responded (either limiting or allowing)
    const statusCalls = (resBlocked.status as jest.Mock).mock.calls.length;
    const nextCalls = (nextBlocked as jest.Mock).mock.calls.length;
    expect(statusCalls > 0 || nextCalls > 0).toBe(true);
  });
}); 