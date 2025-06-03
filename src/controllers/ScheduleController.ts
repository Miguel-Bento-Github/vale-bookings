import { Request, Response } from 'express';
import ScheduleService from '../services/ScheduleService';
import { AppError, AuthenticatedRequest } from '../types';
import { validateTimeFormat } from '../utils/validation';

export class ScheduleController {
  private scheduleService = ScheduleService;

  async getLocationSchedules(req: Request, res: Response): Promise<void> {
    try {
      const { locationId } = req.params;

      const schedules = await this.scheduleService.getLocationSchedules(locationId);

      res.status(200).json({
        success: true,
        data: { schedules }
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

  async createSchedule(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const userRole = req.user?.role;

      if (userRole !== 'ADMIN') {
        res.status(403).json({
          success: false,
          message: 'Forbidden: Admin access required'
        });
        return;
      }

      const { locationId, dayOfWeek, startTime, endTime } = req.body;

      if (!locationId || dayOfWeek === undefined || !startTime || !endTime) {
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

      const schedule = await this.scheduleService.createSchedule({
        locationId,
        dayOfWeek,
        startTime,
        endTime,
        isActive: true
      });

      res.status(201).json({
        success: true,
        message: 'Schedule created successfully',
        data: { schedule }
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

  async updateSchedule(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const userRole = req.user?.role;

      if (userRole !== 'ADMIN') {
        res.status(403).json({
          success: false,
          message: 'Forbidden: Admin access required'
        });
        return;
      }

      const { id } = req.params;
      const updateData = req.body;

      if (updateData.dayOfWeek !== undefined && (updateData.dayOfWeek < 0 || updateData.dayOfWeek > 6)) {
        res.status(400).json({
          success: false,
          message: 'Day of week must be between 0 (Sunday) and 6 (Saturday)'
        });
        return;
      }

      if (updateData.startTime && !validateTimeFormat(updateData.startTime)) {
        res.status(400).json({
          success: false,
          message: 'Start time must be in HH:MM format'
        });
        return;
      }

      if (updateData.endTime && !validateTimeFormat(updateData.endTime)) {
        res.status(400).json({
          success: false,
          message: 'End time must be in HH:MM format'
        });
        return;
      }

      const schedule = await this.scheduleService.updateSchedule(id, updateData);

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
        data: { schedule }
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

  async deleteSchedule(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const userRole = req.user?.role;

      if (userRole !== 'ADMIN') {
        res.status(403).json({
          success: false,
          message: 'Forbidden: Admin access required'
        });
        return;
      }

      const { id } = req.params;

      await this.scheduleService.deleteSchedule(id);

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
} 