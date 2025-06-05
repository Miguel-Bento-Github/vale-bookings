import { Response } from 'express';
import UserService from '../services/UserService';
import { AppError, AuthenticatedRequest } from '../types';
import { validatePhoneNumber } from '../utils/validation';

export class UserController {
  private userService = UserService;

  async getProfile(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const userId = req.user?.userId;
      
      if (!userId) {
        res.status(401).json({
          success: false,
          message: 'Unauthorized'
        });
        return;
      }

      const user = await this.userService.findById(userId);
      
      if (!user) {
        res.status(401).json({
          success: false,
          message: 'User not found'
        });
        return;
      }

      res.status(200).json({
        success: true,
        data: user
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

  async updateProfile(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const userId = req.user?.userId;
      const requestBody = req.body;
      
      if (!userId) {
        res.status(401).json({
          success: false,
          message: 'Unauthorized'
        });
        return;
      }

      // Check if user is trying to update restricted fields
      if (requestBody.email || requestBody.role) {
        res.status(400).json({
          success: false,
          message: 'Email and role updates are not allowed through this endpoint'
        });
        return;
      }

      if (!requestBody.profile) {
        res.status(400).json({
          success: false,
          message: 'Profile data is required'
        });
        return;
      }

      const { profile } = requestBody;

      // Validate profile data
      if (profile.name && typeof profile.name !== 'string') {
        res.status(400).json({
          success: false,
          message: 'Name must be a string'
        });
        return;
      }

      if (profile.phone && !validatePhoneNumber(profile.phone)) {
        res.status(400).json({
          success: false,
          message: 'Invalid phone number format'
        });
        return;
      }

      const updatedUser = await this.userService.updateProfile(userId, { profile });

      if (!updatedUser) {
        res.status(401).json({
          success: false,
          message: 'User not found'
        });
        return;
      }

      res.status(200).json({
        success: true,
        message: 'Profile updated successfully',
        data: updatedUser
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

  async deleteAccount(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const userId = req.user?.userId;
      
      if (!userId) {
        res.status(401).json({
          success: false,
          message: 'Unauthorized'
        });
        return;
      }

      // Check if user exists before deletion
      const user = await this.userService.findById(userId);
      if (!user) {
        res.status(401).json({
          success: false,
          message: 'User not found'
        });
        return;
      }

      await this.userService.deleteUser(userId);

      res.status(200).json({
        success: true,
        message: 'Account deleted successfully'
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