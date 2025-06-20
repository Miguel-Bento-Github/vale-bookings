import { Request, Response } from 'express';

import {
  register as registerUser,
  login as loginUser,
  refreshTokens as refreshUserTokens
} from '../services/AuthService';
import { AppError, AuthenticatedRequest, UserRole } from '../types';
import { validateEmail, validatePassword } from '../utils/validation';
import {
  sendSuccess,
  sendError,
  withErrorHandling
} from '../utils/responseHelpers';
import {
  validateAuthentication,
  validateRequiredString
} from '../utils/validationHelpers';

interface RegisterRequestBody {
  email: string;
  password: string;
  profile: {
    name: string;
    phone?: string;
  };
  role?: UserRole;
}

interface LoginRequestBody {
  email: string;
  password: string;
}

interface RefreshTokenRequestBody {
  refreshToken: string;
}

function isValidUserRole(role: unknown): role is UserRole {
  return role === 'CUSTOMER' || role === 'VALET' || role === 'ADMIN';
}

function isRegisterRequestBody(body: unknown): body is RegisterRequestBody {
  const bodyObj = body as Record<string, unknown>;
  return (
    typeof body === 'object' &&
    body !== null &&
    typeof bodyObj.email === 'string' &&
    typeof bodyObj.password === 'string' &&
    typeof bodyObj.profile === 'object' &&
    bodyObj.profile !== null &&
    (bodyObj.role === undefined || isValidUserRole(bodyObj.role))
  );
}

function isLoginRequestBody(body: unknown): body is LoginRequestBody {
  const bodyObj = body as Record<string, unknown>;
  return (
    typeof body === 'object' &&
    body !== null &&
    typeof bodyObj.email === 'string' &&
    typeof bodyObj.password === 'string'
  );
}

function isRefreshTokenRequestBody(body: unknown): body is RefreshTokenRequestBody {
  const bodyObj = body as Record<string, unknown>;
  return (
    typeof body === 'object' &&
    body !== null &&
    typeof bodyObj.refreshToken === 'string'
  );
}

export const register = withErrorHandling(async (req: Request, res: Response): Promise<void> => {
  if (!isRegisterRequestBody(req.body)) {
    sendError(res, 'Email, password, and profile are required', 400);
    return;
  }

  const { email, password, profile, role } = req.body;

  if (!validateEmail(email)) {
    sendError(res, 'Invalid email format', 400);
    return;
  }

  if (!validatePassword(password)) {
    sendError(res, 'password must be at least 6 characters long', 400);
    return;
  }

  if (!profile.name || profile.name.trim().length === 0) {
    sendError(res, 'Profile name is required', 400);
    return;
  }

  const result = await registerUser({ email, password, profile, role });

  sendSuccess(res, {
    user: result.user,
    token: result.tokens.accessToken,
    refreshToken: result.tokens.refreshToken
  }, 'User registered successfully', 201);
});

export const login = withErrorHandling(async (req: Request, res: Response): Promise<void> => {
  if (!isLoginRequestBody(req.body)) {
    sendError(res, 'Email and password are required', 400);
    return;
  }

  const { email, password } = req.body;

  // Validate email format before attempting authentication
  if (!validateEmail(email)) {
    sendError(res, 'Invalid email format', 400);
    return;
  }

  const result = await loginUser({ email, password });

  sendSuccess(res, {
    user: result.user,
    token: result.tokens.accessToken,
    refreshToken: result.tokens.refreshToken
  }, 'Login successful');
});

export const refreshToken = withErrorHandling(async (req: Request, res: Response): Promise<void> => {
  if (!isRefreshTokenRequestBody(req.body)) {
    sendError(res, 'Refresh token is required', 400);
    return;
  }

  const { refreshToken: refreshTokenValue } = req.body;
  const tokens = await refreshUserTokens(refreshTokenValue);

  sendSuccess(res, {
    token: tokens.accessToken,
    refreshToken: tokens.refreshToken
  }, 'Token refreshed successfully');
});

export const me = withErrorHandling(async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  if (!validateAuthentication(req.user, res)) {
    return;
  }

  // Get full user details from database
  const User = (await import('../models/User')).default;
  const user = await User.findById(req.user!.userId).select('-password');

  if (!user) {
    sendError(res, 'User not found', 404);
    return;
  }

  sendSuccess(res, { user });
}); 