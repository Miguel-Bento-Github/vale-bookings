import { describe, expect, it, beforeAll, afterAll } from '@jest/globals';
import type Redis from 'ioredis';

import {
  checkRateLimit,
  resetRateLimit,
  initialize as initializeRateLimitService,
  close as closeRateLimitService
} from '../../../src/services/RateLimitService';

interface ZMember {
  member: string;
  score: number;
}

/**
 * A minimal in-memory Redis mock that supports the subset of commands used by RateLimitService.
 */
class MockRedis {
  private sets: Map<string, ZMember[]> = new Map();
  // eslint-disable-next-line @typescript-eslint/no-empty-function
  on(): void {}

  /** Increment a key used for abuse tracking (not utilised in these tests). */
  async incr(_key: string): Promise<number> {
    return 1;
  }

  async expire(_key: string, _seconds: number): Promise<number> {
    return 1;
  }

  async del(_key: string): Promise<number> {
    this.sets.delete(_key);
    return 1;
  }

  /** Sorted-set helpers */
  private getSet(key: string): ZMember[] {
    if (!this.sets.has(key)) this.sets.set(key, []);
    // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
    return this.sets.get(key)!;
  }

  async zremrangebyscore(key: string, _min: string, max: number): Promise<number> {
    const set = this.getSet(key);
    const originalLen = set.length;
    const filtered = set.filter(item => item.score >= max);
    this.sets.set(key, filtered);
    return originalLen - filtered.length;
  }

  async zcard(key: string): Promise<number> {
    return this.getSet(key).length;
  }

  async zadd(key: string, score: number, member: string): Promise<number> {
    this.getSet(key).push({ score, member });
    // Keep sorted by score ascending
    this.sets.set(
      key,
      this.getSet(key).sort((a, b) => a.score - b.score)
    );
    return 1;
  }

  async expirekey(): Promise<void> {
    // noop for mock
  }

  async zrange(key: string, start: number, end: number, withScores: string): Promise<string[]> {
    if (withScores !== 'WITHSCORES') throw new Error('Unsupported signature in mock');
    const subset = this.getSet(key).slice(start, end + 1);
    const first = subset[0];
    if (first === undefined) return [];
    return [first.member, String(first.score)];
  }

  async quit(): Promise<void> {
    // noop
  }

  pipeline(): { [method: string]: (...args: unknown[]) => unknown; exec: () => Promise<[null, unknown][]> } {
    const ops: { name: keyof MockRedis; args: unknown[] }[] = [];
    const pushOp = (name: keyof MockRedis) =>
      (...args: unknown[]): unknown => {
        ops.push({ name, args });
        return pipelineProxy;
      };

    const pipelineProxy: any = {
      parent: this,
      zremrangebyscore: pushOp('zremrangebyscore'),
      zcard: pushOp('zcard'),
      zadd: pushOp('zadd'),
      expire: pushOp('expire'),
      zrange: pushOp('zrange'),
      async exec(): Promise<[null, unknown][]> {
        const results: [null, unknown][] = [];
        const parent: MockRedis = pipelineProxy.parent as MockRedis;

        for (const op of ops) {
          let res: unknown;

          switch (op.name) {
          case 'zremrangebyscore':
            res = await parent.zremrangebyscore(
              ...(op.args as [string, string, number])
            );
            break;
          case 'zcard':
            res = await parent.zcard(
              ...(op.args as [string])
            );
            break;
          case 'zadd':
            res = await parent.zadd(
              ...(op.args as [string, number, string])
            );
            break;
          case 'expire':
            res = await parent.expire(
              ...(op.args as [string, number])
            );
            break;
          case 'zrange':
            res = await parent.zrange(
              ...(op.args as [string, number, number, string])
            );
            break;
          default:
            throw new Error(`Unsupported command ${String(op.name)}`);
          }

          results.push([null, res]);
        }

        return results;
      }
    };

    return pipelineProxy;
  }
}

const mockRedis = new MockRedis();

beforeAll(() => {
  initializeRateLimitService(mockRedis as unknown as Redis);
});

afterAll(async () => {
  await closeRateLimitService();
});

describe('RateLimitService.checkRateLimit', () => {
  const config = { windowMs: 1000, maxRequests: 3 };

  it('allows requests under the limit', async () => {
    const id = 'rl:test1';
    const result = await checkRateLimit(id, config);
    expect(result.allowed).toBe(true);
    expect(result.remaining).toBe(2);
  });

  it('blocks requests that exceed the limit', async () => {
    const id = 'rl:test2';
    // Fill up the window
    await checkRateLimit(id, config); // remaining 2
    await checkRateLimit(id, config); // remaining 1
    await checkRateLimit(id, config); // remaining 0
    const fourth = await checkRateLimit(id, config);
    expect(fourth.allowed).toBe(false);
    expect(fourth.remaining).toBe(0);
  });

  it('resets after resetRateLimit call', async () => {
    const id = 'rl:test3';
    await resetRateLimit(id);
    const result = await checkRateLimit(id, config);
    expect(result.allowed).toBe(true);
    expect(result.remaining).toBe(2);
  });
}); 