import { Request, Response } from 'express';
import AuthService from '../services/AuthService';
import { AppError } from '../types';
import { validateEmail, validatePassword } from '../utils/validation';

export class AuthController {
  private authService = AuthService;

  async register(req: Request, res: Response): Promise<void> {
    try {
      const { email, password, profile, role } = req.body;

      // Validation
      if (!email || !password || !profile) {
        res.status(400).json({
          success: false,
          message: 'Email, password, and profile are required'
        });
        return;
      }

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

      if (!profile.name) {
        res.status(400).json({
          success: false,
          message: 'Profile name is required'
        });
        return;
      }

      const result = await this.authService.register({ email, password, profile, role });

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

  async login(req: Request, res: Response): Promise<void> {
    try {
      const { email, password } = req.body;

      if (!email || !password) {
        res.status(400).json({
          success: false,
          message: 'Email and password are required'
        });
        return;
      }

      // Validate email format before attempting authentication
      if (!validateEmail(email)) {
        res.status(400).json({
          success: false,
          message: 'Invalid email format'
        });
        return;
      }

      const result = await this.authService.login({ email, password });

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

  async refreshToken(req: Request, res: Response): Promise<void> {
    try {
      const { refreshToken } = req.body;

      if (!refreshToken) {
        res.status(400).json({
          success: false,
          message: 'Refresh token is required'
        });
        return;
      }

      const tokens = await this.authService.refreshTokens(refreshToken);

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
} 