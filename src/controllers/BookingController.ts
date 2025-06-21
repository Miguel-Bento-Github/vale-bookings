import { Request, Response } from 'express';

import Booking from '../models/Booking';
import Location from '../models/Location';
import * as BookingService from '../services/BookingService';
import { AuthenticatedRequest, BookingStatus } from '../types';
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
  validateRequiredId,
  validateBookingStatus
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
  create = withErrorHandling(async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    const { locationId, startTime, endTime, notes } = req.body as CreateBookingBody;
    const userId = req.user?.userId;

    if (userId === undefined || userId.trim().length === 0) {
      sendError(res, 'Unauthorized', 401);
      return;
    }

    // Basic validation that matches test expectations
    if (locationId === undefined || startTime === undefined || endTime === undefined) {
      sendError(res, 'Location ID, start time, and end time are required', 400);
      return;
    }

    // Validate location exists
    const location = await Location.findById(locationId);
    if (location === null) {
      sendError(res, 'Location not found', 404);
      return;
    }

    // Parse and validate time range
    const startDate = new Date(startTime);
    const endDate = new Date(endTime);

    // Validate dates are valid
    if (isNaN(startDate.getTime()) || isNaN(endDate.getTime())) {
      sendError(res, 'Invalid date format', 400);
      return;
    }

    // Validate time range
    const now = new Date();
    if (startDate < now) {
      sendError(res, 'Cannot create booking in the past', 400);
      return;
    }

    if (endDate <= startDate) {
      sendError(res, 'End time must be after start time', 400);
      return;
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

    if (typeof query.status === 'string' && query.status.trim().length > 0) {
      filter.status = query.status;
    }

    if (typeof query.locationId === 'string' && query.locationId.trim().length > 0) {
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
  getById = withErrorHandling(async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    if (!validateRequiredId(req.params.id, res, 'Booking ID')) {
      return;
    }

    // Check authentication first
    const userId = req.user?.userId;
    if (userId === undefined || userId.trim().length === 0) {
      sendError(res, 'Unauthorized', 401);
      return;
    }

    const bookingId = req.params.id;
    if (bookingId === undefined) {
      sendError(res, 'Booking ID is required', 400);
      return;
    }

    const booking = await BookingService.findById(bookingId);

    if (booking === null) {
      sendError(res, 'Booking not found', 404);
      return;
    }

    // Check ownership or admin access
    const isOwner = booking.userId.toString() === userId;
    const isAdmin = req.user?.role === 'ADMIN';

    if (!isOwner && !isAdmin) {
      sendError(res, 'Forbidden: access denied', 403);
      return;
    }

    sendSuccess(res, booking);
  });

  // Update booking
  update = withErrorHandling(async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    if (!validateRequiredId(req.params.id, res, 'Booking ID')) {
      return;
    }

    const userId = req.user?.userId;
    if (userId === undefined || userId.trim().length === 0) {
      sendError(res, 'Unauthorized', 401);
      return;
    }

    const updateData = req.body as UpdateBookingBody;
    const allowedUpdates = ['status', 'notes'];
    const updates = Object.keys(updateData);
    const isValidOperation = updates.every(update => allowedUpdates.includes(update));

    if (!isValidOperation) {
      sendError(res, 'Invalid updates', 400);
      return;
    }

    // Check permissions for status updates
    if (typeof updateData.status === 'string' && updateData.status.trim().length > 0) {
      // Validate status value
      if (!validateBookingStatus(updateData.status)) {
        sendError(res, 'Invalid status value', 400);
        return;
      }

      const isAdmin = req.user?.role === 'ADMIN';
      const isValet = req.user?.role === 'VALET';

      if (!isAdmin && !isValet) {
        sendError(res, 'Forbidden: insufficient permissions', 403);
        return;
      }

      // Use BookingService for status updates
      const bookingId = req.params.id;
      if (bookingId === undefined) {
        sendError(res, 'Booking ID is required', 400);
        return;
      }
      const updatedBooking = await BookingService.updateBookingStatus(bookingId, updateData.status as BookingStatus);
      if (updatedBooking === null) {
        sendError(res, 'Booking not found', 404);
        return;
      }
      sendSuccess(res, updatedBooking, 'Booking status updated successfully');
      return;
    }

    // Ensure req.params.id is defined since we validated it
    const bookingId = req.params.id;
    if (bookingId === undefined || bookingId.trim().length === 0) {
      sendError(res, 'Booking ID is required', 400);
      return;
    }

    // Create a properly typed update object for notes-only updates
    const safeUpdateData: { notes?: string } = {};
    if (typeof updateData.notes === 'string') {
      safeUpdateData.notes = updateData.notes;
    }

    const updatedBooking = await standardUpdate(Booking, bookingId, safeUpdateData);
    sendSuccess(res, updatedBooking, 'Booking updated successfully');
  });

  // Delete booking (soft delete by changing status to CANCELLED)
  delete = withErrorHandling(async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    if (!validateRequiredId(req.params.id, res, 'Booking ID')) {
      return;
    }

    const userId = req.user?.userId;
    if (userId === undefined || userId.trim().length === 0) {
      sendError(res, 'Unauthorized', 401);
      return;
    }

    const bookingId = req.params.id;
    if (bookingId === undefined) {
      sendError(res, 'Booking ID is required', 400);
      return;
    }

    const booking = await BookingService.findById(bookingId);
    if (booking === null) {
      sendError(res, 'Booking not found', 404);
      return;
    }

    // Check ownership or admin access
    const isOwner = booking.userId.toString() === userId;
    const isAdmin = req.user?.role === 'ADMIN';

    if (!isOwner && !isAdmin) {
      sendError(res, 'Forbidden: access denied', 403);
      return;
    }

    // Use BookingService for cancellation
    const cancelledBooking = await BookingService.cancelBooking(bookingId);
    sendSuccess(res, cancelledBooking, 'Booking cancelled successfully');
  });

  // Get user's bookings
  getUserBookings = withErrorHandling(async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    const userId = req.user?.userId;
    if (userId === undefined || userId.trim().length === 0) {
      sendError(res, 'Unauthorized', 401);
      return;
    }

    const bookings = await BookingService.getUserBookings(userId);
    sendSuccess(res, bookings);
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