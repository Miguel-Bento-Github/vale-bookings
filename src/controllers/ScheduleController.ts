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

export const getLocationSchedules = withErrorHandling(async (req: Request, res: Response): Promise<void> => {
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
  if (!location) {
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

  const { locationId, dayOfWeek, startTime, endTime } = req.body;

  // Validate required fields
  if (!locationId || dayOfWeek === undefined || !startTime || !endTime) {
    sendError(res, 'Location ID, day of week, start time, and end time are required', 400);
    return;
  }

  // Validate day of week (0-6, Sunday-Saturday)
  if (typeof dayOfWeek !== 'number' || dayOfWeek < 0 || dayOfWeek > 6) {
    sendError(res, 'Day of week must be between 0 (Sunday) and 6 (Saturday)', 400);
    return;
  }

  // Validate time format
  if (!validateTimeFormat(startTime) || !validateTimeFormat(endTime)) {
    sendError(res, 'Time must be in HH:MM format', 400);
    return;
  }

  // Validate time range
  const startHour = parseInt(startTime.split(':')[0]);
  const startMinute = parseInt(startTime.split(':')[1]);
  const endHour = parseInt(endTime.split(':')[0]);
  const endMinute = parseInt(endTime.split(':')[1]);

  const startTotalMinutes = startHour * 60 + startMinute;
  const endTotalMinutes = endHour * 60 + endMinute;

  if (endTotalMinutes <= startTotalMinutes) {
    sendError(res, 'End time must be after start time', 400);
    return;
  }

  // Check if location exists
  const location = await getLocationById(locationId);
  if (!location) {
    sendError(res, 'Location not found', 404);
    return;
  }

  const schedule = await createNewSchedule(req.body);
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

  const { dayOfWeek, startTime, endTime } = req.body;

  // Validate day of week if provided
  if (dayOfWeek !== undefined && (typeof dayOfWeek !== 'number' || dayOfWeek < 0 || dayOfWeek > 6)) {
    sendError(res, 'Day of week must be between 0 (Sunday) and 6 (Saturday)', 400);
    return;
  }

  // Validate time format if provided
  if (startTime && !validateTimeFormat(startTime)) {
    sendError(res, 'Time must be in HH:MM format', 400);
    return;
  }

  if (endTime && !validateTimeFormat(endTime)) {
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
  if (!existingSchedule) {
    sendError(res, 'Schedule not found', 404);
    return;
  }

  const schedule = await updateExistingSchedule(scheduleId, req.body);
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
  if (!existingSchedule) {
    sendError(res, 'Schedule not found', 404);
    return;
  }

  await deleteExistingSchedule(scheduleId);
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

  const schedule = await findScheduleById(scheduleId);
  if (!schedule) {
    sendError(res, 'Schedule not found', 404);
    return;
  }

  sendSuccess(res, schedule);
}); 