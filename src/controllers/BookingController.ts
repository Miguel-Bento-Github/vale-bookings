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
import {
  sendSuccess,
  sendError,
  withErrorHandling
} from '../utils/responseHelpers';
import {
  validateRequiredId,
  validatePaginationParams,
  validateTimeRange,
  validateAuthentication,
  validateUserRole,
  validateRequiredString
} from '../utils/validationHelpers';
import { ensureDocumentExists } from '../utils/mongoHelpers';

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

export const getUserBookings = withErrorHandling(async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  if (!validateAuthentication(req.user, res)) {
    return;
  }

  let userId = req.user!.userId;

  // If userId is provided as a parameter, use that instead (for admin access)
  if (req.params?.userId && req.params.userId.trim().length > 0) {
  // Check if current user is admin or accessing their own bookings
    if (req.user!.role !== 'ADMIN' && req.params.userId !== userId) {
      sendError(res, 'Forbidden: access denied', 403);
      return;
    }
    userId = req.params.userId;
  }

  const { page, limit } = validatePaginationParams(req.query.page as string, req.query.limit as string);
  const bookings = await getBookingsForUser(userId, page, limit);

  sendSuccess(res, bookings);
});

export const getBookingById = withErrorHandling(async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  if (!validateAuthentication(req.user, res)) {
    return;
  }

  if (!validateRequiredId(req.params.id, res, 'Booking ID')) {
    return;
  }

  const booking = await findBookingById(req.params.id!);

  if (!booking) {
    sendError(res, 'Booking not found', 404);
    return;
  }

  // Check if user owns the booking or is admin
  if (String(booking.userId) !== req.user!.userId && req.user!.role !== 'ADMIN') {
    sendError(res, 'Forbidden: access denied', 403);
    return;
  }

  sendSuccess(res, booking);
});

export const createBooking = withErrorHandling(async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  if (!validateAuthentication(req.user, res)) {
    return;
  }

  if (!isCreateBookingRequestBody(req.body)) {
    sendError(res, 'Location ID, start time, and end time are required', 400);
    return;
  }

  const { locationId, startTime, endTime, notes } = req.body;

  // Validate location ID
  if (!validateRequiredId(locationId, res, 'Location ID')) {
    return;
  }

  // Validate time range
  if (!validateTimeRange(startTime, endTime, res)) {
    return;
  }

  // Check if location exists and is active
  const location = await Location.findById(locationId);
  if (!location) {
    sendError(res, 'Location not found', 404);
    return;
  }

  if (!location.isActive) {
    sendError(res, 'Location is not active', 400);
    return;
  }

  // Check for overlapping bookings
  const start = new Date(startTime);
  const end = new Date(endTime);

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
    sendError(res, 'Time slot is not available', 400);
    return;
  }

  // Calculate price based on duration (example: $10 per hour)
  const hours = (end.getTime() - start.getTime()) / (1000 * 60 * 60);
  const price = Math.max(hours * 10, 10); // Minimum $10

  // Create booking
  const booking = await Booking.create({
    userId: req.user!.userId,
    locationId,
    startTime: start,
    endTime: end,
    price,
    notes: notes || '',
    status: 'PENDING'
  });

  sendSuccess(res, booking, 'Booking created successfully', 201);
});

export const updateBookingStatus = withErrorHandling(async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  if (!validateAuthentication(req.user, res)) {
    return;
  }

  // Only admins and valets can update booking status
  if (req.user!.role !== 'ADMIN' && req.user!.role !== 'VALET') {
    sendError(res, 'Forbidden: insufficient permissions', 403);
    return;
  }

  if (!validateRequiredId(req.params.id, res, 'Booking ID')) {
    return;
  }

  if (!isUpdateBookingStatusRequestBody(req.body)) {
    sendError(res, 'Valid status is required', 400);
    return;
  }

  const { status } = req.body;
  const booking = await updateStatus(req.params.id!, status);

  if (!booking) {
    sendError(res, 'Booking not found', 404);
    return;
  }

  sendSuccess(res, booking, 'Booking status updated successfully');
});

export const cancelBooking = withErrorHandling(async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  if (!validateAuthentication(req.user, res)) {
    return;
  }

  if (!validateRequiredId(req.params.id, res, 'Booking ID')) {
    return;
  }

  const booking = await findBookingById(req.params.id!);

  if (!booking) {
    sendError(res, 'Booking not found', 404);
    return;
  }

  // Check if user owns the booking or is admin
  if (String(booking.userId) !== req.user!.userId && req.user!.role !== 'ADMIN') {
    sendError(res, 'Forbidden: access denied', 403);
    return;
  }

  const cancelledBooking = await cancelExistingBooking(req.params.id!);
  sendSuccess(res, cancelledBooking, 'Booking cancelled successfully');
});