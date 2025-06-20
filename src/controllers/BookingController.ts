import { Request, Response } from 'express';
import mongoose from 'mongoose';

import Booking from '../models/Booking';
import Location from '../models/Location';
import { AuthenticatedRequest } from '../types';
import {
  handleDuplicateKeyError,
  standardUpdate
} from '../utils/mongoHelpers';
import { 
  withErrorHandling,
  sendSuccess,
  sendError, 
  sendSuccessWithPagination
} from '../utils/responseHelpers';
import { 
  validatePaginationParams,
  validateTimeRange,
  validateRequiredId
} from '../utils/validationHelpers';

class BookingController {
  // Create booking
  create = withErrorHandling(async (req: AuthenticatedRequest, res: Response) => {
    const { locationId, startTime, endTime, notes } = req.body;
    const userId = req.user?.userId;

    if (!userId) {
      return sendError(res, 'User authentication required', 401);
    }

    // Basic validation that matches test expectations
    if (!locationId || !startTime || !endTime) {
      return sendError(res, 'Location ID, start time, and end time are required', 400);
    }

    // Validate location exists and is active
    const location = await Location.findById(locationId);
    if (!location) {
      return sendError(res, 'Location not found', 404);
    }

    if (!location.isActive) {
      return sendError(res, 'Location is not available', 400);
    }

    const startDate = new Date(startTime);
    const endDate = new Date(endTime);

    // Check for overlapping bookings
    const overlappingBookings = await Booking.find({
      locationId,
      status: { $in: ['PENDING', 'CONFIRMED', 'IN_PROGRESS'] },
      $or: [
        { startTime: { $lt: endDate }, endTime: { $gt: startDate } }
      ]
    });

    if (overlappingBookings.length > 0) {
      return sendError(res, 'Time slot not available', 409);
    }

    // Calculate price (basic calculation - $10 per hour)
    const durationHours = (endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60);
    const price = Math.round(durationHours * 10 * 100) / 100; // Round to 2 decimal places

    const bookingData = {
      userId,
      locationId,
      startTime: startDate,
      endTime: endDate,
      status: 'PENDING' as const,
      price,
      notes: notes || undefined
    };

    // Use Booking.create to match test expectations
    const booking = await Booking.create(bookingData);

    sendSuccess(res, booking, 'Booking created successfully', 201);
  });

