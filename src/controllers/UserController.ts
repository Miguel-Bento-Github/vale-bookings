import { Response } from 'express';

import { findById, updateProfile as updateUserProfile, deleteUser } from '../services/UserService';
import { AppError, AuthenticatedRequest, IUserProfile } from '../types';
import { validatePhoneNumber } from '../utils/validation';

export async function getProfile(req: AuthenticatedRequest, res: Response): Promise<void> {
  try {
    const userId = req.user?.userId;

    if (typeof userId !== 'string') {
      res.status(401).json({
        success: false,
        message: 'Unauthorized'
      });
      return;
    }

    const user = await findById(userId);

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

export async function updateProfile(req: AuthenticatedRequest, res: Response): Promise<void> {
  try {
    const userId = req.user?.userId;
    const requestBody = req.body as Record<string, unknown>;

    if (typeof userId !== 'string') {
      res.status(401).json({
        success: false,
        message: 'Unauthorized'
      });
      return;
    }

    // Check if user is trying to update restricted fields
    if (typeof requestBody.email === 'string' || typeof requestBody.role === 'string') {
      res.status(400).json({
        success: false,
        message: 'Email and role updates are not allowed through this endpoint'
      });
      return;
    }

    if (typeof requestBody.profile !== 'object' || requestBody.profile === null) {
      res.status(400).json({
        success: false,
        message: 'Profile data is required'
      });
      return;
    }

    const profile = requestBody.profile as Record<string, unknown>;

    // Validate profile data
    if (typeof profile.name === 'string' && profile.name.trim().length === 0) {
      res.status(400).json({
        success: false,
        message: 'Name cannot be empty'
      });
      return;
    }

    if (typeof profile.name !== 'undefined' && typeof profile.name !== 'string') {
      res.status(400).json({
        success: false,
        message: 'Name must be a string'
      });
      return;
    }

    if (typeof profile.phone === 'string' && !validatePhoneNumber(profile.phone)) {
      res.status(400).json({
        success: false,
        message: 'Invalid phone number format'
      });
      return;
    }

    const profileUpdate: Partial<IUserProfile> = {};
    if (typeof profile.name === 'string') {
      profileUpdate.name = profile.name;
    }
    if (typeof profile.phone === 'string') {
      profileUpdate.phone = profile.phone;
    }

    // Only update if we have valid profile data
    if (Object.keys(profileUpdate).length === 0) {
      res.status(400).json({
        success: false,
        message: 'No valid profile data provided'
      });
      return;
    }

    const updatedUser = await updateUserProfile(userId, {
      profile: profileUpdate as IUserProfile
    });

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

export async function deleteAccount(req: AuthenticatedRequest, res: Response): Promise<void> {
  try {
    const userId = req.user?.userId;

    if (typeof userId !== 'string') {
      res.status(401).json({
        success: false,
        message: 'Unauthorized'
      });
      return;
    }

    // Check if user exists before deletion
    const user = await findById(userId);
    if (!user) {
      res.status(401).json({
        success: false,
        message: 'User not found'
      });
      return;
    }

    await deleteUser(userId);

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