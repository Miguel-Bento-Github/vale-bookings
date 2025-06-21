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

interface IUserWithStatistics extends IUserDocument {
  statistics?: {
    totalBookings: number;
    completedBookings: number;
    totalRevenue: number;
  };
}

interface IBookingAggregationResult {
  _id: null;
  totalBookings: number;
  completedBookings: number;
  totalRevenue: number;
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

class AdminService {
  // User Management
  async getAllUsers(options: IPaginationOptions): Promise<{
    users: IUserDocument[];
    pagination: {
      currentPage: number;
      totalPages: number;
      totalItems: number;
      itemsPerPage: number;
    };
  }> {
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
  }

  async updateUserRole(userId: string, role: UserRole): Promise<IUserDocument> {
    const user = await standardUpdate(User, userId, { role } as Partial<IUserDocument>);

    if (!user) {
      throw new AppError('User not found', 404);
    }

    // Remove password from response
    const userObj = user.toObject() as Record<string, unknown>;
    delete userObj.password;
    return userObj as unknown as IUserDocument;
  }

  async deleteUser(userId: string): Promise<void> {
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
  }

  // Valet Management
  async getAllValets(): Promise<IUserWithStatistics[]> {
    const valets = await User.find({ role: 'VALET' }).select('-password');
    
    // Add statistics for each valet
    const valetsWithStats = await Promise.all(
      valets.map(async (valet) => {
        const bookingStats = await Booking.aggregate([
          {
            $match: {
              // For now, we'll calculate based on all bookings
              // In a real system, you might have a valetId field
            }
          },
          {
            $group: {
              _id: null,
              totalBookings: { $sum: 1 },
              completedBookings: {
                $sum: { $cond: [{ $eq: ['$status', 'COMPLETED'] }, 1, 0] }
              },
              totalRevenue: {
                $sum: { $cond: [{ $eq: ['$status', 'COMPLETED'] }, '$price', 0] }
              }
            }
          }
        ]);

        const stats: IBookingAggregationResult = (bookingStats[0] as IBookingAggregationResult) ?? {
          _id: null,
          totalBookings: 0,
          completedBookings: 0,
          totalRevenue: 0
        };

        return {
          _id: String(valet._id),
          email: valet.email,
          role: valet.role,
          profile: valet.profile,
          createdAt: valet.createdAt as Date,
          updatedAt: valet.updatedAt as Date,
          statistics: {
            totalBookings: stats.totalBookings,
            completedBookings: stats.completedBookings,
            totalRevenue: stats.totalRevenue
          }
        } as IUserWithStatistics;
      })
    );

    return valetsWithStats;
  }

  async createValet(valetData: {
    email: string;
    password: string;
    profile: { name: string; phone?: string };
    role: UserRole;
  }): Promise<IUserDocument> {
    await checkDocumentExists(
      User,
      { email: valetData.email },
      'Email already exists'
    );

    return await createWithDuplicateHandling(
      User,
      valetData,
      'Email already exists'
    );
  }

  async updateValet(valetId: string, updateData: {
    profile?: { name?: string; phone?: string };
  }): Promise<IUserDocument> {
    const valet = await User.findOneAndUpdate(
      { _id: valetId, role: 'VALET' },
      updateData,
      { new: true, runValidators: true }
    ).select('-password');

    if (!valet) {
      throw new AppError('Valet not found', 404);
    }

    return valet;
  }

  async deleteValet(valetId: string): Promise<void> {
    const valet = await User.findOne({ _id: valetId, role: 'VALET' });
    
    if (!valet) {
      throw new AppError('Valet not found', 404);
    }

    await User.findByIdAndDelete(valetId);
  }

  // Location Management
  async createLocation(locationData: ICreateLocationRequest): Promise<ILocationDocument> {
    // Validate coordinates
    const { latitude, longitude } = locationData.coordinates;
    if (latitude < -90 || latitude > 90 || longitude < -180 || longitude > 180) {
      throw new AppError('Invalid coordinates', 400);
    }

    return await createWithDuplicateHandling(
      Location,
      { ...locationData, isActive: true },
      'Location already exists'
    );
  }

