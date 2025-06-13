import { Response } from 'express';

import Booking from '../models/Booking';
import Location from '../models/Location';
import {
  getUserBookings as getBookingsForUser,
  findById as findBookingById,
  updateBookingStatus as updateStatus,
  cancelBooking as cancelExistingBooking
} from '../services/BookingService';
import { AppError, AuthenticatedRequest, BookingStatus } from '../types';

// Type definitions for request bodies
interface CreateBookingRequestBody {
  locationId: string;
  startTime: string;
  endTime: string;
  notes?: string;
}

interface UpdateBookingStatusRequestBody {
  status: BookingStatus;
}

// Type guards for request validation
function isCreateBookingRequestBody(body: unknown): body is CreateBookingRequestBody {
  const bodyObj = body as Record<string, unknown>;
  return (
    typeof body === 'object' &&
    body !== null &&
    typeof bodyObj.locationId === 'string' &&
    typeof bodyObj.startTime === 'string' &&
    typeof bodyObj.endTime === 'string'
  );
}

function isUpdateBookingStatusRequestBody(body: unknown): body is UpdateBookingStatusRequestBody {
  const bodyObj = body as Record<string, unknown>;
  return (
    typeof body === 'object' &&
    body !== null &&
    typeof bodyObj.status === 'string' &&
    ['PENDING', 'CONFIRMED', 'IN_PROGRESS', 'COMPLETED', 'CANCELLED'].includes(bodyObj.status)
  );
}

export async function getUserBookings(req: AuthenticatedRequest, res: Response): Promise<void> {
  try {
    const userId = req.user?.userId;

    if (userId === undefined || userId === null) {
      res.status(401).json({
        success: false,
        message: 'Unauthorized'
      });
      return;
    }

    const pageQuery = req.query?.page;
    const limitQuery = req.query?.limit;

    const page = typeof pageQuery === 'string' ? parseInt(pageQuery, 10) : 1;
    const limit = typeof limitQuery === 'string' ? parseInt(limitQuery, 10) : 10;

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

    if (userId === undefined || userId === null) {
      res.status(401).json({
        success: false,
        message: 'Unauthorized'
      });
      return;
    }

    if (id === undefined || id === null || id.trim().length === 0) {
      res.status(400).json({
        success: false,
        message: 'Booking ID is required'
      });
      return;
    }

    const booking = await findBookingById(id);

    if (booking === null || booking === undefined) {
      res.status(404).json({
        success: false,
        message: 'Booking not found'
      });
      return;
    }

    // Check if user owns the booking or is admin
    if (String(booking.userId) !== userId && req.user?.role !== 'ADMIN') {
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

    if (userId === undefined || userId === null) {
      res.status(401).json({
        success: false,
        message: 'Unauthorized'
      });
      return;
    }

    if (!isCreateBookingRequestBody(req.body)) {
      res.status(400).json({
        success: false,
        message: 'Location ID, start time, and end time are required'
      });
      return;
    }

    const { locationId, startTime, endTime, notes } = req.body;

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
    if (location === null || location === undefined) {
      res.status(404).json({
        success: false,
        message: 'Location not found'
      });
      return;
    }

    if (location.isActive !== true) {
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
      price,
      notes: notes ?? ''
    });

    res.status(201).json({
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

export async function updateBookingStatus(req: AuthenticatedRequest, res: Response): Promise<void> {
  try {
    const userId = req.user?.userId;
    const userRole = req.user?.role;
    const { id } = req.params;

    if (userId === undefined || userId === null) {
      res.status(401).json({
        success: false,
        message: 'Unauthorized'
      });
      return;
    }

    if (id === undefined || id === null || id.trim().length === 0) {
      res.status(400).json({
        success: false,
        message: 'Booking ID is required'
      });
      return;
    }

    if (!isUpdateBookingStatusRequestBody(req.body)) {
      res.status(400).json({
        success: false,
        message: 'Valid status is required'
      });
      return;
    }

    const { status } = req.body;

    // Check if user has permission to update booking status
    if (userRole !== 'ADMIN' && userRole !== 'VALET') {
      res.status(403).json({
        success: false,
        message: 'Forbidden: insufficient permissions'
      });
      return;
    }

    const booking = await updateStatus(id, status);

    if (booking === null || booking === undefined) {
      res.status(404).json({
        success: false,
        message: 'Booking not found'
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

export async function cancelBooking(req: AuthenticatedRequest, res: Response): Promise<void> {
  try {
    const userId = req.user?.userId;
    const userRole = req.user?.role;
    const { id } = req.params;

    if (userId === undefined || userId === null) {
      res.status(401).json({
        success: false,
        message: 'Unauthorized'
      });
      return;
    }

    if (id === undefined || id === null || id.trim().length === 0) {
      res.status(400).json({
        success: false,
        message: 'Booking ID is required'
      });
      return;
    }

    // Get booking to check ownership
    const booking = await findBookingById(id);

    if (booking === null || booking === undefined) {
      res.status(404).json({
        success: false,
        message: 'Booking not found'
      });
      return;
    }

    // Check if user owns the booking or is admin
    if (String(booking.userId) !== userId && userRole !== 'ADMIN') {
      res.status(403).json({
        success: false,
        message: 'Forbidden: access denied'
      });
      return;
    }

    const cancelledBooking = await cancelExistingBooking(id);

    res.status(200).json({
      success: true,
      data: cancelledBooking
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