import { ERROR_MESSAGES } from '../../constants';
import Location from '../../models/Location';
import Schedule from '../../models/Schedule';
import { 
  ILocationDocument,
  IScheduleDocument,
  ICreateLocationRequest,
  IUpdateLocationRequest,
  ICreateScheduleRequest,
  IUpdateScheduleRequest,
  AppError,
  IPaginationOptions
} from '../../types';
import {
  standardUpdate,
  createWithDuplicateHandling,
  ensureDocumentExists,
  safeDelete,
  checkDocumentExists
} from '../../utils/mongoHelpers';

interface ILocationFilters extends IPaginationOptions {
  search?: string;
  isActive?: boolean;
  sortBy?: string;
  sortOrder?: string;
}

interface IBulkScheduleResult {
  successful: IScheduleDocument[];
  failed: Array<{
    schedule: ICreateScheduleRequest;
    error: string;
  }>;
}

// Location Management Functions
export const createLocation = async (locationData: ICreateLocationRequest): Promise<ILocationDocument> => {
  return await createWithDuplicateHandling(
    Location,
    locationData,
    ERROR_MESSAGES.LOCATION_ALREADY_EXISTS
  );
};

export const getLocationById = async (locationId: string): Promise<ILocationDocument> => {
  return await ensureDocumentExists(Location, locationId, 'Location not found');
};

export const getAllLocations = async (filters: ILocationFilters): Promise<{
  locations: ILocationDocument[];
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

  // Build query
  const query: Record<string, unknown> = {};

  // Active filter
  if (typeof filters.isActive === 'boolean') {
    query.isActive = filters.isActive;
  }

  // Search filter
  if (typeof filters.search === 'string' && filters.search.trim().length > 0) {
    const escapedSearch = filters.search.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    // eslint-disable-next-line security/detect-non-literal-regexp
    const searchRegex = new RegExp(escapedSearch, 'i');
    query.$or = [
      { name: searchRegex },
      { address: searchRegex },
      { description: searchRegex }
    ];
  }

  // Build sort
  const sortBy = filters.sortBy ?? 'createdAt';
  const sortOrder = filters.sortOrder === 'asc' ? 1 : -1;
  const sort: Record<string, 1 | -1> = {
    [sortBy]: sortOrder
  };

  const [locations, totalItems] = await Promise.all([
    Location.find(query)
      .skip(skip)
      .limit(limit)
      .sort(sort),
    Location.countDocuments(query)
  ]);

  const totalPages = Math.ceil(totalItems / limit);

  return {
    locations,
    pagination: {
      currentPage: page,
      totalPages,
      totalItems,
      itemsPerPage: limit
    }
  };
};

export const updateLocation = async (
  locationId: string,
  updateData: IUpdateLocationRequest
): Promise<ILocationDocument> => {
  const location = await standardUpdate(Location, locationId, updateData);
  
  if (!location) {
    throw new AppError('Location not found', 404);
  }
  
  return location;
};

export const deleteLocation = async (locationId: string): Promise<void> => {
  await ensureDocumentExists(Location, locationId, 'Location not found');
  
  // Check if location has active bookings
  const activeBookings = await checkDocumentExists(
    'Booking',
    { locationId, status: { $in: ['PENDING', 'CONFIRMED', 'IN_PROGRESS'] } }
  );
  
  if (activeBookings !== null) {
    throw new AppError('Cannot delete location with active bookings', 400);
  }
  
  await safeDelete(Location, locationId, 'Location not found');
};

// Schedule Management Functions
export const createSchedule = async (scheduleData: ICreateScheduleRequest): Promise<IScheduleDocument> => {
  // Validate that location exists
  await ensureDocumentExists(Location, scheduleData.locationId, 'Location not found');
  
  // Check for overlapping schedules
  const overlapping = await Schedule.findOne({
    locationId: scheduleData.locationId,
    dayOfWeek: scheduleData.dayOfWeek,
    $or: [
      {
        $and: [
          { startTime: { $lte: scheduleData.startTime } },
          { endTime: { $gt: scheduleData.startTime } }
        ]
      },
      {
        $and: [
          { startTime: { $lt: scheduleData.endTime } },
          { endTime: { $gte: scheduleData.endTime } }
        ]
      },
      {
        $and: [
          { startTime: { $gte: scheduleData.startTime } },
          { endTime: { $lte: scheduleData.endTime } }
        ]
      }
    ]
  });
  
  if (overlapping) {
    throw new AppError('Schedule overlaps with existing schedule', 400);
  }
  
  return await createWithDuplicateHandling(
    Schedule,
    scheduleData,
    ERROR_MESSAGES.SCHEDULE_ALREADY_EXISTS
  );
};

export const getScheduleById = async (scheduleId: string): Promise<IScheduleDocument> => {
  return await ensureDocumentExists(Schedule, scheduleId, 'Schedule not found');
};

export const getLocationSchedules = async (
  locationId: string
): Promise<IScheduleDocument[]> => {
  await ensureDocumentExists(Location, locationId, 'Location not found');
  
  return await Schedule.find({ locationId }).sort({ dayOfWeek: 1, startTime: 1 });
};

export const updateSchedule = async (
  scheduleId: string,
  updateData: IUpdateScheduleRequest
): Promise<IScheduleDocument> => {
  const schedule = await ensureDocumentExists(Schedule, scheduleId, 'Schedule not found');
  
  // If updating time or day, check for overlaps
  if (updateData.startTime !== undefined || updateData.endTime !== undefined || updateData.dayOfWeek !== undefined) {
    const newStartTime = updateData.startTime ?? schedule.startTime;
    const newEndTime = updateData.endTime ?? schedule.endTime;
    const newDayOfWeek = updateData.dayOfWeek ?? schedule.dayOfWeek;
    
    const overlapping = await Schedule.findOne({
      _id: { $ne: scheduleId },
      locationId: schedule.locationId,
      dayOfWeek: newDayOfWeek,
      $or: [
        {
          $and: [
            { startTime: { $lte: newStartTime } },
            { endTime: { $gt: newStartTime } }
          ]
        },
        {
          $and: [
            { startTime: { $lt: newEndTime } },
            { endTime: { $gte: newEndTime } }
          ]
        },
        {
          $and: [
            { startTime: { $gte: newStartTime } },
            { endTime: { $lte: newEndTime } }
          ]
        }
      ]
    });
    
    if (overlapping) {
      throw new AppError('Schedule overlaps with existing schedule', 400);
    }
  }
  
  const updatedSchedule = await standardUpdate(Schedule, scheduleId, updateData);
  
  if (!updatedSchedule) {
    throw new AppError('Schedule not found', 404);
  }
  
  return updatedSchedule;
};

export const deleteSchedule = async (scheduleId: string): Promise<void> => {
  await safeDelete(Schedule, scheduleId, 'Schedule not found');
};

export const createBulkSchedules = async (
  schedules: ICreateScheduleRequest[]
): Promise<IBulkScheduleResult> => {
  const successful: IScheduleDocument[] = [];
  const failed: Array<{ schedule: ICreateScheduleRequest; error: string }> = [];
  
  for (const scheduleData of schedules) {
    try {
      const schedule = await createSchedule(scheduleData);
      successful.push(schedule);
    } catch (error) {
      failed.push({
        schedule: scheduleData,
        error: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  }
  
  return { successful, failed };
};