  async updateLocation(locationId: string, updateData: IUpdateLocationRequest): Promise<ILocationDocument> {
    // Validate coordinates if provided
    if (updateData.coordinates) {
      const { latitude, longitude } = updateData.coordinates;
      if (latitude < -90 || latitude > 90 || longitude < -180 || longitude > 180) {
        throw new AppError('Invalid coordinates', 400);
      }
    }

    const location = await standardUpdate(Location, locationId, updateData as Partial<ILocationDocument>);

    if (!location) {
      throw new AppError('Location not found', 404);
    }

    return location;
  }

  async deleteLocation(locationId: string): Promise<void> {
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
  }

  // Schedule Management
  async getAllSchedules(): Promise<IScheduleDocument[]> {
    const schedules = await Schedule.find({})
      .populate('locationId', 'name address')
      .sort({ locationId: 1, dayOfWeek: 1 });

    return schedules;
  }

  async createSchedule(scheduleData: ICreateScheduleRequest): Promise<IScheduleDocument> {
    await checkDocumentExists(
      Schedule,
      { locationId: scheduleData.locationId, dayOfWeek: scheduleData.dayOfWeek },
      'Schedule already exists for this location and day'
    );

    return await createWithDuplicateHandling(
      Schedule,
      { ...scheduleData, isActive: true },
      'Schedule already exists for this location and day'
    );
  }

  async updateSchedule(scheduleId: string, updateData: IUpdateScheduleRequest): Promise<IScheduleDocument> {
    const schedule = await standardUpdate(Schedule, scheduleId, updateData as Partial<IScheduleDocument>);

    if (!schedule) {
      throw new AppError('Schedule not found', 404);
    }

    return schedule;
  }

  async deleteSchedule(scheduleId: string): Promise<void> {
    await safeDelete(Schedule, scheduleId, 'Schedule not found');
  }

