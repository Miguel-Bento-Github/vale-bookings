import { describe, it, expect, jest, beforeEach } from '@jest/globals';
import type { Request, Response, NextFunction } from 'express';

import { WIDGET_ERROR_CODES } from '../../../src/constants/widget';
import * as rateLimitServiceModule from '../../../src/services/RateLimitService';


// Mock logger to avoid noise
jest.mock('../../../src/utils/logger', () => ({
  logInfo: jest.fn(),
  logWarning: jest.fn(),
  logError: jest.fn()
}));

// Spy on checkRateLimit
const mockedCheck = jest.spyOn(rateLimitServiceModule, 'checkRateLimit') as jest.MockedFunction<typeof rateLimitServiceModule.checkRateLimit>;

describe('createEmailMiddleware', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  const buildReq = (email?: string): Request => ({
    body: email == null ? {} : { guestEmail: email },
    headers: {}
  } as unknown as Request);

  const buildRes = (): jest.Mocked<Response> => ({
    setHeader: jest.fn(),
    status: jest.fn().mockReturnThis(),
    json: jest.fn()
  } as unknown as jest.Mocked<Response>);

  it('allows request when under limit', async () => {
    mockedCheck.mockResolvedValue({
      allowed: true,
      limit: 5,
      remaining: 4,
      resetAt: new Date()
    });

    const mw = rateLimitServiceModule.createEmailMiddleware({ windowMs: 60000, maxRequests: 5 });
    const req = buildReq('test@example.com');
    const res = buildRes();
    const next = jest.fn() as NextFunction;

    await mw(req, res, next);

    expect(next).toHaveBeenCalled();
    expect((res.status as jest.Mock).mock.calls.length).toBe(0);
  });

  it('blocks request when over limit', async () => {
    mockedCheck.mockResolvedValue({
      allowed: false,
      limit: 5,
      remaining: 0,
      resetAt: new Date(Date.now() + 60000),
      retryAfter: 60
    });

    const mw = rateLimitServiceModule.createEmailMiddleware({ windowMs: 60000, maxRequests: 5 });
    const req = buildReq('blocked@example.com');
    const res = buildRes();
    const next = jest.fn() as NextFunction;

    await mw(req, res, next);

    const statusCalls = (res.status as jest.Mock).mock.calls;
    const firstStatus = statusCalls[0] as unknown[] | undefined;
    if (firstStatus) {
      expect(firstStatus[0]).toBe(429);
    }
    const jsonMock = res.json as jest.Mock;
    const firstCall = jsonMock.mock.calls[0] as unknown[] | undefined;
    if (firstCall) {
      const jsonPayload = firstCall[0] as { errorCode: string };
      expect(jsonPayload.errorCode).toBe(WIDGET_ERROR_CODES.RATE_LIMIT_EXCEEDED);
    }
  });

  it('skips middleware when email missing', async () => {
    const mw = rateLimitServiceModule.createEmailMiddleware();
    const req = buildReq(); // no email
    const res = buildRes();
    const next = jest.fn() as NextFunction;

    await mw(req, res, next);

    expect(mockedCheck).not.toHaveBeenCalled();
    expect(next).toHaveBeenCalled();
  });
}); 