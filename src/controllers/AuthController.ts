import { Request, Response } from 'express';

import {
  register as registerUser,
  login as loginUser,
  refreshTokens as refreshUserTokens
} from '../services/AuthService';
import { AppError, AuthenticatedRequest, UserRole } from '../types';
import { validateEmail, validatePassword } from '../utils/validation';

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

export async function register(req: Request, res: Response): Promise<void> {
  try {
    if (!isRegisterRequestBody(req.body)) {
      res.status(400).json({
        success: false,
        message: 'Email, password, and profile are required'
      });
      return;
    }

    const { email, password, profile, role } = req.body;

    if (!validateEmail(email)) {
      res.status(400).json({
        success: false,
        message: 'Invalid email format'
      });
      return;
    }

    if (!validatePassword(password)) {
      res.status(400).json({
        success: false,
        message: 'password must be at least 6 characters long'
      });
      return;
    }

    if (!profile.name || profile.name.trim().length === 0) {
      res.status(400).json({
        success: false,
        message: 'Profile name is required'
      });
      return;
    }

    const result = await registerUser({ email, password, profile, role });

    res.status(201).json({
      success: true,
      message: 'User registered successfully',
      data: {
        user: result.user,
        token: result.tokens.accessToken,
        refreshToken: result.tokens.refreshToken
      }
    });
  } catch (error) {
    if (error instanceof AppError) {
      res.status(error.statusCode).json({
        success: false,
        message: error.message
      });
    } else {
      res.status(500).json({
        success: false,
        message: 'Internal server error'
      });
    }
  }
}

export async function login(req: Request, res: Response): Promise<void> {
  try {
    if (!isLoginRequestBody(req.body)) {
      res.status(400).json({
        success: false,
        message: 'Email and password are required'
      });
      return;
    }

    const { email, password } = req.body;

    // Validate email format before attempting authentication
    if (!validateEmail(email)) {
      res.status(400).json({
        success: false,
        message: 'Invalid email format'
      });
      return;
    }

    const result = await loginUser({ email, password });

    res.status(200).json({
      success: true,
      message: 'Login successful',
      data: {
        user: result.user,
        token: result.tokens.accessToken,
        refreshToken: result.tokens.refreshToken
      }
    });
  } catch (error) {
    if (error instanceof AppError) {
      res.status(error.statusCode).json({
        success: false,
        message: error.message
      });
    } else {
      res.status(500).json({
        success: false,
        message: 'Internal server error'
      });
    }
  }
}

export async function refreshToken(req: Request, res: Response): Promise<void> {
  try {
    if (!isRefreshTokenRequestBody(req.body)) {
      res.status(400).json({
        success: false,
        message: 'Refresh token is required'
      });
      return;
    }

    const { refreshToken: refreshTokenValue } = req.body;

    const tokens = await refreshUserTokens(refreshTokenValue);

    res.status(200).json({
      success: true,
      message: 'Token refreshed successfully',
      data: {
        token: tokens.accessToken,
        refreshToken: tokens.refreshToken
      }
    });
  } catch (error) {
    if (error instanceof AppError) {
      res.status(error.statusCode).json({
        success: false,
        message: error.message
      });
    } else {
      res.status(500).json({
        success: false,
        message: 'Internal server error'
      });
    }
  }
}

export async function me(req: AuthenticatedRequest, res: Response): Promise<void> {
  try {
    if (req.user === undefined || req.user === null) {
      res.status(401).json({
        success: false,
        message: 'Authentication required'
      });
      return;
    }

    // Get full user details from database
    const User = (await import('../models/User')).default;
    const user = await User.findById(req.user.userId).select('-password');

    if (user === null || user === undefined) {
      res.status(404).json({
        success: false,
        message: 'User not found'
      });
      return;
    }

    res.status(200).json({
      success: true,
      data: {
        user: user
      }
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Internal server error'
    });
  }
} 