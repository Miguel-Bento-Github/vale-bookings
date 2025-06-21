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
// Removed unused mongoHelpers imports
import {
  sendSuccess, 
  sendError,
  withErrorHandling
} from '../utils/responseHelpers';
import { validateTimeFormat } from '../utils/validation';
import { 
  validateRequiredId
} from '../utils/validationHelpers';

export const getSchedulesByLocation = withErrorHandling(async (req: Request, res: Response): Promise<void> => {
  if (!validateRequiredId(req.params.locationId, res, 'Location ID')) {
    return;
  }

  // Check if location exists
  const locationId = req.params.locationId;
  if (!locationId) {
    sendError(res, 'Location ID is required', 400);
    return;
  }

  const location = await getLocationById(locationId);
  if (location === null) {
    sendError(res, 'Location not found', 404);
    return;
  }

  const schedules = await getSchedulesForLocation(locationId);
  sendSuccess(res, schedules);
});

export const createSchedule = withErrorHandling(async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  // Check authentication and admin role
  const userId = req.user?.userId;
  if (!userId || userId.trim().length === 0) {
    sendError(res, 'User authentication required', 401);
    return;
  }

  if (req.user?.role !== 'ADMIN') {
    sendError(res, 'Forbidden: access denied', 403);
    return;
  }

  // Type the request body safely
  const requestBody = req.body as Record<string, unknown>;
  const { locationId, dayOfWeek, startTime, endTime } = requestBody;

  // Validate required fields with proper type checking
  if (typeof locationId !== 'string' ||
    typeof dayOfWeek !== 'number' ||
    typeof startTime !== 'string' ||
    typeof endTime !== 'string') {
    sendError(res, 'Location ID, day of week, start time, and end time are required', 400);
    return;
  }

  // Validate day of week (0-6, Sunday-Saturday)
  if (dayOfWeek < 0 || dayOfWeek > 6) {
    sendError(res, 'Day of week must be between 0 (Sunday) and 6 (Saturday)', 400);
    return;
  }

  // Validate time format
  if (!validateTimeFormat(startTime) || !validateTimeFormat(endTime)) {
    sendError(res, 'Time must be in HH:MM format', 400);
    return;
  }

  // Validate time range with proper string handling
  const startParts = startTime.split(':');
  const endParts = endTime.split(':');

  if (startParts.length !== 2 || endParts.length !== 2) {
    sendError(res, 'Invalid time format', 400);
    return;
  }

  const startHour = parseInt(startParts[0], 10);
  const startMinute = parseInt(startParts[1], 10);
  const endHour = parseInt(endParts[0], 10);
  const endMinute = parseInt(endParts[1], 10);

  const startTotalMinutes = startHour * 60 + startMinute;
  const endTotalMinutes = endHour * 60 + endMinute;

  if (endTotalMinutes <= startTotalMinutes) {
    sendError(res, 'End time must be after start time', 400);
    return;
  }

  // Check if location exists
  const location = await getLocationById(locationId);
  if (location === null) {
    sendError(res, 'Location not found', 404);
    return;
  }

  const schedule = await createNewSchedule(requestBody);
  sendSuccess(res, schedule, 'Schedule created successfully', 201);
});

export const updateSchedule = withErrorHandling(async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  // Check authentication and admin role
  const userId = req.user?.userId;
  if (!userId || userId.trim().length === 0) {
    sendError(res, 'User authentication required', 401);
    return;
  }

  if (req.user?.role !== 'ADMIN') {
    sendError(res, 'Forbidden: access denied', 403);
    return;
  }

  if (!validateRequiredId(req.params.id, res, 'Schedule ID')) {
    return;
  }

  // Type the request body safely
  const requestBody = req.body as Record<string, unknown>;
  const { dayOfWeek, startTime, endTime } = requestBody;

  // Validate day of week if provided
  if (dayOfWeek !== undefined && (typeof dayOfWeek !== 'number' || dayOfWeek < 0 || dayOfWeek > 6)) {
    sendError(res, 'Day of week must be between 0 (Sunday) and 6 (Saturday)', 400);
    return;
  }

  // Validate time format if provided
  if (typeof startTime === 'string' && !validateTimeFormat(startTime)) {
    sendError(res, 'Time must be in HH:MM format', 400);
    return;
  }

  if (typeof endTime === 'string' && !validateTimeFormat(endTime)) {
    sendError(res, 'Time must be in HH:MM format', 400);
    return;
  }

  // Check if schedule exists
  const scheduleId = req.params.id;
  if (!scheduleId) {
    sendError(res, 'Schedule ID is required', 400);
    return;
  }

  const existingSchedule = await findScheduleById(scheduleId);
  if (existingSchedule === null) {
    sendError(res, 'Schedule not found', 404);
    return;
  }

  const schedule = await updateExistingSchedule(scheduleId as string, requestBody);
  sendSuccess(res, schedule, 'Schedule updated successfully');
});

export const deleteSchedule = withErrorHandling(async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  // Check authentication and admin role
  const userId = req.user?.userId;
  if (!userId || userId.trim().length === 0) {
    sendError(res, 'User authentication required', 401);
    return;
  }

  if (req.user?.role !== 'ADMIN') {
    sendError(res, 'Forbidden: access denied', 403);
    return;
  }

  if (!validateRequiredId(req.params.id, res, 'Schedule ID')) {
    return;
  }

  // Check if schedule exists
  const scheduleId = req.params.id;
  if (!scheduleId) {
    sendError(res, 'Schedule ID is required', 400);
    return;
  }

  const existingSchedule = await findScheduleById(scheduleId);
  if (existingSchedule === null) {
    sendError(res, 'Schedule not found', 404);
    return;
  }

  await deleteExistingSchedule(scheduleId as string);
  sendSuccess(res, undefined, 'Schedule deleted successfully');
});

export const getScheduleById = withErrorHandling(async (req: Request, res: Response): Promise<void> => {
  if (!validateRequiredId(req.params.id, res, 'Schedule ID')) {
    return;
  }

  const scheduleId = req.params.id;
  if (!scheduleId) {
    sendError(res, 'Schedule ID is required', 400);
    return;
  }

  const schedule = await findScheduleById(scheduleId as string);
  if (schedule === null) {
    sendError(res, 'Schedule not found', 404);
    return;
  }

  sendSuccess(res, schedule);
}); 