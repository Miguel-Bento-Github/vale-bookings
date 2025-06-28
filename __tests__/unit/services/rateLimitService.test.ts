import { Request, Response, NextFunction } from 'express';
import Redis from 'ioredis';

import { WIDGET_ERROR_CODES, RATE_LIMIT_DEFAULTS } from '../../../src/constants/widget';
import { rateLimitService } from '../../../src/services/RateLimitService';

// Mock Redis
jest.mock('ioredis');

describe('Rate Limit Service', () => {
  let mockRedis: any;
  let mockPipeline: any;
  
  beforeEach(() => {
    jest.clearAllMocks();
    
    // Mock pipeline methods
    mockPipeline = {
      zremrangebyscore: jest.fn().mockReturnThis(),
      zcard: jest.fn().mockReturnThis(),
      zadd: jest.fn().mockReturnThis(),
      expire: jest.fn().mockReturnThis(),
      zrange: jest.fn().mockReturnThis(),
      exec: jest.fn()
    };
    
    // Mock Redis instance
    mockRedis = {
      pipeline: jest.fn().mockReturnValue(mockPipeline),
      zrem: jest.fn().mockResolvedValue(1),
      incr: jest.fn().mockResolvedValue(1),
      expire: jest.fn().mockResolvedValue(1),
      del: jest.fn().mockResolvedValue(1),
      zcard: jest.fn().mockResolvedValue(0),
      zrange: jest.fn().mockResolvedValue([]),
      zremrangebyscore: jest.fn().mockResolvedValue(0),
      quit: jest.fn().mockResolvedValue('OK'),
      on: jest.fn()
    };
    
    // Initialize the service with the mocked Redis
    rateLimitService.initialize(mockRedis);
  });

  afterEach(() => {
    // Clear timers
    jest.clearAllTimers();
  });

  describe('checkRateLimit', () => {
    const config = { windowMs: 60000, maxRequests: 10 };
    
    it('should allow request within rate limit', async () => {
      mockPipeline.exec.mockResolvedValue([
        [null, null], // zremrangebyscore
        [null, 4],    // zcard - 4 requests in window (before adding new one)
        [null, 1],    // zadd
        [null, 1],    // expire
        [null, ['req1', '1234567890']] // zrange with timestamp
      ]);
      
      const result = await rateLimitService.checkRateLimit('test-id', config);
      
      expect(result.allowed).toBe(true);
      expect(result.remaining).toBe(5); // 10 - 5 (4 + 1)
      expect(result.limit).toBe(10);
      expect(result.resetAt).toBeInstanceOf(Date);
    });

    it('should block request exceeding rate limit', async () => {
      mockPipeline.exec.mockResolvedValue([
        [null, null], // zremrangebyscore
        [null, 10],   // zcard - 10 requests (at limit before adding new one)
        [null, 1],    // zadd
        [null, 1],    // expire
        [null, ['req1', '1234567890']] // zrange
      ]);
      
      const result = await rateLimitService.checkRateLimit('test-id', config);
      
      expect(result.allowed).toBe(false);
      expect(result.remaining).toBe(0);
      expect(result.retryAfter).toBeDefined();
      expect(mockRedis.zrem).toHaveBeenCalled();
    });

    it('should handle Redis errors gracefully', async () => {
      mockPipeline.exec.mockRejectedValue(new Error('Redis error'));
      
      const result = await rateLimitService.checkRateLimit('test-id', config);
      
      // Should allow request on error
      expect(result.allowed).toBe(true);
      expect(result.limit).toBe(10);
      expect(result.remaining).toBe(10);
    });
  });

  describe('getUsage', () => {
    it('should return current usage statistics', async () => {
      mockRedis.zremrangebyscore.mockResolvedValue(0);
      mockRedis.zcard.mockResolvedValue(7);
      mockRedis.zrange.mockResolvedValue(['req1', '1234567890']);
      
      const config = { windowMs: 60000, maxRequests: 10 };
      const usage = await rateLimitService.getUsage('test-id', config);
      
      expect(usage.used).toBe(7);
      expect(usage.limit).toBe(10);
      expect(usage.remaining).toBe(3);
      expect(usage.resetAt).toBeInstanceOf(Date);
    });
  });

  describe('resetRateLimit', () => {
    it('should delete rate limit key', async () => {
      await rateLimitService.resetRateLimit('test-id');
      
      expect(mockRedis.del).toHaveBeenCalledWith('test-id');
    });
  });

  describe('close', () => {
    it('should close Redis connection', async () => {
      await rateLimitService.close();
      
      expect(mockRedis.quit).toHaveBeenCalled();
    });
  });
}); 