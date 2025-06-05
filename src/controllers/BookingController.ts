import { Response } from 'express';
import BookingService from '../services/BookingService';
import { AppError, AuthenticatedRequest, BookingStatus } from '../types';

export class BookingController {
  private bookingService = BookingService;

  async getUserBookings(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const userId = req.user?.userId;

      if (!userId) {
        res.status(401).json({
          success: false,
          message: 'Unauthorized'
        });
        return;
      }

      const page = parseInt(req.query?.page as string) || 1;
      const limit = parseInt(req.query?.limit as string) || 10;

      const bookings = await this.bookingService.getUserBookings(userId, page, limit);

      res.status(200).json({
        success: true,
        data: bookings
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

  async getBookingById(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const userId = req.user?.userId;
      const { id } = req.params;

      if (!userId) {
        res.status(401).json({
          success: false,
          message: 'Unauthorized'
        });
        return;
      }

      const booking = await this.bookingService.findById(id!);

      if (!booking) {
        res.status(404).json({
          success: false,
          message: 'Booking not found'
        });
        return;
      }

      // Check if user owns the booking or is admin
      if (booking.userId.toString() !== userId && req.user?.role !== 'ADMIN') {
        res.status(403).json({
          success: false,
          message: 'Forbidden: access denied'
        });
        return;
      }

      res.status(200).json({
        success: true,
        data: booking
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

  async createBooking(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const userId = req.user?.userId;

      if (!userId) {
        res.status(401).json({
          success: false,
          message: 'Unauthorized'
        });
        return;
      }

      const { locationId, startTime, endTime, notes } = req.body;

      if (!locationId || !startTime || !endTime) {
        res.status(400).json({
          success: false,
          message: 'Location ID, start time, and end time are required'
        });
        return;
      }

      // Calculate price based on duration (example: $10 per hour)
      const start = new Date(startTime);
      const end = new Date(endTime);
      
      // Validate time range
      if (end <= start) {
        res.status(400).json({
          success: false,
          message: 'End time must be after start time'
        });
        return;
      }

      // Validate not in the past
      const now = new Date();
      if (start < now) {
        res.status(400).json({
          success: false,
          message: 'Cannot create booking in the past'
        });
        return;
      }

      const hours = (end.getTime() - start.getTime()) / (1000 * 60 * 60);
      const calculatedPrice = Math.max(hours * 10, 10); // Minimum $10

      const booking = await this.bookingService.createBooking({
        userId,
        locationId,
        startTime: start,
        endTime: end,
        price: calculatedPrice,
        notes: notes || '',
        status: 'PENDING'
      });

      res.status(201).json({
        success: true,
        message: 'Booking created successfully',
        data: booking
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

  async updateBookingStatus(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const userId = req.user?.userId;
      const userRole = req.user?.role;
      const { id } = req.params;
      const { status } = req.body;

      if (!userId) {
        res.status(401).json({
          success: false,
          message: 'Unauthorized'
        });
        return;
      }

      if (!status) {
        res.status(400).json({
          success: false,
          message: 'Status is required'
        });
        return;
      }

      // Validate status value
      const validStatuses = ['PENDING', 'CONFIRMED', 'IN_PROGRESS', 'COMPLETED', 'CANCELLED'];
      if (!validStatuses.includes(status)) {
        res.status(400).json({
          success: false,
          message: 'Invalid status value'
        });
        return;
      }

      // Only admins and valets can update booking status, not regular customers
      if (userRole !== 'ADMIN' && userRole !== 'VALET') {
        res.status(403).json({
          success: false,
          message: 'Forbidden: access denied'
        });
        return;
      }

      const booking = await this.bookingService.findById(id!);

      if (!booking) {
        res.status(404).json({
          success: false,
          message: 'Booking not found'
        });
        return;
      }

      const updatedBooking = await this.bookingService.updateBookingStatus(id!, status as BookingStatus);

      res.status(200).json({
        success: true,
        message: 'Booking status updated successfully',
        data: updatedBooking
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

  async cancelBooking(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const userId = req.user?.userId;
      const userRole = req.user?.role;
      const { id } = req.params;

      if (!userId) {
        res.status(401).json({
          success: false,
          message: 'Unauthorized'
        });
        return;
      }

      const booking = await this.bookingService.findById(id!);

      if (!booking) {
        res.status(404).json({
          success: false,
          message: 'Booking not found'
        });
        return;
      }

      // Check if user owns the booking or is admin
      if (booking.userId.toString() !== userId && userRole !== 'ADMIN') {
        res.status(403).json({
          success: false,
          message: 'Forbidden: access denied'
        });
        return;
      }

      // Check if booking is already completed and cannot be cancelled
      if (booking.status === 'COMPLETED') {
        res.status(400).json({
          success: false,
          message: 'Booking has been completed and cannot be cancelled'
        });
        return;
      }

      await this.bookingService.cancelBooking(id!);

      res.status(200).json({
        success: true,
        message: 'Booking cancelled successfully'
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