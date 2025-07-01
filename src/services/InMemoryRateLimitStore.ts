import { RateLimitStore } from './RateLimitStore';

interface ZMember {
  member: string;
  score: number;
}

/**
 * Simple in-memory implementation of the RateLimitStore interface.
 * It is NOT suitable for production but useful for tests and dev
 * environments where Redis is unavailable.
 */
export class InMemoryRateLimitStore implements RateLimitStore {
  private sets: Map<string, ZMember[]> = new Map();
  private counters: Map<string, number> = new Map();

  // Sorted-set helpers
  private getSet(key: string): ZMember[] {
    if (!this.sets.has(key)) {
      this.sets.set(key, []);
    }
    return this.sets.get(key) ?? [];
  }

  zadd(key: string, score: number, member: string): Promise<number> {
    this.getSet(key).push({ score, member });
    // Maintain ascending order by score (timestamp)
    this.sets.set(key, this.getSet(key).sort((a, b) => a.score - b.score));
    return Promise.resolve(1);
  }

  zcard(key: string): Promise<number> {
    return Promise.resolve(this.getSet(key).length);
  }

  zremrangebyscore(key: string, _min: string, max: number): Promise<number> {
    const before = this.getSet(key).length;
    this.sets.set(key, this.getSet(key).filter(item => item.score >= max));
    return Promise.resolve(before - this.getSet(key).length);
  }

  zrange(key: string, start: number, stop: number, withScores: 'WITHSCORES'): Promise<string[]> {
    if (withScores !== 'WITHSCORES') throw new Error('InMemoryRateLimitStore only supports WITHSCORES variant');
    const list = this.getSet(key).slice(start, stop + 1);
    const first = list[0];
    if (first == null) return Promise.resolve([]);
    return Promise.resolve([first.member, String(first.score)]);
  }

  zrem(key: string, member: string): Promise<number> {
    const before = this.getSet(key).length;
    this.sets.set(key, this.getSet(key).filter(item => item.member !== member));
    return Promise.resolve(before - this.getSet(key).length);
  }

  /** Counter helpers used by abuse tracking */
  incr(key: string): Promise<number> {
    const next = (this.counters.get(key) ?? 0) + 1;
    this.counters.set(key, next);
    return Promise.resolve(next);
  }

  expire(_key: string, _seconds: number): Promise<number> {
    return Promise.resolve(1); // no-op for in-memory
  }

  del(key: string): Promise<number> {
    const existed = this.sets.delete(key) || this.counters.delete(key);
    return Promise.resolve(existed ? 1 : 0);
  }

  pipeline(): import('./RateLimitStore').RateLimitPipeline {
    const ops: { fn: () => Promise<unknown> }[] = [];

    type AsyncFunc = (...params: unknown[]) => Promise<unknown>;
    const push = (fn: AsyncFunc) =>
      (...args: unknown[]): import('./RateLimitStore').RateLimitPipeline => {
        ops.push({ fn: () => fn(...args) });
        return pipelineProxy;
      };

    const pipelineProxy: import('./RateLimitStore').RateLimitPipeline = {
      zremrangebyscore: push(this.zremrangebyscore.bind(this) as AsyncFunc),
      zcard: push(this.zcard.bind(this) as AsyncFunc),
      zadd: push(this.zadd.bind(this) as AsyncFunc),
      expire: push(this.expire.bind(this) as AsyncFunc),
      zrange: push(this.zrange.bind(this) as AsyncFunc),
      zrem: push(this.zrem.bind(this) as AsyncFunc),
      exec: async (): Promise<[null, unknown][]> => {
        const results: [null, unknown][] = [];
        for (const op of ops) {
          results.push([null, await op.fn()]);
        }
        return results;
      }
    };

    return pipelineProxy;
  }
} 