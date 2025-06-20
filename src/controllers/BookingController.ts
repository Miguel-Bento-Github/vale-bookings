import { Request, Response } from 'express';

import Booking from '../models/Booking';
import Location from '../models/Location';
import { AuthenticatedRequest } from '../types';
import {
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

interface CreateBookingBody {
  locationId: string;
  startTime: string | Date;
  endTime: string | Date;
  notes?: string;
}

interface UpdateBookingBody {
  status?: string;
  notes?: string;
  [key: string]: unknown;
}

class BookingController {
  // Create booking
  create = withErrorHandling(async (req: AuthenticatedRequest, res: Response) => {
    const { locationId, startTime, endTime, notes } = req.body as CreateBookingBody;
    const userId = req.user?.userId;

    if (!userId || userId.trim().length === 0) {
      return sendError(res, 'User authentication required', 401);
    }

    // Basic validation that matches test expectations
    if (!locationId || !startTime || !endTime) {
      return sendError(res, 'Location ID, start time, and end time are required', 400);
    }

    // Validate location exists
    const location = await Location.findById(locationId);
    if (!location) {
      return sendError(res, 'Location not found', 404);
    }

    // Parse and validate time range
    const startDate = new Date(startTime);
    const endDate = new Date(endTime);

    // Validate dates are valid
    if (isNaN(startDate.getTime()) || isNaN(endDate.getTime())) {
      return sendError(res, 'Invalid date format', 400);
    }

    // Validate time range
    const now = new Date();
    if (startDate < now) {
      return sendError(res, 'Cannot create booking in the past', 400);
    }

    if (endDate <= startDate) {
      return sendError(res, 'End time must be after start time', 400);
    }

    // Calculate price (example: $10 per hour)
    const durationHours = (endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60);
    const price = Math.ceil(durationHours) * 10; // Default $10 per hour

    const bookingData = {
      userId,
      locationId,
      startTime: startDate,
      endTime: endDate,
      status: 'PENDING',
      price,
      notes: notes ?? ''
    };

    const booking = await Booking.create(bookingData);
    sendSuccess(res, booking, 'Booking created successfully', 201);
  });

  // Get all bookings with pagination
  getAll = withErrorHandling(async (req: Request, res: Response) => {
    const { page, limit } = validatePaginationParams(
      req.query.page as string,
      req.query.limit as string
    );

    const query = req.query as Record<string, unknown>;
    const filter: Record<string, unknown> = {};

    if (query.status && typeof query.status === 'string' && query.status.trim().length > 0) {
      filter.status = query.status;
    }

    if (query.locationId && typeof query.locationId === 'string' && query.locationId.trim().length > 0) {
      filter.locationId = query.locationId;
    }

    const skip = (page - 1) * limit;
    const bookings = await Booking.find(filter)
      .populate('userId', 'name email')
      .populate('locationId', 'name address')
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
  getById = withErrorHandling(async (req: AuthenticatedRequest, res: Response) => {
    if (!validateRequiredId(req.params.id, res, 'Booking ID')) {
      return;
    }

    const booking = await Booking.findById(req.params.id);

    if (!booking) {
      return sendError(res, 'Booking not found', 404);
    }

    // Check ownership or admin access
    const userId = req.user?.userId;
    if (!userId || userId.trim().length === 0) {
      return sendError(res, 'User authentication required', 401);
    }

    const isOwner = booking.userId.toString() === userId;
    const isAdmin = req.user?.role === 'ADMIN';

    if (!isOwner && !isAdmin) {
      return sendError(res, 'Forbidden: access denied', 403);
    }

    sendSuccess(res, booking);
  });

  // Update booking
  update = withErrorHandling(async (req: AuthenticatedRequest, res: Response) => {
    if (!validateRequiredId(req.params.id, res, 'Booking ID')) {
      return;
    }

    const userId = req.user?.userId;
    if (!userId || userId.trim().length === 0) {
      return sendError(res, 'User authentication required', 401);
    }

    const updateData = req.body as UpdateBookingBody;
    const allowedUpdates = ['status', 'notes'];
    const updates = Object.keys(updateData);
    const isValidOperation = updates.every(update => allowedUpdates.includes(update));

    if (!isValidOperation) {
      return sendError(res, 'Invalid updates', 400);
    }

    // Check permissions for status updates
    if (updateData.status && typeof updateData.status === 'string' && updateData.status.trim().length > 0) {
      // Validate status value
      const validStatuses = ['PENDING', 'CONFIRMED', 'IN_PROGRESS', 'COMPLETED', 'CANCELLED'];
      if (!validStatuses.includes(updateData.status)) {
        return sendError(res, 'Invalid status value', 400);
      }

      const isAdmin = req.user?.role === 'ADMIN';
      const isValet = req.user?.role === 'VALET';

      if (!isAdmin && !isValet) {
        return sendError(res, 'Forbidden: insufficient permissions', 403);
      }
    }

    // Ensure req.params.id is defined since we validated it
    const bookingId = req.params.id;
    if (!bookingId || bookingId.trim().length === 0) {
      return sendError(res, 'Booking ID is required', 400);
    }

    const updatedBooking = await standardUpdate(Booking, bookingId, updateData);
    sendSuccess(res, updatedBooking, 'Booking updated successfully');
  });

  // Delete booking (soft delete by changing status to CANCELLED)
  delete = withErrorHandling(async (req: AuthenticatedRequest, res: Response) => {
    if (!validateRequiredId(req.params.id, res, 'Booking ID')) {
      return;
    }

    const userId = req.user?.userId;
    if (!userId || userId.trim().length === 0) {
      return sendError(res, 'User authentication required', 401);
    }

    const booking = await Booking.findById(req.params.id);
    if (!booking) {
      return sendError(res, 'Booking not found', 404);
    }

    // Check ownership or admin access
    const isOwner = booking.userId.toString() === userId;
    const isAdmin = req.user?.role === 'ADMIN';

    if (!isOwner && !isAdmin) {
      return sendError(res, 'Forbidden: access denied', 403);
    }

    // Check if booking is already completed - should not be cancelled
    if (booking.status === 'COMPLETED') {
      return sendError(res, 'Completed bookings cannot be cancelled', 400);
    }

    booking.status = 'CANCELLED';
    await booking.save();

    sendSuccess(res, booking, 'Booking cancelled successfully');
  });

  // Get user's bookings
  getUserBookings = withErrorHandling(async (req: AuthenticatedRequest, res: Response) => {
    const userId = req.user?.userId;
    if (!userId || userId.trim().length === 0) {
      return sendError(res, 'User authentication required', 401);
    }

    const { page, limit } = validatePaginationParams(
      req.query.page as string,
      req.query.limit as string
    );

    const skip = (page - 1) * limit;
    const bookings = await Booking.find({ userId })
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit);

    const total = await Booking.countDocuments({ userId });

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