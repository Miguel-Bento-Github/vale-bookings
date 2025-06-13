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

import { createUser, findByEmail, findById } from './UserService';

const JWT_SECRET = process.env.JWT_SECRET ?? 'fallback-secret-key';
const JWT_REFRESH_SECRET = process.env.JWT_REFRESH_SECRET ?? 'fallback-refresh-secret';
const JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN ?? '15m';
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
  } catch (error) {
    throw new AppError('Invalid token', 401);
  }
}

export function verifyRefreshToken(token: string): IJWTPayload {
  try {
    return verify(token, JWT_REFRESH_SECRET) as IJWTPayload;
  } catch (error) {
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