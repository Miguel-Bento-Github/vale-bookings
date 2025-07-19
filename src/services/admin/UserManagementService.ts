import mongoose from 'mongoose';

import { ERROR_MESSAGES } from '../../constants';
import Booking from '../../models/Booking';
import Payment from '../../models/Payment';
import User from '../../models/User';
import { 
  IUserDocument,
  UserRole,
  AppError,
  IPaginationOptions
} from '../../types';
import {
  standardUpdate,
  createWithDuplicateHandling,
  ensureDocumentExists,
  safeDelete
} from '../../utils/mongoHelpers';
import { emitUserManagementUpdate } from '../WebSocketService';

export interface IUserFilters extends IPaginationOptions {
  role?: string;
  search?: string;
  status?: string;
  sortBy?: string;
  sortOrder?: string;
}

interface BookingStatsResult {
  totalBookings: number;
  completedBookings: number;
  cancelledBookings: number;
  totalSpent: number;
}

export const createUser = async (userData: {
  email: string;
  password: string;
  role: UserRole;
  profile: {
    name: string;
    phone?: string;
  };
}): Promise<IUserDocument> => {
  const user = await createWithDuplicateHandling(
    User,
    userData,
    ERROR_MESSAGES.USER_ALREADY_EXISTS
  );

  // Emit WebSocket event for real-time updates
  emitUserManagementUpdate({
    userId: String(user._id),
    action: 'created',
    userEmail: user.email,
    userRole: user.role,
    timestamp: new Date()
  });

  return user;
};

export const getUserById = async (userId: string): Promise<IUserDocument> => {
  const user = await ensureDocumentExists(User, userId, 'User not found');
  
  // Remove password from response
  const userObj = user.toObject() as Record<string, unknown>;
  delete userObj.password;
  return userObj as unknown as IUserDocument;
};

export const getAllUsers = async (options: IUserFilters): Promise<{
  users: IUserDocument[];
  pagination: {
    currentPage: number;
    totalPages: number;
    totalItems: number;
    itemsPerPage: number;
  };
}> => {
  const page = (typeof options.page === 'number' && options.page > 0) ? options.page : 1;
  const limit = (typeof options.limit === 'number' && options.limit > 0) ? options.limit : 10;
  const skip = (page - 1) * limit;

  // Build query
  const query: Record<string, unknown> = {};

  // Role filter
  if (typeof options.role === 'string' && options.role.trim().length > 0) {
    query.role = options.role;
  }

  // Search filter
  if (typeof options.search === 'string' && options.search.trim().length > 0) {
    const escapedSearch = options.search.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    // eslint-disable-next-line security/detect-non-literal-regexp
    const searchRegex = new RegExp(escapedSearch, 'i');
    query.$or = [
      { email: searchRegex },
      { 'profile.name': searchRegex }
    ];
  }

  // Build sort
  const sortBy = options.sortBy ?? 'createdAt';
  const sortOrder = options.sortOrder === 'asc' ? 1 : -1;
  const sort: Record<string, 1 | -1> = {
    [sortBy]: sortOrder
  };

  const [users, totalItems] = await Promise.all([
    User.find(query)
      .select('-password')
      .skip(skip)
      .limit(limit)
      .sort(sort),
    User.countDocuments(query)
  ]);

  const totalPages = Math.ceil(totalItems / limit);

  return {
    users,
    pagination: {
      currentPage: page,
      totalPages,
      totalItems,
      itemsPerPage: limit
    }
  };
};

export const updateUser = async (userId: string, updateData: Partial<IUserDocument>): Promise<IUserDocument> => {
  const user = await standardUpdate(User, userId, updateData);

  if (!user) {
    throw new AppError('User not found', 404);
  }

  // Emit WebSocket event for real-time updates
  emitUserManagementUpdate({
    userId: String(user._id),
    action: 'updated',
    userEmail: user.email,
    userRole: user.role,
    timestamp: new Date()
  });

  // Remove password from response
  const userObj = user.toObject() as Record<string, unknown>;
  delete userObj.password;
  return userObj as unknown as IUserDocument;
};

export const updateUserRole = async (userId: string, role: UserRole): Promise<IUserDocument> => {
  const user = await standardUpdate(User, userId, { role } as Partial<IUserDocument>);

  if (!user) {
    throw new AppError('User not found', 404);
  }

  // Emit WebSocket event for real-time updates
  emitUserManagementUpdate({
    userId: String(user._id),
    action: 'updated',
    userEmail: user.email,
    userRole: user.role,
    timestamp: new Date()
  });

  // Remove password from response
  const userObj = user.toObject() as Record<string, unknown>;
  delete userObj.password;
  return userObj as unknown as IUserDocument;
};

