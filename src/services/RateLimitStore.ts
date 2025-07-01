export type RateLimitPipeline = {
  zremrangebyscore(key: string, min: string, max: number): RateLimitPipeline;
  zcard(key: string): RateLimitPipeline;
  zadd(key: string, score: number, member: string): RateLimitPipeline;
  expire(key: string, seconds: number): RateLimitPipeline;
  zrem(key: string, member: string): RateLimitPipeline;
  zrange(key: string, start: number, stop: number, withScores: 'WITHSCORES'): RateLimitPipeline;
  exec(): Promise<[null, unknown][]>;
};

export interface RateLimitStore {
  /* Sorted-set commands */
  zadd(key: string, score: number, member: string): Promise<number>;
  zcard(key: string): Promise<number>;
  zremrangebyscore(key: string, min: string, max: number): Promise<number>;
  zrem(key: string, member: string): Promise<number>;
  zrange(key: string, start: number, stop: number, withScores: 'WITHSCORES'): Promise<string[]>;

  /* String / counter commands */
  incr(key: string): Promise<number>;
  expire(key: string, seconds: number): Promise<number>;
  del(key: string): Promise<number>;

  /* Pipeline – minimal subset used by RateLimitService */
  pipeline(): RateLimitPipeline;
} 