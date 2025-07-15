import { sign, verify, SignOptions } from 'jsonwebtoken';

import {
  IRegisterRequest,
  ILoginRequest,
  IAuthTokens,
  IJWTPayload,
  IUserDocument,
  UserRole,
  AppError
} from '../types';
import { logError } from '../utils/logger';

import { createUser, findByEmail, findById } from './UserService';
import { forceUserLogout } from './WebSocketService';

const JWT_SECRET = process.env.JWT_SECRET ?? 'your-super-secret-jwt-key-change-this-in-production';
const JWT_REFRESH_SECRET = process.env.JWT_REFRESH_SECRET ?? 'your-super-secret-refresh-key-change-this-in-production';
const JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN ?? '45m';
const JWT_REFRESH_EXPIRES_IN = process.env.JWT_REFRESH_EXPIRES_IN ?? '7d';

export async function register(
  registerData: IRegisterRequest & { role?: UserRole }
): Promise<{ user: IUserDocument; tokens: IAuthTokens }> {
  const userData = {
    ...registerData,
    role: registerData.role ?? ('CUSTOMER' as UserRole)
  };
  const user = await createUser(userData);
  const tokens = generateTokens(user);

  return { user, tokens };
}

export async function login(
  loginData: ILoginRequest
): Promise<{ user: IUserDocument; tokens: IAuthTokens }> {
  const user = await findByEmail(loginData.email);

  if (user === null || user === undefined) {
    throw new AppError('Invalid credentials', 401);
  }

  const isPasswordValid = await user.comparePassword(loginData.password);

  if (!isPasswordValid) {
    throw new AppError('Invalid credentials', 401);
  }

  const tokens = generateTokens(user);

  return { user, tokens };
}

export function generateTokens(user: IUserDocument): IAuthTokens {
  const payload: IJWTPayload = {
    userId: String(user._id),
    email: user.email,
    role: user.role
  };

  const accessToken = sign(
    payload, 
    JWT_SECRET,
    { expiresIn: JWT_EXPIRES_IN } as SignOptions
  );

  const refreshToken = sign(
    payload, 
    JWT_REFRESH_SECRET,
    { expiresIn: JWT_REFRESH_EXPIRES_IN } as SignOptions
  );

  return { accessToken, refreshToken };
}

export function verifyToken(token: string): IJWTPayload {
  try {
    return verify(token, JWT_SECRET) as IJWTPayload;
  } catch {
    throw new AppError('Invalid token', 401);
  }
}

export function verifyRefreshToken(token: string): IJWTPayload {
  try {
    return verify(token, JWT_REFRESH_SECRET) as IJWTPayload;
  } catch {
    throw new AppError('Invalid refresh token', 401);
  }
}

export async function refreshTokens(refreshToken: string): Promise<IAuthTokens> {
  const payload = verifyRefreshToken(refreshToken);

  const user = await findById(payload.userId);

  if (user === null || user === undefined) {
    throw new AppError('User not found', 404);
  }

  return generateTokens(user);
}

export async function getCurrentUser(userId: string): Promise<IUserDocument | null> {
  return await findById(userId);
}

/**
 * Invalidate user token and force logout via WebSocket
 */
export function invalidateUserToken(userId: string, reason: string = 'Token invalidated by system'): void {
  try {
    // Force logout via WebSocket
    forceUserLogout(userId, reason);
  } catch (error) {
    console.error('Failed to invalidate user token:', error);
  }
}

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