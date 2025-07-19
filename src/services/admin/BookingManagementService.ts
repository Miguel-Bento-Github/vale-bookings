import Booking from '../../models/Booking';
import User from '../../models/User';
import { 
  IBookingDocument,
  BookingStatus,
  AppError,
  IBookingQuery,
  IDateRangeQuery
} from '../../types';
import {
  standardUpdate,
  ensureDocumentExists
} from '../../utils/mongoHelpers';
import { transformBookings } from '../../utils/populateHelpers';
import { emitBookingUpdate } from '../WebSocketService';

export interface IBookingFilters {
  status?: BookingStatus;
  startDate?: string;
  endDate?: string;
  locationId?: string;
  userId?: string;
  serviceId?: string;
  search?: string;
  includeGuest?: boolean;
  page?: number;
  limit?: number;
  sortBy?: string;
  sortOrder?: string;
}

export const getAllBookings = async (filters: IBookingFilters): Promise<{
  bookings: IBookingDocument[];
  pagination: {
    currentPage: number;
    totalPages: number;
    totalItems: number;
    itemsPerPage: number;
  };
}> => {
  const page = (typeof filters.page === 'number' && filters.page > 0) ? filters.page : 1;
  const limit = (typeof filters.limit === 'number' && filters.limit > 0) ? filters.limit : 10;
  const skip = (page - 1) * limit;

  const query: IBookingQuery = {};

  // Apply status filter
  if (typeof filters.status === 'string' && filters.status.trim().length > 0) {
    query.status = filters.status;
  }

  // Apply location filter
  if (typeof filters.locationId === 'string' && filters.locationId.trim().length > 0) {
    query.locationId = filters.locationId;
  }

  // Apply user filter
  if (typeof filters.userId === 'string' && filters.userId.trim().length > 0) {
    query.userId = filters.userId;
  }

  // Apply search filter (search in user email/name)
  if (typeof filters.search === 'string' && filters.search.trim().length > 0) {
    const escapedSearch = filters.search.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    // eslint-disable-next-line security/detect-non-literal-regexp
    const searchRegex = new RegExp(escapedSearch, 'i');
    
    // We need to use aggregation for searching populated fields
    const userIds: string[] = await User.find({
      $or: [
        { email: searchRegex },
        { 'profile.name': searchRegex }
      ]
    }).distinct('_id');
    
    if (userIds.length > 0) {
      query.userId = { $in: userIds };
    } else {
      // If no users match, return empty results
      return {
        bookings: [],
        pagination: {
          currentPage: page,
          totalPages: 0,
          totalItems: 0,
          itemsPerPage: limit
        }
      };
    }
  }

  // Apply date range filter
  if (typeof filters.startDate === 'string' || typeof filters.endDate === 'string') {
    const dateRange: IDateRangeQuery = {};
    
    if (typeof filters.startDate === 'string' && filters.startDate.trim().length > 0) {
      dateRange.$gte = new Date(filters.startDate);
    }
    
    if (typeof filters.endDate === 'string' && filters.endDate.trim().length > 0) {
      const endDate = new Date(filters.endDate);
      // Set to end of day
      endDate.setHours(23, 59, 59, 999);
      dateRange.$lte = endDate;
    }
    
    if (Object.keys(dateRange).length > 0) {
      query.startTime = dateRange;
    }
  }

  // Apply various other filters based on business logic
  if (filters.includeGuest === false) {
    // Add filter to exclude guest bookings if needed
    // This would depend on how guest bookings are marked in your system
  }

  if (typeof filters.serviceId === 'string' && filters.serviceId.trim().length > 0) {
    // Add service filter if services are part of your booking model
    // query.serviceId = filters.serviceId;
  }

  // Build sort object
  const sortBy = filters.sortBy ?? 'createdAt';
  const sortOrder = filters.sortOrder === 'asc' ? 1 : -1;
  const sort: Record<string, 1 | -1> = {
    [sortBy]: sortOrder
  };

  const [bookings, totalItems] = await Promise.all([
    Booking.find(query)
      .populate('userId', 'email profile.name')
      .populate('locationId', 'name address')
      .skip(skip)
      .limit(limit)
      .sort(sort),
    Booking.countDocuments(query)
  ]);

  const totalPages = Math.ceil(totalItems / limit);

  return {
    bookings: transformBookings(bookings) as unknown as IBookingDocument[],
    pagination: {
      currentPage: page,
      totalPages,
      totalItems,
      itemsPerPage: limit
    }
  };
};

export const updateBookingStatus = async (bookingId: string, status: BookingStatus): Promise<IBookingDocument> => {
  const booking = await ensureDocumentExists(Booking, bookingId, 'Booking not found');

  // Validate status transition
  const validTransitions: Record<string, BookingStatus[]> = {
    PENDING: ['CONFIRMED', 'CANCELLED'],
    CONFIRMED: ['IN_PROGRESS', 'CANCELLED'],
    IN_PROGRESS: ['COMPLETED', 'CANCELLED'],
    COMPLETED: [], // No transitions from completed
    CANCELLED: [] // No transitions from cancelled
  };

  const currentStatus = booking.status;
  const allowedTransitions = currentStatus 
    ? validTransitions[currentStatus as keyof typeof validTransitions] 
    : undefined;
  if (currentStatus && allowedTransitions && !allowedTransitions.includes(status)) {
    throw new AppError(`Cannot transition from ${currentStatus} to ${status}`, 400);
  }

  const updatedBooking = await standardUpdate(Booking, bookingId, { status });

  if (!updatedBooking) {
    throw new AppError('Failed to update booking status', 500);
  }

  // Emit WebSocket event for real-time updates
  emitBookingUpdate({
    bookingId: String(updatedBooking._id),
    status: updatedBooking.status,
    locationId: String(updatedBooking.locationId),
    userId: String(updatedBooking.userId),
    timestamp: new Date()
  });

  return updatedBooking;
};

export const getBookingById = async (bookingId: string): Promise<IBookingDocument> => {
  const booking = await Booking.findById(bookingId)
    .populate('userId', 'email profile.name')
    .populate('locationId', 'name address');

  if (!booking) {
    throw new AppError('Booking not found', 404);
  }

  return booking;
};

export const deleteBooking = async (bookingId: string): Promise<void> => {
  const booking = await ensureDocumentExists(Booking, bookingId, 'Booking not found');

  // Check if booking can be deleted (business rules)
  if (booking.status === 'IN_PROGRESS' || booking.status === 'COMPLETED') {
    throw new AppError('Cannot delete bookings that are in progress or completed', 400);
  }

  await Booking.findByIdAndDelete(bookingId);

  // Emit WebSocket event for real-time updates
  emitBookingUpdate({
    bookingId: String(booking._id),
    status: 'CANCELLED', // Treat deletion as cancellation for WebSocket purposes
    locationId: String(booking.locationId),
    userId: String(booking.userId),
    timestamp: new Date()
  });
};