import Booking from '../../models/Booking';
import Location from '../../models/Location';
import User from '../../models/User';

interface AnalyticsOverview {
  totalUsers: number;
  totalBookings: number;
  totalRevenue: number;
  activeLocations: number;
}

interface BookingsByLocation {
  location: string;
  count: number;
}

interface BookingsByStatus {
  status: string;
  count: number;
}

interface DailyBookings {
  date: string;
  count: number;
}

export const getOverviewStats = async (): Promise<AnalyticsOverview> => {
  const [
    totalUsers,
    totalBookings,
    totalRevenueResult,
    activeLocations
  ] = await Promise.all([
    User.countDocuments({}),
    Booking.countDocuments({}),
    Booking.aggregate([
      { $match: { status: 'COMPLETED' } },
      { $group: { _id: null, total: { $sum: '$price' } } }
    ]),
    Location.countDocuments({ isActive: true })
  ]);

  const totalRevenue = totalRevenueResult.length > 0 && totalRevenueResult[0] !== null && totalRevenueResult[0] !== undefined
    ? (totalRevenueResult[0] as { total: number }).total 
    : 0;

  return {
    totalUsers,
    totalBookings,
    totalRevenue,
    activeLocations
  } as AnalyticsOverview;
};

export const getBookingAnalytics = async (): Promise<{
  totalBookings: number;
  bookingsByStatus: BookingsByStatus[];
  bookingsByLocation: BookingsByLocation[];
  dailyBookings: DailyBookings[];
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
      $unwind: {
        path: '$location',
        preserveNullAndEmptyArrays: true
      }
    },
    {
      $group: {
        _id: {
          $ifNull: ['$location.name', 'Unknown Location']
        },
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
          $dateToString: {
            format: '%Y-%m-%d',
            date: '$createdAt'
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

export const getRevenueAnalytics = async (filters: {
  startDate?: string;
  endDate?: string;
} = {}): Promise<{
  totalRevenue: number;
  monthlyRevenue: Array<{ month: string; revenue: number }>;
  averageBookingValue: number;
}> => {
  // Build date match condition
  const dateMatch: Record<string, unknown> = {};
  if ((filters.startDate && filters.startDate.length > 0) || (filters.endDate && filters.endDate.length > 0)) {
    const dateRange: Record<string, Date> = {};
    if (filters.startDate && filters.startDate.length > 0) {
      dateRange.$gte = new Date(filters.startDate);
    }
    if (filters.endDate && filters.endDate.length > 0) {
      const endDate = new Date(filters.endDate);
      endDate.setHours(23, 59, 59, 999);
      dateRange.$lte = endDate;
    }
    dateMatch.createdAt = dateRange;
  }

  // Get total revenue
  const totalRevenueResult = await Booking.aggregate([
    { $match: { status: 'COMPLETED', ...dateMatch } },
    { $group: { _id: null, total: { $sum: '$price' } } }
  ]);

  const totalRevenue = totalRevenueResult.length > 0 && totalRevenueResult[0] !== null && totalRevenueResult[0] !== undefined
    ? (totalRevenueResult[0] as { total: number }).total 
    : 0;

  // Get monthly revenue
  const monthlyRevenueResult = await Booking.aggregate([
    { $match: { status: 'COMPLETED', ...dateMatch } },
    {
      $group: {
        _id: {
          year: { $year: '$createdAt' },
          month: { $month: '$createdAt' }
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
            {
              $cond: {
                if: { $lt: ['$_id.month', 10] },
                then: { $concat: ['0', { $toString: '$_id.month' }] },
                else: { $toString: '$_id.month' }
              }
            }
          ]
        },
        revenue: 1,
        _id: 0
      }
    },
    { $sort: { month: 1 } }
  ]);

  const monthlyRevenue = (monthlyRevenueResult as Array<{ month: string; revenue: number }>).map(item => ({
    month: item.month,
    revenue: item.revenue
  }));

  // Get total completed bookings for average calculation
  const totalCompletedBookings = await Booking.countDocuments({
    status: 'COMPLETED',
    ...dateMatch
  });

  const averageBookingValue = totalCompletedBookings > 0 ? totalRevenue / totalCompletedBookings : 0;

  return {
    totalRevenue,
    monthlyRevenue,
    averageBookingValue
  };
};