import { verify } from 'jsonwebtoken';

import { IJWTPayload } from '../types';

import { logError } from './logger';

const JWT_SECRET = process.env.JWT_SECRET ?? 'your-super-secret-jwt-key-change-this-in-production';

/**
 * Verify token and handle expiration gracefully
 */
export function verifyTokenSafely(token: string): IJWTPayload | null {
  try {
    return verify(token, JWT_SECRET) as IJWTPayload;
  } catch (error) {
    if (error instanceof Error) {
      // Check if it's a token expiration error
      if (error.name === 'TokenExpiredError') {
        // Token expired - handled gracefully
        return null;
      }
      // Other JWT errors (invalid, malformed, etc.)
      logError('JWT verification error:', error);
    }
    return null;
  }
}