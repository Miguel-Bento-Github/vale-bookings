import { Request, Response } from 'express';
import mongoose from 'mongoose';

import { getLocationById } from '../services/LocationService';
import {
  getLocationSchedules as getSchedulesForLocation,
  createSchedule as createNewSchedule,
  updateSchedule as updateExistingSchedule,
  getScheduleById as findScheduleById,
  deleteSchedule as deleteExistingSchedule
} from '../services/ScheduleService';
import { AppError, AuthenticatedRequest } from '../types';
import { validateTimeFormat } from '../utils/validation';


export async function getLocationSchedules(req: Request, res: Response): Promise<void> {
  try {
    const { locationId } = req.params;

    if (!locationId) {
      res.status(400).json({
        success: false,
        message: 'Location ID is required'
      });
      return;
    }

    // Validate MongoDB ObjectId format
    if (!mongoose.Types.ObjectId.isValid(locationId)) {
      res.status(400).json({
        success: false,
        message: 'Invalid ID format'
      });
      return;
    }

    // Check if location exists
    const location = await getLocationById(locationId);
    if (!location) {
      res.status(404).json({
        success: false,
        message: 'Location not found'
      });
      return;
    }

    const schedules = await getSchedulesForLocation(locationId);

    res.status(200).json({
      success: true,
      data: schedules
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

export async function createSchedule(req: AuthenticatedRequest, res: Response): Promise<void> {
  try {
    const userRole = req.user?.role;

    if (userRole !== 'ADMIN') {
      res.status(403).json({
        success: false,
        message: 'Forbidden: access denied'
      });
      return;
    }

    const requestBody = req.body as Record<string, unknown>;
    const locationId = requestBody.locationId;
    const dayOfWeek = requestBody.dayOfWeek;
    const startTime = requestBody.startTime;
    const endTime = requestBody.endTime;

    if (
      typeof locationId !== 'string' ||
      typeof dayOfWeek !== 'number' ||
      typeof startTime !== 'string' ||
      typeof endTime !== 'string'
    ) {
      res.status(400).json({
        success: false,
        message: 'Location ID, day of week, start time, and end time are required'
      });
      return;
    }

    if (dayOfWeek < 0 || dayOfWeek > 6) {
      res.status(400).json({
        success: false,
        message: 'Day of week must be between 0 (Sunday) and 6 (Saturday)'
      });
      return;
    }

    if (!validateTimeFormat(startTime) || !validateTimeFormat(endTime)) {
      res.status(400).json({
        success: false,
        message: 'Time must be in HH:MM format'
      });
      return;
    }

    // Validate time range - end time should be after start time
    const start = new Date(`1970-01-01T${startTime}:00`);
    const end = new Date(`1970-01-01T${endTime}:00`);

    if (end <= start) {
      res.status(400).json({
        success: false,
        message: 'End time must be after start time'
      });
      return;
    }

    // Check if location exists
    const location = await getLocationById(locationId);
    if (!location) {
      res.status(404).json({
        success: false,
        message: 'Location not found'
      });
      return;
    }

    const schedule = await createNewSchedule({
      locationId,
      dayOfWeek,
      startTime,
      endTime,
      isActive: true
    });

    res.status(201).json({
      success: true,
      message: 'Schedule created successfully',
      data: schedule
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

export async function updateSchedule(req: AuthenticatedRequest, res: Response): Promise<void> {
  try {
    const userRole = req.user?.role;

    if (userRole !== 'ADMIN') {
      res.status(403).json({
        success: false,
        message: 'Forbidden: access denied'
      });
      return;
    }

    const { id } = req.params;
    const requestBody = req.body as Record<string, unknown>;

    if (typeof id !== 'string') {
      res.status(400).json({
        success: false,
        message: 'Schedule ID is required'
      });
      return;
    }

    // Validate dayOfWeek if provided
    if (
      typeof requestBody.dayOfWeek === 'number' &&
      (requestBody.dayOfWeek < 0 || requestBody.dayOfWeek > 6)
    ) {
      res.status(400).json({
        success: false,
        message: 'Day of week must be between 0 (Sunday) and 6 (Saturday)'
      });
      return;
    }

    // Validate startTime if provided
    if (
      typeof requestBody.startTime === 'string' &&
      !validateTimeFormat(requestBody.startTime)
    ) {
      res.status(400).json({
        success: false,
        message: 'Start time must be in HH:MM format'
      });
      return;
    }

    // Validate endTime if provided
    if (
      typeof requestBody.endTime === 'string' &&
      !validateTimeFormat(requestBody.endTime)
    ) {
      res.status(400).json({
        success: false,
        message: 'End time must be in HH:MM format'
      });
      return;
    }

    // Build update data with proper typing
    const updateData: Record<string, unknown> = {};
    if (typeof requestBody.dayOfWeek === 'number') {
      updateData.dayOfWeek = requestBody.dayOfWeek;
    }
    if (typeof requestBody.startTime === 'string') {
      updateData.startTime = requestBody.startTime;
    }
    if (typeof requestBody.endTime === 'string') {
      updateData.endTime = requestBody.endTime;
    }
    if (typeof requestBody.isActive === 'boolean') {
      updateData.isActive = requestBody.isActive;
    }

    const schedule = await updateExistingSchedule(id, updateData);

    if (!schedule) {
      res.status(404).json({
        success: false,
        message: 'Schedule not found'
      });
      return;
    }

    res.status(200).json({
      success: true,
      message: 'Schedule updated successfully',
      data: schedule
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

export async function deleteSchedule(req: AuthenticatedRequest, res: Response): Promise<void> {
  try {
    const userRole = req.user?.role;

    if (userRole !== 'ADMIN') {
      res.status(403).json({
        success: false,
        message: 'Forbidden: access denied'
      });
      return;
    }

    const { id } = req.params;

    if (!id) {
      res.status(400).json({
        success: false,
        message: 'Schedule ID is required'
      });
      return;
    }

    // Check if schedule exists before deletion
    const schedule = await findScheduleById(id);

    if (!schedule) {
      res.status(404).json({
        success: false,
        message: 'Schedule not found'
      });
      return;
    }

    await deleteExistingSchedule(id);

    res.status(200).json({
      success: true,
      message: 'Schedule deleted successfully'
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