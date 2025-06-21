import { Response } from 'express';

import { findById, updateProfile as updateUserProfile, deleteUser } from '../services/UserService';
import { AuthenticatedRequest, IUserProfile } from '../types';
import {
  sendSuccess,
  sendError,
  withErrorHandling
} from '../utils/responseHelpers';
import { validatePhoneNumber } from '../utils/validation';
import { ERROR_MESSAGES } from '../utils/validationHelpers';

export const getProfile = withErrorHandling(async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  const userId = req.user?.userId;
  if (userId === undefined || userId.trim().length === 0) {
    sendError(res, 'Unauthorized', 401);
    return;
  }

  const user = await findById(userId);

  if (user === null) {
    sendError(res, ERROR_MESSAGES.USER_NOT_FOUND, 401);
    return;
  }

  sendSuccess(res, user);
});

export const updateProfile = withErrorHandling(async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  const userId = req.user?.userId;
  if (userId === undefined || userId.trim().length === 0) {
    sendError(res, 'Unauthorized', 401);
    return;
  }

  const requestBody = req.body as Record<string, unknown>;

  // Check if user is trying to update restricted fields
  if (typeof requestBody.email === 'string' || typeof requestBody.role === 'string') {
    sendError(res, 'Email and role updates are not allowed through this endpoint', 400);
    return;
  }

  if (typeof requestBody.profile !== 'object' || requestBody.profile === null) {
    sendError(res, ERROR_MESSAGES.PROFILE_DATA_REQUIRED, 400);
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
    sendError(res, ERROR_MESSAGES.INVALID_PHONE_FORMAT, 400);
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

  const updatedUser = await updateUserProfile(userId, {
    profile: profileUpdate as IUserProfile
  });

  if (updatedUser === null) {
    sendError(res, ERROR_MESSAGES.USER_NOT_FOUND, 401);
    return;
  }

  sendSuccess(res, updatedUser, 'Profile updated successfully');
});

export const deleteAccount = withErrorHandling(async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  const userId = req.user?.userId;
  if (userId === undefined || userId.trim().length === 0) {
    sendError(res, 'Unauthorized', 401);
    return;
  }

  // Check if user exists before deletion
  const user = await findById(userId);
  if (user === null) {
    sendError(res, ERROR_MESSAGES.USER_NOT_FOUND, 401);
    return;
  }

  await deleteUser(userId);

  res.status(200).json({
    success: true,
    message: 'Account deleted successfully'
  });
}); 