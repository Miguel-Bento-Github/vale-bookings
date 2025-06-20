import { Request, Response } from 'express';

import { getLocationById } from '../services/LocationService';
import { 
  getLocationSchedules as getSchedulesForLocation,
  createSchedule as createNewSchedule,
  updateSchedule as updateExistingSchedule,
  getScheduleById as findScheduleById,
  deleteSchedule as deleteExistingSchedule
} from '../services/ScheduleService';
import { AuthenticatedRequest } from '../types';
import {
  standardUpdate,
  deactivateDocument
} from '../utils/mongoHelpers';
import {
  sendSuccess, 
  sendError,
  withErrorHandling
} from '../utils/responseHelpers';
import { validateTimeFormat } from '../utils/validation';
import { 
  validateRequiredId,
  validateAuthentication
} from '../utils/validationHelpers';

export const getLocationSchedules = withErrorHandling(async (req: Request, res: Response): Promise<void> => {
  if (!validateRequiredId(req.params.locationId, res, 'Location ID')) {
    return;
  }

  // Check if location exists
  const location = await getLocationById(req.params.locationId!);
  if (!location) {
    sendError(res, 'Location not found', 404);
    return;
  }

  const schedules = await getSchedulesForLocation(req.params.locationId!);
  sendSuccess(res, schedules);
});

export const createSchedule = withErrorHandling(async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  if (!validateAuthentication(req.user, res)) {
    return;
  }

  if (req.user!.role !== 'ADMIN') {
    sendError(res, 'Forbidden: access denied', 403);
    return;
  }

  const requestBody = req.body as Record<string, unknown>;
  const { locationId, dayOfWeek, startTime, endTime } = requestBody;

  if (
    typeof locationId !== 'string' ||
    typeof dayOfWeek !== 'number' ||
    typeof startTime !== 'string' ||
    typeof endTime !== 'string'
  ) {
    sendError(res, 'Location ID, day of week, start time, and end time are required', 400);
    return;
  }

  if (dayOfWeek < 0 || dayOfWeek > 6) {
    sendError(res, 'Day of week must be between 0 (Sunday) and 6 (Saturday)', 400);
    return;
  }

  if (!validateTimeFormat(startTime) || !validateTimeFormat(endTime)) {
    sendError(res, 'Time must be in HH:MM format', 400);
    return;
  }

  // Validate time range - end time should be after start time
  const start = new Date(`1970-01-01T${startTime}:00`);
  const end = new Date(`1970-01-01T${endTime}:00`);

  if (end <= start) {
    sendError(res, 'End time must be after start time', 400);
    return;
  }

  // Check if location exists
  const location = await getLocationById(locationId);
  if (!location) {
    sendError(res, 'Location not found', 404);
    return;
  }

  const schedule = await createNewSchedule({
    locationId,
    dayOfWeek,
    startTime,
    endTime,
    isActive: true
  });

  sendSuccess(res, schedule, 'Schedule created successfully', 201);
});

export const updateSchedule = withErrorHandling(async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  if (!validateAuthentication(req.user, res)) {
    return;
  }

  if (req.user!.role !== 'ADMIN') {
    sendError(res, 'Forbidden: access denied', 403);
    return;
  }

  if (!validateRequiredId(req.params.id, res, 'Schedule ID')) {
    return;
  }

  const requestBody = req.body as Record<string, unknown>;

  // Validate dayOfWeek if provided
  if (
    typeof requestBody.dayOfWeek === 'number' &&
    (requestBody.dayOfWeek < 0 || requestBody.dayOfWeek > 6)
  ) {
    sendError(res, 'Day of week must be between 0 (Sunday) and 6 (Saturday)', 400);
    return;
  }

  // Validate time formats if provided
  if (
    (typeof requestBody.startTime === 'string' && !validateTimeFormat(requestBody.startTime)) ||
    (typeof requestBody.endTime === 'string' && !validateTimeFormat(requestBody.endTime))
  ) {
    sendError(res, 'Time must be in HH:MM format', 400);
    return;
  }

  // Validate time range if both times are provided
  if (typeof requestBody.startTime === 'string' && typeof requestBody.endTime === 'string') {
    const start = new Date(`1970-01-01T${requestBody.startTime}:00`);
    const end = new Date(`1970-01-01T${requestBody.endTime}:00`);

    if (end <= start) {
      sendError(res, 'End time must be after start time', 400);
      return;
    }
  }

  // Check if schedule exists
  const existingSchedule = await findScheduleById(req.params.id!);
  if (!existingSchedule) {
    sendError(res, 'Schedule not found', 404);
    return;
  }

  const updatedSchedule = await updateExistingSchedule(req.params.id!, requestBody);
  sendSuccess(res, updatedSchedule, 'Schedule updated successfully');
});

export const deleteSchedule = withErrorHandling(async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  if (!validateAuthentication(req.user, res)) {
    return;
  }

  if (req.user!.role !== 'ADMIN') {
    sendError(res, 'Forbidden: access denied', 403);
    return;
  }

  if (!validateRequiredId(req.params.id, res, 'Schedule ID')) {
    return;
  }

  // Check if schedule exists
  const schedule = await findScheduleById(req.params.id!);
  if (!schedule) {
    sendError(res, 'Schedule not found', 404);
    return;
  }

  await deleteExistingSchedule(req.params.id!);

  res.status(200).json({
    success: true,
    message: 'Schedule deleted successfully'
  });
}); 