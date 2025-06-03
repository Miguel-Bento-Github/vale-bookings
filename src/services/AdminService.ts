import User from '../models/User';
import Location from '../models/Location';
import Booking from '../models/Booking';
import Schedule from '../models/Schedule';
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
  AppError
} from '../types';

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
    const page = options.page || 1;
    const limit = options.limit || 10;
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
    const user = await User.findByIdAndUpdate(
      userId,
      { role },
      { new: true, runValidators: true }
    ).select('-password');

    if (!user) {
      throw new AppError('User not found', 404);
    }

    return user;
  }

  async deleteUser(userId: string): Promise<void> {
    const user = await User.findById(userId);
    
    if (!user) {
      throw new AppError('User not found', 404);
    }

    // Check if user has active bookings
    const activeBookings = await Booking.countDocuments({
      userId,
      status: { $in: ['PENDING', 'CONFIRMED', 'IN_PROGRESS'] }
    });

    if (activeBookings > 0) {
      throw new AppError('Cannot delete user with active bookings', 400);
    }

    await User.findByIdAndDelete(userId);
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

        const stats = bookingStats[0] || {
          totalBookings: 0,
          completedBookings: 0,
          totalRevenue: 0
        };

        return {
          ...valet.toObject(),
          statistics: stats
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
    // Check if email already exists
    const existingUser = await User.findOne({ email: valetData.email });
    if (existingUser) {
      throw new AppError('Email already exists', 400);
    }

    const valet = await User.create(valetData);
    return valet;
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

    const location = await Location.create({
      ...locationData,
      isActive: true
    });

    return location;
  }

  async updateLocation(locationId: string, updateData: IUpdateLocationRequest): Promise<ILocationDocument> {
    // Validate coordinates if provided
    if (updateData.coordinates) {
      const { latitude, longitude } = updateData.coordinates;
      if (latitude < -90 || latitude > 90 || longitude < -180 || longitude > 180) {
        throw new AppError('Invalid coordinates', 400);
      }
    }

    const location = await Location.findByIdAndUpdate(
      locationId,
      updateData,
      { new: true, runValidators: true }
    );

    if (!location) {
      throw new AppError('Location not found', 404);
    }

    return location;
  }

  async deleteLocation(locationId: string): Promise<void> {
    const location = await Location.findById(locationId);
    
    if (!location) {
      throw new AppError('Location not found', 404);
    }

    // Check if location has active bookings
    const activeBookings = await Booking.countDocuments({
      locationId,
      status: { $in: ['PENDING', 'CONFIRMED', 'IN_PROGRESS'] }
    });

    if (activeBookings > 0) {
      throw new AppError('Cannot delete location with active bookings', 400);
    }

    await Location.findByIdAndDelete(locationId);
  }

  // Schedule Management
  async getAllSchedules(): Promise<IScheduleDocument[]> {
    const schedules = await Schedule.find({})
      .populate('locationId', 'name address')
      .sort({ locationId: 1, dayOfWeek: 1 });

    return schedules;
  }

  async createSchedule(scheduleData: ICreateScheduleRequest): Promise<IScheduleDocument> {
    // Check for duplicate schedule
    const existingSchedule = await Schedule.findOne({
      locationId: scheduleData.locationId,
      dayOfWeek: scheduleData.dayOfWeek
    });

    if (existingSchedule) {
      throw new AppError('Schedule already exists for this location and day', 400);
    }

    const schedule = await Schedule.create({
      ...scheduleData,
      isActive: true
    });

    return schedule;
  }

  async updateSchedule(scheduleId: string, updateData: IUpdateScheduleRequest): Promise<IScheduleDocument> {
    const schedule = await Schedule.findByIdAndUpdate(
      scheduleId,
      updateData,
      { new: true, runValidators: true }
    );

    if (!schedule) {
      throw new AppError('Schedule not found', 404);
    }

    return schedule;
  }

  async deleteSchedule(scheduleId: string): Promise<void> {
    const schedule = await Schedule.findByIdAndDelete(scheduleId);
    
    if (!schedule) {
      throw new AppError('Schedule not found', 404);
    }
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
    const query: Record<string, any> = {};

    if (filters.status) {
      query.status = filters.status;
    }

    if (filters.startDate || filters.endDate) {
      query.startTime = {};
      if (filters.startDate) {
        (query.startTime as any).$gte = new Date(filters.startDate);
      }
      if (filters.endDate) {
        // Include the entire end date by setting to end of day
        const endDate = new Date(filters.endDate);
        endDate.setHours(23, 59, 59, 999);
        (query.startTime as any).$lte = endDate;
      }
    }

    const bookings = await Booking.find(query)
      .populate('userId', 'email profile.name')
      .populate('locationId', 'name address')
      .sort({ startTime: -1 });

    return bookings;
  }

  async updateBookingStatus(bookingId: string, status: BookingStatus): Promise<IBookingDocument> {
    const booking = await Booking.findById(bookingId);
    
    if (!booking) {
      throw new AppError('Booking not found', 404);
    }

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

    const updatedBooking = await Booking.findByIdAndUpdate(
      bookingId,
      { status },
      { new: true, runValidators: true }
    );

    return updatedBooking!;
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
      ]),
      Location.countDocuments({ isActive: true })
    ]);

    const totalRevenue = revenueData[0]?.totalRevenue || 0;

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
    const matchStage: Record<string, any> = { status: 'COMPLETED' };

    if (filters.startDate || filters.endDate) {
      matchStage.startTime = {};
      if (filters.startDate) {
        (matchStage.startTime as any).$gte = new Date(filters.startDate);
      }
      if (filters.endDate) {
        // Include the entire end date by setting to end of day
        const endDate = new Date(filters.endDate);
        endDate.setHours(23, 59, 59, 999);
        (matchStage.startTime as any).$lte = endDate;
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
      ]),
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
      ])
    ]);

    const stats = revenueData[0] || {
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
      ]),
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
      ]),
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
      ])
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