export const getUserStats = async (userId: string): Promise<{
  totalBookings: number;
  completedBookings: number;
  cancelledBookings: number;
  totalSpent: number;
  averageRating: number;
  lastActivity: string;
}> => {
  // Ensure user exists
  await ensureDocumentExists(User, userId, 'User not found');

  // Convert string userId to ObjectId for MongoDB query
  const userObjectId = new mongoose.Types.ObjectId(userId);

  // Get booking statistics
  const bookingStats = await Booking.aggregate<BookingStatsResult>([
    { $match: { userId: userObjectId } },
    {
      $group: {
        _id: null,
        totalBookings: { $sum: 1 },
        completedBookings: {
          $sum: { $cond: [{ $eq: ['$status', 'COMPLETED'] }, 1, 0] }
        },
        cancelledBookings: {
          $sum: { $cond: [{ $eq: ['$status', 'CANCELLED'] }, 1, 0] }
        },
        totalSpent: {
          $sum: { $cond: [{ $eq: ['$status', 'COMPLETED'] }, '$price', 0] }
        }
      }
    }
  ]);

  // Get last activity (most recent booking)
  const lastBooking = await Booking.findOne({ userId: userObjectId })
    .sort({ createdAt: -1 })
    .select('createdAt');

  const stats: BookingStatsResult = bookingStats.length > 0 && bookingStats[0] ? bookingStats[0] : {
    totalBookings: 0,
    completedBookings: 0,
    cancelledBookings: 0,
    totalSpent: 0
  };

  return {
    totalBookings: stats.totalBookings,
    completedBookings: stats.completedBookings,
    cancelledBookings: stats.cancelledBookings,
    totalSpent: stats.totalSpent,
    averageRating: 0, // TODO: Implement rating system
    lastActivity: lastBooking?.createdAt ? lastBooking.createdAt.toISOString() : new Date().toISOString()
  };
};

export const deleteUser = async (userId: string): Promise<void> => {
  await ensureDocumentExists(User, userId, 'User not found');

  // Convert string userId to ObjectId for MongoDB query
  const userObjectId = new mongoose.Types.ObjectId(userId);

  // Check if user has any bookings (including completed/cancelled)
  const totalBookings = await Booking.countDocuments({
    userId: userObjectId
  });

  // Get detailed information about active bookings
  const activeBookings = await Booking.find({
    userId: userObjectId,
    status: { $in: ['PENDING', 'CONFIRMED', 'IN_PROGRESS'] }
  })
    .populate('locationId', 'name')
    .select('_id status startTime endTime locationId')
    .lean();

  // Check if user has any payments
  const totalPayments = await Payment.countDocuments({
    userId: userObjectId
  });

  // eslint-disable-next-line no-console
  console.log(
    `Delete user ${userId}: Bookings: ${totalBookings}, Active: ${activeBookings.length}, Payments: ${totalPayments}`
  );

  if (activeBookings.length > 0) {
    // eslint-disable-next-line no-console
    console.log('Active bookings details:', activeBookings.map(booking => {
      const locationId = booking.locationId as { name?: string } | null;
      return {
        id: String(booking._id),
        status: booking.status,
        startTime: booking.startTime,
        location: locationId?.name ?? 'Unknown'
      };
    }));

    // Create detailed error message with booking information
    const bookingDetails = activeBookings.map(booking => {
      const locationId = booking.locationId as { name?: string } | null;
      const locationName = locationId?.name ?? 'Unknown Location';
      const startDate = new Date(booking.startTime).toLocaleDateString();
      return `${booking.status} booking at ${locationName} on ${startDate}`;
    });

    throw new AppError(
      `Cannot delete user with ${activeBookings.length} active bookings: ${bookingDetails.join(', ')}. ` +
      'Please cancel or complete these bookings first.',
      400
    );
  }

  // For now, allow deletion even with completed bookings and payments
  // In a production system, you might want to:
  // 1. Archive the user instead of deleting
  // 2. Cascade delete related records
  // 3. Or prevent deletion entirely if there are any financial records

  await safeDelete(User, userId, 'User not found');

  // Emit WebSocket event for real-time updates
  emitUserManagementUpdate({
    userId: userId,
    action: 'deleted',
    timestamp: new Date()
  });
};