import { Request, Response } from 'express';
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
        data: { bookings }
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
          message: 'Forbidden: Access denied'
        });
        return;
      }

      res.status(200).json({
        success: true,
        data: { booking }
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

      const { locationId, startTime, endTime, price, notes } = req.body;

      if (!locationId || !startTime || !endTime || !price) {
        res.status(400).json({
          success: false,
          message: 'Location ID, start time, end time, and price are required'
        });
        return;
      }

      const booking = await this.bookingService.createBooking({
        userId,
        locationId,
        startTime: new Date(startTime),
        endTime: new Date(endTime),
        price,
        notes: notes || '',
        status: 'PENDING'
      });

      res.status(201).json({
        success: true,
        message: 'Booking created successfully',
        data: { booking }
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

      const booking = await this.bookingService.findById(id!);

      if (!booking) {
        res.status(404).json({
          success: false,
          message: 'Booking not found'
        });
        return;
      }

      // Check permissions: only booking owner or admin can update status
      if (booking.userId.toString() !== userId && userRole !== 'ADMIN') {
        res.status(403).json({
          success: false,
          message: 'Forbidden: Access denied'
        });
        return;
      }

      const updatedBooking = await this.bookingService.updateBookingStatus(id!, status as BookingStatus);

      res.status(200).json({
        success: true,
        message: 'Booking status updated successfully',
        data: { booking: updatedBooking }
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

      // Check if user owns the booking
      if (booking.userId.toString() !== userId) {
        res.status(403).json({
          success: false,
          message: 'Forbidden: You can only cancel your own bookings'
        });
        return;
      }

      const cancelledBooking = await this.bookingService.cancelBooking(id!);

      res.status(200).json({
        success: true,
        message: 'Booking cancelled successfully',
        data: { booking: cancelledBooking }
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