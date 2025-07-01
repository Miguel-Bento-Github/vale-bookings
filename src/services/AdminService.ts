import { ERROR_MESSAGES } from '../constants';
import Booking from '../models/Booking';
import Location from '../models/Location';
import Schedule from '../models/Schedule';
import User from '../models/User';
import { 
  IUserDocument, 
  ILocationDocument, 
  IBookingDocument, 
  IScheduleDocument,
  UserRole, 
  BookingStatus,
  ICreateLocationRequest,
  IUpdateLocationRequest,
  ICreateScheduleRequest,
  IUpdateScheduleRequest,
  IPaginationOptions,
  AppError,
  IBookingQuery,
  IRevenueMatchStage,
  IDateRangeQuery
} from '../types';
import {
  standardUpdate,
  createWithDuplicateHandling,
  ensureDocumentExists,
  safeDelete,
  checkDocumentExists
} from '../utils/mongoHelpers';

import { emitBookingUpdate, sendUserNotification } from './WebSocketService';

interface IUserWithStatistics extends IUserDocument {
  statistics?: {
    totalBookings: number;
    completedBookings: number;
    totalRevenue: number;
  };
}

interface IBookingFilters {
  status?: BookingStatus;
  startDate?: string;
  endDate?: string;
}

interface IRevenueFilters {
  startDate?: string;
  endDate?: string;
}

interface IBulkScheduleResult {
  successful: IScheduleDocument[];
  failed: Array<{
    schedule: ICreateScheduleRequest;
    error: string;
  }>;
}

