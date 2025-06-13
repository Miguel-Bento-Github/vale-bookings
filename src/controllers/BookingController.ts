import { Response } from 'express';
import { getUserBookings as getBookingsForUser, findById as findBookingById, createBooking as createNewBooking, updateBookingStatus as updateStatus, cancelBooking as cancelExistingBooking } from '../services/BookingService';
import { AppError, AuthenticatedRequest, BookingStatus } from '../types';
import User from '../models/User';
import Booking from '../models/Booking';
import Location from '../models/Location';

export async function getUserBookings(req: AuthenticatedRequest, res: Response): Promise<void> {
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

    const bookings = await getBookingsForUser(userId, page, limit);

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

export async function getBookingById(req: AuthenticatedRequest, res: Response): Promise<void> {
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

    if (!id) {
      res.status(400).json({
        success: false,
        message: 'Booking ID is required'
      });
      return;
    }

    const booking = await findBookingById(id);

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

export async function createBooking(req: AuthenticatedRequest, res: Response): Promise<void> {
  try {
    const userId = req.user?.userId;
    const { locationId, startTime, endTime, notes } = req.body;

    if (!userId) {
      res.status(401).json({
        success: false,
        message: 'Unauthorized'
      });
      return;
    }

    if (!locationId || !startTime || !endTime) {
      res.status(400).json({
        success: false,
        message: 'Location ID, start time, and end time are required'
      });
      return;
    }

    // Validate dates
    const start = new Date(startTime);
    const end = new Date(endTime);
    const now = new Date();

    if (isNaN(start.getTime()) || isNaN(end.getTime())) {
      res.status(400).json({
        success: false,
        message: 'Invalid date format'
      });
      return;
    }

    if (start < now) {
      res.status(400).json({
        success: false,
        message: 'Cannot create booking in the past'
      });
      return;
    }

    if (end <= start) {
      res.status(400).json({
        success: false,
        message: 'End time must be after start time'
      });
      return;
    }

    // Check if location exists and is active
    const location = await Location.findById(locationId);
    if (!location) {
      res.status(404).json({
        success: false,
        message: 'Location not found'
      });
      return;
    }

    if (!location.isActive) {
      res.status(400).json({
        success: false,
        message: 'Location is not active'
      });
      return;
    }

    // Check for overlapping bookings
    const overlappingBookings = await Booking.find({
      locationId,
      status: { $in: ['PENDING', 'CONFIRMED', 'IN_PROGRESS'] },
      $or: [
        {
          startTime: { $lt: end },
          endTime: { $gt: start }
        }
      ]
    });

    if (overlappingBookings.length > 0) {
      res.status(400).json({
        success: false,
        message: 'Time slot is not available'
      });
      return;
    }

    // Calculate price based on duration (example: $10 per hour)
    const hours = (end.getTime() - start.getTime()) / (1000 * 60 * 60);
    const price = Math.max(hours * 10, 10); // Minimum $10

    const booking = await Booking.create({
      userId,
      locationId,
      startTime: start,
      endTime: end,
      status: 'PENDING',
      price,
      notes
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
      console.error('Error creating booking:', error);
      res.status(500).json({
        success: false,
        message: 'Internal server error'
      });
    }
  }
}

export async function updateBookingStatus(req: AuthenticatedRequest, res: Response): Promise<void> {
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

    if (!id || !status) {
      res.status(400).json({
        success: false,
        message: 'Booking ID and status are required'
      });
      return;
    }

    // Validate status
    const validStatuses = ['PENDING', 'CONFIRMED', 'IN_PROGRESS', 'COMPLETED', 'CANCELLED'];
    if (!validStatuses.includes(status)) {
      res.status(400).json({
        success: false,
        message: 'Invalid status'
      });
      return;
    }

    const booking = await Booking.findById(id);
    if (!booking) {
      res.status(404).json({
        success: false,
        message: 'Booking not found'
      });
      return;
    }

    if (userRole === 'ADMIN') {
      // Admins can do any valid transition
      const validTransitions: Record<string, string[]> = {
        'PENDING': ['CONFIRMED', 'CANCELLED'],
        'CONFIRMED': ['IN_PROGRESS', 'CANCELLED'],
        'IN_PROGRESS': ['COMPLETED', 'CANCELLED'],
        'COMPLETED': [],
        'CANCELLED': []
      };
      const allowedTransitions = validTransitions[booking.status];
      if (!allowedTransitions || !allowedTransitions.includes(status)) {
        res.status(400).json({
          success: false,
          message: `Cannot transition from ${booking.status} to ${status}`
        });
        return;
      }
    } else if (userRole === 'VALET') {
      // Valets can only do CONFIRMED->IN_PROGRESS or IN_PROGRESS->COMPLETED
      if (!((booking.status === 'CONFIRMED' && status === 'IN_PROGRESS') || (booking.status === 'IN_PROGRESS' && status === 'COMPLETED'))) {
        res.status(403).json({
          success: false,
          message: 'Forbidden: access denied'
        });
        return;
      }
    } else {
      // All other users forbidden
      res.status(403).json({
        success: false,
        message: 'Forbidden: access denied'
      });
      return;
    }

    const updatedBooking = await Booking.findByIdAndUpdate(
      id,
      { status },
      { new: true, runValidators: true }
    );

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
      console.error('Error updating booking status:', error);
      res.status(500).json({
        success: false,
        message: 'Internal server error'
      });
    }
  }
}

export async function cancelBooking(req: AuthenticatedRequest, res: Response): Promise<void> {
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

    if (!id) {
      res.status(400).json({
        success: false,
        message: 'Booking ID is required'
      });
      return;
    }

    const booking = await Booking.findById(id);
    if (!booking) {
      res.status(404).json({
        success: false,
        message: 'Booking not found'
      });
      return;
    }

    // Check if user is authorized to cancel the booking
    if (booking.userId.toString() !== userId && userRole !== 'ADMIN') {
      res.status(403).json({
        success: false,
        message: 'Forbidden: access denied'
      });
      return;
    }

    // Check if booking can be cancelled
    if (booking.status === 'COMPLETED' || booking.status === 'CANCELLED') {
      res.status(400).json({
        success: false,
        message: `Booking cannot be cancelled once ${booking.status.toLowerCase()}`
      });
      return;
    }

    const updatedBooking = await Booking.findByIdAndUpdate(
      id,
      { status: 'CANCELLED' },
      { new: true, runValidators: true }
    );

    res.status(200).json({
      success: true,
      message: 'Booking cancelled successfully',
      data: updatedBooking
    });
  } catch (error) {
    if (error instanceof AppError) {
      res.status(error.statusCode).json({
        success: false,
        message: error.message
      });
    } else {
      console.error('Error cancelling booking:', error);
      res.status(500).json({
        success: false,
        message: 'Internal server error'
      });
    }
  }
}