  async createBulkSchedules(
    locationId: string, 
    schedules: ICreateScheduleRequest[]
  ): Promise<IBulkScheduleResult> {
    const result: IBulkScheduleResult = {
      successful: [],
      failed: []
    };

    for (const scheduleData of schedules) {
      try {
        const schedule = await this.createSchedule({
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
  }

  // Booking Oversight
  async getAllBookings(filters: IBookingFilters): Promise<IBookingDocument[]> {
    const query: IBookingQuery = {};

    if (filters.status) {
      query.status = filters.status;
    }

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
          // Use UTC to avoid timezone issues
          const startDate = new Date(Date.UTC(year, month - 1, day)); // month is 0-indexed
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
          // Use UTC to avoid timezone issues
          const endDate = new Date(Date.UTC(year, month - 1, day)); // month is 0-indexed
          endDate.setUTCHours(23, 59, 59, 999);
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
  }

  async updateBookingStatus(bookingId: string, status: BookingStatus): Promise<IBookingDocument> {
    const booking = await ensureDocumentExists(Booking, bookingId, 'Booking not found');

    // Validate status transitions
    const validTransitions: Record<BookingStatus, BookingStatus[]> = {
      'PENDING': ['CONFIRMED', 'CANCELLED'],
      'CONFIRMED': ['IN_PROGRESS', 'CANCELLED'],
      'IN_PROGRESS': ['COMPLETED', 'CANCELLED'],
      'COMPLETED': [],
      'CANCELLED': []
    };

    if (!validTransitions[booking.status].includes(status)) {
      throw new AppError(`Cannot change status from ${booking.status} to ${status}`, 400);
    }

    const updatedBooking = await standardUpdate(Booking, bookingId, { status } as Partial<IBookingDocument>);

    if (!updatedBooking) {
      throw new AppError('Failed to update booking', 500);
    }

    return updatedBooking;
  }

  // Analytics
  async getAnalyticsOverview(): Promise<{
    totalUsers: number;
    totalBookings: number;
    totalRevenue: number;
    activeLocations: number;
  }> {
    const [totalUsers, totalBookings, revenueData, activeLocations] = await Promise.all([
      User.countDocuments({}),
      Booking.countDocuments({}),
      Booking.aggregate([
        { $match: { status: 'COMPLETED' } },
        { $group: { _id: null, totalRevenue: { $sum: '$price' } } }
      ]) as unknown as Array<{ _id: null; totalRevenue: number }>,
      Location.countDocuments({ isActive: true })
    ]);

    const totalRevenue = revenueData[0]?.totalRevenue ?? 0;

    return {
      totalUsers,
      totalBookings,
      totalRevenue,
      activeLocations
    };
  }

  async getRevenueAnalytics(filters: IRevenueFilters): Promise<{
    totalRevenue: number;
    monthlyRevenue: Array<{ month: string; revenue: number }>;
    averageBookingValue: number;
  }> {
    const matchStage: IRevenueMatchStage = { status: 'COMPLETED' };

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
          // Use UTC to avoid timezone issues
          const startDate = new Date(Date.UTC(year, month - 1, day)); // month is 0-indexed
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
          // Use UTC to avoid timezone issues
          const endDate = new Date(Date.UTC(year, month - 1, day)); // month is 0-indexed
          endDate.setUTCHours(23, 59, 59, 999);
          dateRange.$lte = endDate;
        }
      }
      // Only add dateRange to matchStage if it has valid properties
      if (dateRange.$gte ?? dateRange.$lte) {
        matchStage.startTime = dateRange;
      }
    }

    const [revenueData, monthlyData] = await Promise.all([
      Booking.aggregate([
        { $match: matchStage },
        {
          $group: {
            _id: null,
            totalRevenue: { $sum: '$price' },
            totalBookings: { $sum: 1 },
            averageBookingValue: { $avg: '$price' }
          }
        }
      ]) as unknown as Array<{
        _id: null;
        totalRevenue: number;
        totalBookings: number;
        averageBookingValue: number;
      }>,
      Booking.aggregate([
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
      ]) as unknown as Array<{ month: string; revenue: number }>
    ]);

    const stats = revenueData[0] ?? {
      _id: null,
      totalRevenue: 0,
      totalBookings: 0,
      averageBookingValue: 0
    };

    return {
      totalRevenue: stats.totalRevenue,
      monthlyRevenue: monthlyData,
      averageBookingValue: stats.averageBookingValue
    };
  }

  async getBookingAnalytics(): Promise<{
    totalBookings: number;
    bookingsByStatus: Array<{ status: string; count: number }>;
    bookingsByLocation: Array<{ location: string; count: number }>;
    dailyBookings: Array<{ date: string; count: number }>;
  }> {
    const [totalBookings, statusData, locationData, dailyData] = await Promise.all([
      Booking.countDocuments({}),
      Booking.aggregate([
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
      ]) as unknown as Array<{ status: string; count: number }>,
      Booking.aggregate([
        {
          $lookup: {
            from: 'locations',
            localField: 'locationId',
            foreignField: '_id',
            as: 'location'
          }
        },
        { $unwind: '$location' },
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
        }
      ]) as unknown as Array<{ location: string; count: number }>,
      Booking.aggregate([
        {
          $group: {
            _id: {
              $dateToString: {
                format: '%Y-%m-%d',
                date: '$startTime'
              }
            },
            count: { $sum: 1 }
          }
        },
        {
          $project: {
            date: '$_id',
            count: 1,
            _id: 0
          }
        },
        { $sort: { date: 1 } }
      ]) as unknown as Array<{ date: string; count: number }>
    ]);

    return {
      totalBookings,
      bookingsByStatus: statusData,
      bookingsByLocation: locationData,
      dailyBookings: dailyData
    };
  }
}

export default new AdminService(); 