// User Management Functions
export const getAllUsers = async (options: IPaginationOptions): Promise<{
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

  const [users, totalItems] = await Promise.all([
    User.find({})
      .select('-password')
      .skip(skip)
      .limit(limit)
      .sort({ createdAt: -1 }),
    User.countDocuments({})
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

export const updateUserRole = async (userId: string, role: UserRole): Promise<IUserDocument> => {
  const user = await standardUpdate(User, userId, { role } as Partial<IUserDocument>);

  if (!user) {
    throw new AppError('User not found', 404);
  }

  // Remove password from response
  const userObj = user.toObject() as Record<string, unknown>;
  delete userObj.password;
  return userObj as unknown as IUserDocument;
};

export const deleteUser = async (userId: string): Promise<void> => {
  await ensureDocumentExists(User, userId, 'User not found');

  // Check if user has active bookings
  const activeBookings = await Booking.countDocuments({
    userId,
    status: { $in: ['PENDING', 'CONFIRMED', 'IN_PROGRESS'] }
  });

  if (activeBookings > 0) {
    throw new AppError('Cannot delete user with active bookings', 400);
  }

  await safeDelete(User, userId, 'User not found');
};

// Valet Management Functions
export const getAllValets = async (): Promise<IUserWithStatistics[]> => {
  const valets = await User.find({ role: 'VALET' }).select('-password').lean();

  // Add statistics for each valet
  // For now, return empty statistics to avoid the expensive aggregation
  // In a real system, you would have a valetId field on bookings to filter properly
  const valetsWithStats = valets.map((valet) => {
      return {
        _id: String(valet._id),
        email: valet.email,
        role: valet.role,
        profile: valet.profile,
        createdAt: valet.createdAt as Date,
        updatedAt: valet.updatedAt as Date,
        statistics: {
        totalBookings: 0,
        completedBookings: 0,
        totalRevenue: 0
        }
      } as IUserWithStatistics;
  });

  return valetsWithStats;
};

export const createValet = async (valetData: {
  email: string;
  password: string;
  profile: { name: string; phone?: string };
  role: UserRole;
}): Promise<IUserDocument> => {
  await checkDocumentExists(
    User,
    { email: valetData.email },
    ERROR_MESSAGES.EMAIL_ALREADY_EXISTS
  );

  return await createWithDuplicateHandling(
    User,
    valetData,
    ERROR_MESSAGES.EMAIL_ALREADY_EXISTS
  );
};

export const updateValet = async (valetId: string, updateData: {
  profile?: { name?: string; phone?: string };
}): Promise<IUserDocument> => {
  const user = await standardUpdate(User, valetId, updateData as Partial<IUserDocument>);

  if (!user) {
    throw new AppError('Valet not found', 404);
  }

  // Remove password from response
  const userObj = user.toObject() as Record<string, unknown>;
  delete userObj.password;
  return userObj as unknown as IUserDocument;
};

export const deleteValet = async (valetId: string): Promise<void> => {
  await ensureDocumentExists(User, valetId, 'Valet not found');
  await safeDelete(User, valetId, 'Valet not found');
};

// Location Management Functions
export const createLocation = async (locationData: ICreateLocationRequest): Promise<ILocationDocument> => {
  // Validate coordinates
  const { latitude, longitude } = locationData.coordinates;
  if (latitude < -90 || latitude > 90 || longitude < -180 || longitude > 180) {
    throw new AppError('Invalid coordinates', 400);
  }

  // Check for duplicate location at same coordinates
  await checkDocumentExists(
    Location,
    {
      'coordinates.latitude': locationData.coordinates.latitude,
      'coordinates.longitude': locationData.coordinates.longitude
    },
    'Location already exists at these coordinates'
  );

  return await createWithDuplicateHandling(
    Location,
    { ...locationData, isActive: true },
    'Location already exists at these coordinates'
  );
};

export const updateLocation = async (
  locationId: string,
  updateData: IUpdateLocationRequest
): Promise<ILocationDocument> => {
  // Validate coordinates if provided
  if (updateData.coordinates) {
    const { latitude, longitude } = updateData.coordinates;
    if (latitude < -90 || latitude > 90 || longitude < -180 || longitude > 180) {
      throw new AppError('Invalid coordinates', 400);
    }

    // Check for duplicates
    const existingLocation = await Location.findOne({
      _id: { $ne: locationId },
      'coordinates.latitude': updateData.coordinates.latitude,
      'coordinates.longitude': updateData.coordinates.longitude
    });

    if (existingLocation) {
      throw new AppError('Location already exists at these coordinates', 400);
    }
  }

  const location = await standardUpdate(Location, locationId, updateData as Partial<ILocationDocument>);

  if (!location) {
    throw new AppError('Location not found', 404);
  }

  return location;
};

export const deleteLocation = async (locationId: string): Promise<void> => {
  await ensureDocumentExists(Location, locationId, 'Location not found');

  // Check if location has active bookings
  const activeBookings = await Booking.countDocuments({
    locationId,
    status: { $in: ['PENDING', 'CONFIRMED', 'IN_PROGRESS'] }
  });

  if (activeBookings > 0) {
    throw new AppError('Cannot delete location with active bookings', 400);
  }

  await safeDelete(Location, locationId, 'Location not found');
};

// Schedule Management Functions
export const getAllSchedules = async (): Promise<IScheduleDocument[]> => {
  const schedules = await Schedule.find({})
    .populate('locationId', 'name address')
    .sort({ locationId: 1, dayOfWeek: 1 });

  return schedules;
};

export const createSchedule = async (scheduleData: ICreateScheduleRequest): Promise<IScheduleDocument> => {
  // Check if schedule already exists for this location and day
  await checkDocumentExists(
    Schedule,
    {
      locationId: scheduleData.locationId,
      dayOfWeek: scheduleData.dayOfWeek
    },
    'Schedule already exists for this location and day'
  );

  return await createWithDuplicateHandling(
    Schedule,
    { ...scheduleData, isActive: true },
    'Schedule already exists for this location and day'
  );
};

export const updateSchedule = async (
  scheduleId: string,
  updateData: IUpdateScheduleRequest
): Promise<IScheduleDocument> => {
  const schedule = await standardUpdate(Schedule, scheduleId, updateData as Partial<IScheduleDocument>);

  if (!schedule) {
    throw new AppError('Schedule not found', 404);
  }

  return schedule;
};

export const deleteSchedule = async (scheduleId: string): Promise<void> => {
  await safeDelete(Schedule, scheduleId, 'Schedule not found');
};

export const createBulkSchedules = async (
  locationId: string,
  schedules: ICreateScheduleRequest[]
): Promise<IBulkScheduleResult> => {
  const result: IBulkScheduleResult = {
    successful: [],
    failed: []
  };

  for (const scheduleData of schedules) {
    try {
      const schedule = await createSchedule({
        ...scheduleData,
        locationId
      });
      result.successful.push(schedule);
    } catch (error) {
      result.failed.push({
        schedule: scheduleData,
        error: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  }

  return result;
};

// Booking Management Functions
export const getAllBookings = async (filters: IBookingFilters): Promise<IBookingDocument[]> => {
  const query: IBookingQuery = {};

  // Apply status filter
  if (filters.status) {
    query.status = filters.status;
  }

  // Apply date range filter
  if (typeof filters.startDate === 'string' || typeof filters.endDate === 'string') {
    const dateRange: IDateRangeQuery = {};
    if (typeof filters.startDate === 'string') {
      // Parse date string as UTC to avoid timezone issues
      const dateParts = filters.startDate.split('-').map(Number);
      const isValidDateParts = dateParts.length === 3 &&
        typeof dateParts[0] === 'number' &&
        typeof dateParts[1] === 'number' &&
        typeof dateParts[2] === 'number';

      if (isValidDateParts) {
        const year = dateParts[0] as number;
        const month = dateParts[1] as number;
        const day = dateParts[2] as number;
        // Construct start of day in local timezone to align with provided date string
        const startDate = new Date(year, month - 1, day, 0, 0, 0, 0); // Local midnight
        dateRange.$gte = startDate;
      }
    }
    if (typeof filters.endDate === 'string') {
      // Parse date string as UTC and set to end of day
      const dateParts = filters.endDate.split('-').map(Number);
      const isValidDateParts = dateParts.length === 3 &&
        typeof dateParts[0] === 'number' &&
        typeof dateParts[1] === 'number' &&
        typeof dateParts[2] === 'number';

      if (isValidDateParts) {
        const year = dateParts[0] as number;
        const month = dateParts[1] as number;
        const day = dateParts[2] as number;
        // Construct end of day in local timezone
        const endDate = new Date(year, month - 1, day, 23, 59, 59, 999);
        dateRange.$lte = endDate;
      }
    }
    // Only add dateRange to query if it has valid properties
    if (dateRange.$gte ?? dateRange.$lte) {
      query.startTime = dateRange;
    }
  }

  const bookings = await Booking.find(query)
    .populate('userId', 'email profile.name')
    .populate('locationId', 'name address')
    .sort({ startTime: -1 });

  return bookings;
};

export const updateBookingStatus = async (bookingId: string, status: BookingStatus): Promise<IBookingDocument> => {
  const booking = await Booking.findById(bookingId);

  if (!booking) {
    throw new AppError('Booking not found', 404);
  }

  // Validate status transition
  const validTransitions: Record<BookingStatus, BookingStatus[]> = {
    PENDING: ['CONFIRMED', 'CANCELLED'],
    CONFIRMED: ['IN_PROGRESS', 'CANCELLED'],
    IN_PROGRESS: ['COMPLETED', 'CANCELLED'],
    COMPLETED: [],
    CANCELLED: []
  };

  const allowedStatuses = validTransitions[booking.status];
  if (!allowedStatuses.includes(status)) {
    throw new AppError(
      `Cannot transition from ${booking.status} to ${status}`,
      400
    );
  }

  const updatedBooking = await standardUpdate(Booking, bookingId, { status } as Partial<IBookingDocument>);

  if (!updatedBooking) {
    throw new AppError('Failed to update booking', 500);
  }

  // Emit WebSocket event for status update
  emitBookingUpdate({
    bookingId: String(updatedBooking._id),
    status: updatedBooking.status,
    locationId: String(updatedBooking.locationId),
    userId: String(updatedBooking.userId),
    timestamp: new Date()
  });

  // Send notification for important status changes
  if (['COMPLETED', 'CANCELLED'].includes(status)) {
    const notificationType = status === 'COMPLETED' ? 'booking_completed' : 'booking_cancelled';
    const title = status === 'COMPLETED' ? 'Booking Completed' : 'Booking Cancelled';
    const message = status === 'COMPLETED'
      ? 'Your valet parking service has been completed'
      : 'Your valet parking booking has been cancelled';

    sendUserNotification({
      userId: String(updatedBooking.userId),
      type: notificationType,
      title,
      message,
      data: {
        bookingId: String(updatedBooking._id),
        locationId: String(updatedBooking.locationId)
      },
      timestamp: new Date()
    });
  }

  return updatedBooking;
};

// Analytics Functions
export const getAnalyticsOverview = async (): Promise<{
  totalUsers: number;
  totalBookings: number;
  totalRevenue: number;
  activeLocations: number;
}> => {
  const [totalUsers, totalBookings, revenueResult, activeLocations] = await Promise.all([
    User.countDocuments({}),
    Booking.countDocuments({}),
    Booking.aggregate([
      { $match: { status: 'COMPLETED' } },
      { $group: { _id: null, total: { $sum: '$price' } } }
    ]),
    Location.countDocuments({ isActive: true })
  ]);

  const totalRevenue = revenueResult.length > 0 ? (revenueResult[0] as { total: number }).total : 0;

  return {
    totalUsers,
    totalBookings,
    totalRevenue,
    activeLocations
  };
};

export const getRevenueAnalytics = async (filters: IRevenueFilters): Promise<{
  totalRevenue: number;
  monthlyRevenue: Array<{ month: string; revenue: number }>;
  averageBookingValue: number;
}> => {
  // Build match stage for date filtering
  const matchStage: IRevenueMatchStage = {
    status: 'COMPLETED'
  };

  if (typeof filters.startDate === 'string' || typeof filters.endDate === 'string') {
    const dateQuery: IDateRangeQuery = {};

    if (typeof filters.startDate === 'string') {
      // Parse date string as UTC to avoid timezone issues
      const dateParts = filters.startDate.split('-').map(Number);
      const isValidDateParts = dateParts.length === 3 &&
        typeof dateParts[0] === 'number' &&
        typeof dateParts[1] === 'number' &&
        typeof dateParts[2] === 'number';

      if (isValidDateParts) {
        const year = dateParts[0] as number;
        const month = dateParts[1] as number;
        const day = dateParts[2] as number;
        // Construct start of day in local timezone to align with provided date string
        const startDate = new Date(year, month - 1, day, 0, 0, 0, 0); // Local midnight
        dateQuery.$gte = startDate;
      }
    }

    if (typeof filters.endDate === 'string') {
      // Parse date string as UTC and set to end of day
      const dateParts = filters.endDate.split('-').map(Number);
      const isValidDateParts = dateParts.length === 3 &&
        typeof dateParts[0] === 'number' &&
        typeof dateParts[1] === 'number' &&
        typeof dateParts[2] === 'number';

      if (isValidDateParts) {
        const year = dateParts[0] as number;
        const month = dateParts[1] as number;
        const day = dateParts[2] as number;
        // Construct end of day in local timezone
        const endDate = new Date(year, month - 1, day, 23, 59, 59, 999);
        dateQuery.$lte = endDate;
      }
    }

    // Only add dateQuery to matchStage if it has valid properties
    if (dateQuery.$gte ?? dateQuery.$lte) {
      matchStage.startTime = dateQuery;
    }
  }

  // Get total revenue and booking count
  const totalRevenueResult = await Booking.aggregate([
    { $match: matchStage },
    {
      $group: {
        _id: null,
        totalRevenue: { $sum: '$price' },
        totalBookings: { $sum: 1 }
      }
    }
  ]) as unknown as Array<{
    _id: null;
    totalRevenue: number;
    totalBookings: number;
  }>;

  const totalStats = totalRevenueResult[0] ?? { totalRevenue: 0, totalBookings: 0 };

  // Get monthly revenue breakdown
  const monthlyRevenueResult = await Booking.aggregate([
    { $match: matchStage },
    {
      $group: {
        _id: {
          year: { $year: '$startTime' },
          month: { $month: '$startTime' }
        },
        revenue: { $sum: '$price' }
      }
    },
    {
      $project: {
        month: {
          $concat: [
            { $toString: '$_id.year' },
            '-',
            { $toString: '$_id.month' }
          ]
        },
        revenue: 1
      }
    },
    { $sort: { '_id.year': 1, '_id.month': 1 } }
  ]) as unknown as Array<{ month: string; revenue: number }>;

  const averageBookingValue = totalStats.totalBookings > 0
    ? totalStats.totalRevenue / totalStats.totalBookings
    : 0;

  return {
    totalRevenue: totalStats.totalRevenue,
    monthlyRevenue: monthlyRevenueResult,
    averageBookingValue
  };
};

export const getBookingAnalytics = async (): Promise<{
  totalBookings: number;
  bookingsByStatus: Array<{ status: string; count: number }>;
  bookingsByLocation: Array<{ location: string; count: number }>;
  dailyBookings: Array<{ date: string; count: number }>;
}> => {
  // Get total bookings
  const totalBookings = await Booking.countDocuments({});

  // Get bookings by status
  const bookingsByStatusResult = await Booking.aggregate([
    {
      $group: {
        _id: '$status',
        count: { $sum: 1 }
      }
    },
    {
      $project: {
        status: '$_id',
        count: 1,
        _id: 0
      }
    }
  ]);

  const bookingsByStatus = bookingsByStatusResult.map((item: { status: string; count: number }) => ({
    status: item.status,
    count: item.count
  }));

  // Get bookings by location
  const bookingsByLocationResult = await Booking.aggregate([
    {
      $lookup: {
        from: 'locations',
        localField: 'locationId',
        foreignField: '_id',
        as: 'location'
      }
    },
    {
      $unwind: '$location'
    },
    {
      $group: {
        _id: '$location.name',
        count: { $sum: 1 }
      }
    },
    {
      $project: {
        location: '$_id',
        count: 1,
        _id: 0
      }
    },
    {
      $sort: { count: -1 }
    }
  ]);

  const bookingsByLocation = bookingsByLocationResult.map((item: { location: string; count: number }) => ({
    location: item.location,
    count: item.count
  }));

  // Get daily bookings for the last 30 days
  const thirtyDaysAgo = new Date();
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

  const dailyBookingsResult = await Booking.aggregate([
    {
      $match: {
        createdAt: { $gte: thirtyDaysAgo }
      }
    },
    {
      $group: {
        _id: {
          year: { $year: '$createdAt' },
          month: { $month: '$createdAt' },
          day: { $dayOfMonth: '$createdAt' }
        },
        count: { $sum: 1 }
      }
    },
    {
      $project: {
        date: {
          $concat: [
            { $toString: '$_id.year' },
            '-',
            {
              $cond: {
                if: { $lt: ['$_id.month', 10] },
                then: { $concat: ['0', { $toString: '$_id.month' }] },
                else: { $toString: '$_id.month' }
              }
            },
            '-',
            {
              $cond: {
                if: { $lt: ['$_id.day', 10] },
                then: { $concat: ['0', { $toString: '$_id.day' }] },
                else: { $toString: '$_id.day' }
              }
            }
          ]
        },
        count: 1,
        _id: 0
      }
    },
    {
      $sort: { date: 1 }
    }
  ]);

  const dailyBookings = dailyBookingsResult.map((item: { date: string; count: number }) => ({
    date: item.date,
    count: item.count
  }));

  return {
    totalBookings,
    bookingsByStatus,
    bookingsByLocation,
    dailyBookings
  };
};

// Export object with all functions to maintain compatibility with existing imports
const AdminService = {
  getAllUsers,
  updateUserRole,
  deleteUser,
  getAllValets,
  createValet,
  updateValet,
  deleteValet,
  createLocation,
  updateLocation,
  deleteLocation,
  getAllSchedules,
  createSchedule,
  updateSchedule,
  deleteSchedule,
  createBulkSchedules,
  getAllBookings,
  updateBookingStatus,
  getAnalyticsOverview,
  getRevenueAnalytics,
  getBookingAnalytics
};

export default AdminService; 