  // Get all bookings (with pagination and filters)
  getAll = withErrorHandling(async (req: Request, res: Response) => {
    const { page, limit } = validatePaginationParams(
      req.query.page as string,
      req.query.limit as string
    );
    const { status, locationId, userId, startDate, endDate } = req.query;

    const filter: Record<string, unknown> = {};

    if (typeof status === 'string' && status.length > 0) {
      filter.status = status;
    }

    if (typeof locationId === 'string' && locationId.length > 0) {
      if (!mongoose.Types.ObjectId.isValid(locationId)) {
        return sendError(res, 'Invalid location ID format', 400);
      }
      filter.locationId = locationId;
    }

    if (typeof userId === 'string' && userId.length > 0) {
      if (!mongoose.Types.ObjectId.isValid(userId)) {
        return sendError(res, 'Invalid user ID format', 400);
      }
      filter.userId = userId;
    }

    // Date range filtering
    if ((typeof startDate === 'string' && startDate.length > 0) ||
      (typeof endDate === 'string' && endDate.length > 0)) {
      filter.startTime = {};
      if (typeof startDate === 'string' && startDate.length > 0) {
        const start = new Date(startDate);
        if (!isNaN(start.getTime())) {
          (filter.startTime as Record<string, unknown>).$gte = start;
        }
      }
      if (typeof endDate === 'string' && endDate.length > 0) {
        const end = new Date(endDate);
        if (!isNaN(end.getTime())) {
          (filter.startTime as Record<string, unknown>).$lte = end;
        }
      }
    }

    const skip = (page - 1) * limit;
    const bookings = await Booking.find(filter)
      .populate('locationId', 'name address')
      .populate('userId', 'profile.name email')
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit);

    const total = await Booking.countDocuments(filter);

    sendSuccessWithPagination(res, bookings, {
      page: page,
      limit: limit,
      total: total,
      totalPages: Math.ceil(total / limit)
    });
  });

  // Get booking by ID
  getById = withErrorHandling(async (req: Request, res: Response) => {
    if (!validateRequiredId(req.params.id, res, 'Booking ID')) {
      return;
    }

    const booking = await Booking.findById(req.params.id)
      .populate('locationId', 'name address coordinates')
      .populate('userId', 'profile.name email');

    if (!booking) {
      return sendError(res, 'Booking not found', 404);
    }

    sendSuccess(res, booking, 'Booking retrieved successfully');
  });

  // Update booking
  update = withErrorHandling(async (req: AuthenticatedRequest, res: Response) => {
    if (!validateRequiredId(req.params.id, res, 'Booking ID')) {
      return;
    }

    const { startTime, endTime, status, notes } = req.body;
    const userId = req.user?.userId;

    if (!userId) {
      return sendError(res, 'User authentication required', 401);
    }

    const booking = await Booking.findById(req.params.id);
    if (!booking) {
      return sendError(res, 'Booking not found', 404);
    }

    // Check if user owns the booking or is admin
    const user = await mongoose.model('User').findById(userId);
    if (!user) {
      return sendError(res, 'User not found', 401);
    }

    const isOwner = booking.userId.toString() === userId;
    const isAdmin = (user as { role: string }).role === 'ADMIN';

    if (!isOwner && !isAdmin) {
      return sendError(res, 'Not authorized to update this booking', 403);
    }

    // Validate time range if provided
    if ((typeof startTime === 'string' && startTime.length > 0) ||
      (typeof endTime === 'string' && endTime.length > 0)) {
      const newStartTime = startTime || booking.startTime.toISOString();
      const newEndTime = endTime || booking.endTime.toISOString();

      if (!validateTimeRange(newStartTime, newEndTime, res)) {
        return;
      }
    }

    const updateData: Record<string, unknown> = {};
    if (typeof startTime === 'string' && startTime.length > 0) updateData.startTime = new Date(startTime);
    if (typeof endTime === 'string' && endTime.length > 0) updateData.endTime = new Date(endTime);
    if (typeof status === 'string' && status.length > 0) updateData.status = status;
    if (typeof notes === 'string') updateData.notes = notes.length > 0 ? notes : undefined;

    const updatedBooking = await standardUpdate(Booking, req.params.id!, updateData);
    sendSuccess(res, updatedBooking, 'Booking updated successfully');
  });

  // Delete booking
  delete = withErrorHandling(async (req: AuthenticatedRequest, res: Response) => {
    if (!validateRequiredId(req.params.id, res, 'Booking ID')) {
      return;
    }

    const userId = req.user?.userId;
    if (!userId) {
      return sendError(res, 'User authentication required', 401);
    }

    const booking = await Booking.findById(req.params.id);
    if (!booking) {
      return sendError(res, 'Booking not found', 404);
    }

    // Check if user owns the booking or is admin
    const user = await mongoose.model('User').findById(userId);
    if (!user) {
      return sendError(res, 'User not found', 401);
    }

    const isOwner = booking.userId.toString() === userId;
    const isAdmin = (user as { role: string }).role === 'ADMIN';

    if (!isOwner && !isAdmin) {
      return sendError(res, 'Not authorized to delete this booking', 403);
    }

    await Booking.findByIdAndDelete(req.params.id);
    sendSuccess(res, null, 'Booking deleted successfully');
  });

  // Get user's bookings
  getUserBookings = withErrorHandling(async (req: AuthenticatedRequest, res: Response) => {
    const userId = req.user?.userId;
    if (!userId) {
      return sendError(res, 'User authentication required', 401);
    }

    const { page, limit } = validatePaginationParams(
      req.query.page as string,
      req.query.limit as string
    );
    const { status } = req.query;

    const filter: Record<string, unknown> = { userId };
    if (typeof status === 'string' && status.length > 0) {
      filter.status = status;
    }

    const skip = (page - 1) * limit;
    const bookings = await Booking.find(filter)
      .populate('locationId', 'name address coordinates')
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit);

    const total = await Booking.countDocuments(filter);

    sendSuccessWithPagination(res, bookings, {
      page: page,
      limit: limit,
      total: total,
      totalPages: Math.ceil(total / limit)
    });
  });
}

export default new BookingController();

// Export individual methods for backward compatibility with tests
const bookingController = new BookingController();
export const create = bookingController.create;
export const getAll = bookingController.getAll;
export const getById = bookingController.getById;
export const update = bookingController.update;
export const deleteBooking = bookingController.delete;
export const getUserBookings = bookingController.getUserBookings;

// Aliases for test compatibility
export const createBooking = create;
export const getBookingById = getById;
export const updateBookingStatus = update;
export const cancelBooking = deleteBooking;