export interface RateLimitStore {
  /* Sorted-set commands */
  zadd(key: string, score: number, member: string): Promise<number>;
  zcard(key: string): Promise<number>;
  zremrangebyscore(key: string, min: string, max: number): Promise<number>;
  zrange(key: string, start: number, stop: number, withScores: 'WITHSCORES'): Promise<string[]>;

  /* String / counter commands */
  incr(key: string): Promise<number>;
  expire(key: string, seconds: number): Promise<number>;
  del(key: string): Promise<number>;

  /* Pipeline – minimal subset used by RateLimitService */
  pipeline(): {
    zremrangebyscore(key: string, min: string, max: number): ReturnType<RateLimitStore['pipeline']>;
    zcard(key: string): ReturnType<RateLimitStore['pipeline']>;
    zadd(key: string, score: number, member: string): ReturnType<RateLimitStore['pipeline']>;
    expire(key: string, seconds: number): ReturnType<RateLimitStore['pipeline']>;
    zrange(key: string, start: number, stop: number, withScores: 'WITHSCORES'): ReturnType<RateLimitStore['pipeline']>;
    exec(): Promise<[null, unknown][]>;
  };
} 