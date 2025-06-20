import { Response } from 'express';

import { findById, updateProfile as updateUserProfile, deleteUser } from '../services/UserService';
import { AppError, AuthenticatedRequest, IUserProfile } from '../types';
import { validatePhoneNumber } from '../utils/validation';
import {
  sendSuccess,
  sendError,
  withErrorHandling
} from '../utils/responseHelpers';
import {
  validateAuthentication,
  validateRequiredString
} from '../utils/validationHelpers';

export const getProfile = withErrorHandling(async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  if (!validateAuthentication(req.user, res)) {
    return;
  }

  const user = await findById(req.user!.userId);

  if (!user) {
    sendError(res, 'User not found', 401);
    return;
  }

  sendSuccess(res, user);
});

export const updateProfile = withErrorHandling(async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  if (!validateAuthentication(req.user, res)) {
    return;
  }

  const requestBody = req.body as Record<string, unknown>;

  // Check if user is trying to update restricted fields
  if (typeof requestBody.email === 'string' || typeof requestBody.role === 'string') {
    sendError(res, 'Email and role updates are not allowed through this endpoint', 400);
    return;
  }

  if (typeof requestBody.profile !== 'object' || requestBody.profile === null) {
    sendError(res, 'Profile data is required', 400);
    return;
  }

  const profile = requestBody.profile as Record<string, unknown>;

  // Validate profile data
  if (typeof profile.name === 'string' && profile.name.trim().length === 0) {
    sendError(res, 'Name cannot be empty', 400);
    return;
  }

  if (typeof profile.name !== 'undefined' && typeof profile.name !== 'string') {
    sendError(res, 'Name must be a string', 400);
    return;
  }

  if (typeof profile.phone === 'string' && !validatePhoneNumber(profile.phone)) {
    sendError(res, 'Invalid phone number format', 400);
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
    sendError(res, 'No valid profile data provided', 400);
    return;
  }

  const updatedUser = await updateUserProfile(req.user!.userId, {
    profile: profileUpdate as IUserProfile
  });

  if (!updatedUser) {
    sendError(res, 'User not found', 401);
    return;
  }

  sendSuccess(res, updatedUser, 'Profile updated successfully');
});

export const deleteAccount = withErrorHandling(async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  if (!validateAuthentication(req.user, res)) {
    return;
  }

  // Check if user exists before deletion
  const user = await findById(req.user!.userId);
  if (!user) {
    sendError(res, 'User not found', 401);
    return;
  }

  await deleteUser(req.user!.userId);

  res.status(200).json({
    success: true,
    message: 'Account deleted successfully'
  });
}); 