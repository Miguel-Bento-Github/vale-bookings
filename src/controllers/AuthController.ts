import { compare, hash } from 'bcryptjs';
import { Request, Response } from 'express';

import User from '../models/User';
import * as AuthService from '../services/AuthService';
import { AuthenticatedRequest, AppError } from '../types';
import { 
  withErrorHandling, 
  sendSuccess, 
  sendError
} from '../utils/responseHelpers';
import { 
  validateRequiredId,
  ERROR_MESSAGES
} from '../utils/validationHelpers';

interface RegisterRequestBody {
  email: string;
  password: string;
  profile: {
    name: string;
    phone?: string;
  };
  role?: string;
}

interface LoginRequestBody {
  email: string;
  password: string;
}

interface ChangePasswordRequestBody {
  currentPassword: string;
  newPassword: string;
}

interface RefreshTokenRequestBody {
  refreshToken: string;
}

// RefreshTokenBody interface removed as it's not used

class AuthController {
  register = withErrorHandling(async (req: Request, res: Response): Promise<void> => {
    const { email, password, profile, role } = req.body as RegisterRequestBody;

    // Validation to match test expectations
    if (email === undefined || password === undefined || profile === undefined) {
      sendError(res, 'Email, password, and profile are required', 400);
      return;
    }

    if (profile?.name === undefined || profile.name.trim().length === 0) {
      sendError(res, ERROR_MESSAGES.PROFILE_NAME_REQUIRED, 400);
      return;
    }

    // Enhanced email format validation for test requirements
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email) || email.length > 64 || email.includes(' ')) {
      sendError(res, ERROR_MESSAGES.INVALID_EMAIL_FORMAT, 400);
      return;
    }

    // Password length validation
    if (password.length < 6) {
      sendError(res, 'password must be at least 6 characters long', 400);
      return;
    }

    try {
      // Use AuthService as expected by tests, include role if provided
      const registerData = { email, password, profile };
      if (role !== undefined && typeof role === 'string' && role.trim().length > 0) {
        (registerData as typeof registerData & { role: string }).role = role;
      }

      const result = await AuthService.register(registerData);

      sendSuccess(res, {
        user: result.user,
        token: result.tokens.accessToken,
        refreshToken: result.tokens.refreshToken
      }, 'User registered successfully', 201);
    } catch (error: unknown) {
      if (error instanceof AppError && error.message === 'Email already exists') {
        sendError(res, error.message, 409);
        return;
      }
      throw error; // Let withErrorHandling handle other errors
    }
  });

  login = withErrorHandling(async (req: Request, res: Response) => {
    const { email, password } = req.body as LoginRequestBody;

    // Validation to match test expectations
    if (email === undefined || email.trim().length === 0 || password === undefined || password.trim().length === 0) {
      sendError(res, 'Email and password are required', 400);
      return;
    }

    // Email format validation
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      sendError(res, ERROR_MESSAGES.INVALID_EMAIL_FORMAT, 400);
      return;
    }

    // Use AuthService as expected by tests
    const result = await AuthService.login({ email, password });

    sendSuccess(res, {
      user: result.user,
      token: result.tokens.accessToken,
      refreshToken: result.tokens.refreshToken
    }, 'Login successful');
  });

  refreshToken = withErrorHandling(async (req: Request, res: Response) => {
    const { refreshToken } = req.body as RefreshTokenRequestBody;

    // More permissive validation - only check if completely missing
    if (refreshToken === undefined || refreshToken === null || typeof refreshToken !== 'string') {
      sendError(res, ERROR_MESSAGES.REFRESH_TOKEN_REQUIRED, 400);
      return;
    }

    try {
      // Use AuthService to refresh token
      const tokens = await AuthService.refreshTokens(refreshToken);

      sendSuccess(res, {
        token: tokens.accessToken,
        refreshToken: tokens.refreshToken
      }, 'Token refreshed successfully');
    } catch (error: unknown) {
      if (error instanceof AppError) {
        if (error.message.includes('Invalid refresh token')) {
          sendError(res, 'Invalid refresh token', 401);
          return;
        }
        if (error.message.includes('User not found')) {
          sendError(res, 'Invalid refresh token', 401);
          return;
        }
      }
      throw error; // Let withErrorHandling handle other errors
    }
  });

  me = withErrorHandling(async (req: AuthenticatedRequest, res: Response) => {
    const userId = req.user?.userId;
    if (userId === undefined || userId.trim().length === 0) {
      sendError(res, 'User authentication required', 401);
      return;
    }

    const user = await User.findById(userId);
    if (user === null) {
      sendError(res, 'User not found', 401);
      return;
    }

    // Return user in the expected format for tests
    sendSuccess(res, {
      user: {
        _id: String(user._id),
        email: user.email,
        role: user.role,
        profile: user.profile
      }
    });
  });

  changePassword = withErrorHandling(async (req: AuthenticatedRequest, res: Response) => {
    const userId = req.user?.userId;
    if (userId === undefined || userId.trim().length === 0) {
      sendError(res, 'User authentication required', 401);
      return;
    }

    const { currentPassword, newPassword } = req.body as ChangePasswordRequestBody;

    const user = await User.findById(userId).select('+password');
    if (user === null) {
      sendError(res, 'User not found', 401);
      return;
    }

    // Verify current password
    const isCurrentPasswordValid = await compare(currentPassword, user.password);
    if (!isCurrentPasswordValid) {
      sendError(res, 'Current password is incorrect', 400);
      return;
    }

    // Hash new password
    const hashedNewPassword = await hash(newPassword, 12);
    user.password = hashedNewPassword;
    await user.save();

    sendSuccess(res, undefined, 'Password changed successfully');
  });

  deleteAccount = withErrorHandling(async (req: AuthenticatedRequest, res: Response) => {
    const userId = req.user?.userId;
    if (userId === undefined || userId.trim().length === 0) {
      sendError(res, 'User authentication required', 401);
      return;
    }

    await User.findByIdAndDelete(userId);
    sendSuccess(res, undefined, 'Account deleted successfully');
  });

  // Admin methods
  getAllUsers = withErrorHandling(async (req: Request, res: Response) => {
    const users = await User.find({}, '-password');
    sendSuccess(res, users);
  });

  deleteUser = withErrorHandling(async (req: Request, res: Response) => {
    if (!validateRequiredId(req.params.id, res, 'User ID')) {
      return;
    }

    const userId = req.params.id;
    if (userId === undefined) {
      sendError(res, 'User ID is required', 400);
      return;
    }

    await User.findByIdAndDelete(userId);
    sendSuccess(res, undefined, 'User deleted successfully');
  });
}

export default new AuthController();

// Export individual methods for backward compatibility with tests
const authController = new AuthController();
export const register = authController.register;
export const login = authController.login;
export const refreshToken = authController.refreshToken;
export const me = authController.me;
export const changePassword = authController.changePassword;
export const deleteAccount = authController.deleteAccount;
export const getAllUsers = authController.getAllUsers;
export const deleteUser = authController.deleteUser; 