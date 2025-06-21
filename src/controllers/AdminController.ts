import { Request, Response } from 'express';

import AdminService from '../services/AdminService';
import {
  AuthenticatedRequest,
  UserRole,
  BookingStatus,
  AppError,
  ICreateLocationRequest,
  IUpdateLocationRequest,
  ICreateScheduleRequest,
  IUpdateScheduleRequest
} from '../types';
import {
  sendSuccess,
  sendError,
  sendSuccessWithPagination,
  withErrorHandling
} from '../utils/responseHelpers';
import {
  validateRequiredId,
  validatePaginationParams
} from '../utils/validationHelpers';

// Type definitions for request bodies
interface UpdateUserRoleRequestBody {
  role: UserRole;
}

interface CreateValetRequestBody {
  email: string;
  password: string;
  profile: {
    name: string;
    phone?: string;
  };
}

interface UpdateValetRequestBody {
  profile?: {
    name?: string;
    phone?: string;
  };
}

interface UpdateBookingStatusRequestBody {
  status: BookingStatus;
}

// Type guards for request validation
function isUpdateUserRoleRequestBody(body: unknown): body is UpdateUserRoleRequestBody {
  return (
    typeof body === 'object' &&
    body !== null &&
    typeof (body as Record<string, unknown>).role === 'string' &&
    ['CUSTOMER', 'VALET', 'ADMIN'].includes((body as Record<string, unknown>).role as string)
  );
}

function isCreateValetRequestBody(body: unknown): body is CreateValetRequestBody {
  const bodyObj = body as Record<string, unknown>;
  return (
    typeof body === 'object' &&
    body !== null &&
    typeof bodyObj.email === 'string' &&
    typeof bodyObj.password === 'string' &&
    typeof bodyObj.profile === 'object' &&
    bodyObj.profile !== null &&
    typeof (bodyObj.profile as Record<string, unknown>).name === 'string'
  );
}

function isUpdateValetRequestBody(body: unknown): body is UpdateValetRequestBody {
  const bodyObj = body as Record<string, unknown>;
  return (
    typeof body === 'object' &&
    body !== null &&
    (bodyObj.profile === undefined ||
      (typeof bodyObj.profile === 'object' && bodyObj.profile !== null))
  );
}

function isUpdateBookingStatusRequestBody(body: unknown): body is UpdateBookingStatusRequestBody {
  return (
    typeof body === 'object' &&
    body !== null &&
    typeof (body as Record<string, unknown>).status === 'string' &&
    ['PENDING', 'CONFIRMED', 'IN_PROGRESS', 'COMPLETED', 'CANCELLED'].includes(
      (body as Record<string, unknown>).status as string
    )
  );
}

function isCreateLocationRequestBody(body: unknown): body is ICreateLocationRequest {
  const bodyObj = body as Record<string, unknown>;
  return (
    typeof body === 'object' &&
    body !== null &&
    typeof bodyObj.name === 'string' &&
    typeof bodyObj.address === 'string' &&
    typeof bodyObj.coordinates === 'object' &&
    bodyObj.coordinates !== null &&
    typeof (bodyObj.coordinates as Record<string, unknown>).latitude === 'number' &&
    typeof (bodyObj.coordinates as Record<string, unknown>).longitude === 'number'
  );
}

function isUpdateLocationRequestBody(body: unknown): body is IUpdateLocationRequest {
  const bodyObj = body as Record<string, unknown>;
  return (
    typeof body === 'object' &&
    body !== null &&
    (bodyObj.name === undefined || typeof bodyObj.name === 'string') &&
    (bodyObj.address === undefined || typeof bodyObj.address === 'string') &&
    (bodyObj.coordinates === undefined ||
      (typeof bodyObj.coordinates === 'object' &&
        bodyObj.coordinates !== null &&
        typeof (bodyObj.coordinates as Record<string, unknown>).latitude === 'number' &&
        typeof (bodyObj.coordinates as Record<string, unknown>).longitude === 'number'))
  );
}

function isCreateScheduleRequestBody(body: unknown): body is ICreateScheduleRequest {
  const bodyObj = body as Record<string, unknown>;
  return (
    typeof body === 'object' &&
    body !== null &&
    typeof bodyObj.locationId === 'string' &&
    typeof bodyObj.dayOfWeek === 'number' &&
    bodyObj.dayOfWeek >= 0 &&
    bodyObj.dayOfWeek <= 6 &&
    typeof bodyObj.startTime === 'string' &&
    typeof bodyObj.endTime === 'string'
  );
}

function isUpdateScheduleRequestBody(body: unknown): body is IUpdateScheduleRequest {
  const bodyObj = body as Record<string, unknown>;
  return (
    typeof body === 'object' &&
    body !== null &&
    (bodyObj.dayOfWeek === undefined ||
      (typeof bodyObj.dayOfWeek === 'number' && bodyObj.dayOfWeek >= 0 && bodyObj.dayOfWeek <= 6)) &&
    (bodyObj.startTime === undefined || typeof bodyObj.startTime === 'string') &&
    (bodyObj.endTime === undefined || typeof bodyObj.endTime === 'string') &&
    (bodyObj.isActive === undefined || typeof bodyObj.isActive === 'boolean')
  );
}

// User Management
export const getAllUsers = withErrorHandling(async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  const page = parseInt(req.query.page as string) || 1;
  const limit = parseInt(req.query.limit as string) || 10;
  const result = await AdminService.getAllUsers({ page, limit });

  res.status(200).json({
    success: true,
    data: result.users,
    pagination: result.pagination
  });
});

export const updateUserRole = withErrorHandling(async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  const { id } = req.params;

  if (id === undefined || id === null || id.trim().length === 0) {
    sendError(res, 'User ID is required', 400);
    return;
  }

  if (!isUpdateUserRoleRequestBody(req.body)) {
    sendError(res, 'Invalid role', 400);
    return;
  }

  const { role } = req.body;
  const user = await AdminService.updateUserRole(id, role);
  sendSuccess(res, user);
});

export const deleteUser = withErrorHandling(async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  const { id } = req.params;
  const currentUserId = req.user?.userId;

  if (id === undefined || id === null || id.trim().length === 0) {
    sendError(res, 'User ID is required', 400);
    return;
  }

  if (id === currentUserId) {
    sendError(res, 'Cannot delete your own account', 400);
    return;
  }

  await AdminService.deleteUser(id);
  sendSuccess(res, undefined, 'User deleted successfully');
});

// Valet Management
export const getAllValets = withErrorHandling(async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  const valets = await AdminService.getAllValets();
  sendSuccess(res, valets);
});

export const createValet = withErrorHandling(async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  if (!isCreateValetRequestBody(req.body)) {
    sendError(res, 'Invalid valet data', 400);
    return;
  }

  const valetData = {
    ...req.body,
    role: 'VALET' as const
  };

  const valet = await AdminService.createValet(valetData);
  sendSuccess(res, valet, undefined, 201);
});

export const updateValet = withErrorHandling(async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  const { id } = req.params;

  if (id === undefined || id === null || id.trim().length === 0) {
    sendError(res, 'Valet ID is required', 400);
    return;
  }

  if (!isUpdateValetRequestBody(req.body)) {
    sendError(res, 'Invalid valet update data', 400);
    return;
  }

  const valet = await AdminService.updateValet(id, req.body);
  sendSuccess(res, valet);
});

export const deleteValet = withErrorHandling(async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  const { id } = req.params;

  if (id === undefined || id === null || id.trim().length === 0) {
    sendError(res, 'Valet ID is required', 400);
    return;
  }

  await AdminService.deleteValet(id);
  sendSuccess(res, undefined, 'Valet deleted successfully');
});

// Location Management
export const createLocation = withErrorHandling(async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  if (!isCreateLocationRequestBody(req.body)) {
    sendError(res, 'Invalid location data', 400);
    return;
  }

  const location = await AdminService.createLocation(req.body);
  sendSuccess(res, location, undefined, 201);
});

export const updateLocation = withErrorHandling(async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  const { id } = req.params;

  if (id === undefined || id === null || id.trim().length === 0) {
    sendError(res, 'Location ID is required', 400);
    return;
  }

  if (!isUpdateLocationRequestBody(req.body)) {
    sendError(res, 'Invalid location update data', 400);
    return;
  }

  const location = await AdminService.updateLocation(id, req.body);
  sendSuccess(res, location);
});

export const deleteLocation = withErrorHandling(async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  const { id } = req.params;

  if (id === undefined || id === null || id.trim().length === 0) {
    sendError(res, 'Location ID is required', 400);
    return;
  }

  await AdminService.deleteLocation(id);
  sendSuccess(res, undefined, 'Location deleted successfully');
});

// Schedule Management
export const getAllSchedules = withErrorHandling(async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  const schedules = await AdminService.getAllSchedules();
  sendSuccess(res, schedules);
});

export const createSchedule = withErrorHandling(async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  if (!isCreateScheduleRequestBody(req.body)) {
    sendError(res, 'Invalid schedule data', 400);
    return;
  }

  const schedule = await AdminService.createSchedule(req.body);
  sendSuccess(res, schedule, undefined, 201);
});

export const updateSchedule = withErrorHandling(async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  const { id } = req.params;

  if (id === undefined || id === null || id.trim().length === 0) {
    sendError(res, 'Schedule ID is required', 400);
    return;
  }

  if (!isUpdateScheduleRequestBody(req.body)) {
    sendError(res, 'Invalid schedule update data', 400);
    return;
  }

  const schedule = await AdminService.updateSchedule(id, req.body);
  sendSuccess(res, schedule);
});

export const deleteSchedule = withErrorHandling(async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  const { id } = req.params;

  if (id === undefined || id === null || id.trim().length === 0) {
    sendError(res, 'Schedule ID is required', 400);
    return;
  }

  await AdminService.deleteSchedule(id);
  sendSuccess(res, undefined, 'Schedule deleted successfully');
});

export const createBulkSchedules = withErrorHandling(async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  const bodyObj = req.body as Record<string, unknown>;

  if (
    typeof bodyObj.locationId !== 'string' ||
    !Array.isArray(bodyObj.schedules) ||
    bodyObj.schedules.length === 0
  ) {
    sendError(res, 'Invalid bulk schedule data', 400);
    return;
  }

  // Validate each schedule in the array
  const schedules = bodyObj.schedules as unknown[];
  const validatedScheduleData: ICreateScheduleRequest[] = [];

  for (const schedule of schedules) {
    if (typeof schedule !== 'object' || schedule === null) {
      sendError(res, 'Invalid schedule data in bulk request', 400);
      return;
    }

    const scheduleWithLocation = {
      ...(schedule as Record<string, unknown>),
      locationId: bodyObj.locationId
    };

    if (!isCreateScheduleRequestBody(scheduleWithLocation)) {
      sendError(res, 'Invalid schedule data in bulk request', 400);
      return;
    }
    validatedScheduleData.push(scheduleWithLocation);
  }

  const { locationId } = bodyObj;
  const validatedSchedules = validatedScheduleData;

  const result = await AdminService.createBulkSchedules(locationId, validatedSchedules);

  if (result.failed.length > 0) {
    res.status(207).json({
      success: true,
      data: result
    });
  } else {
    sendSuccess(res, result.successful, undefined, 201);
  }
});

// Booking Oversight
export const getAllBookings = withErrorHandling(async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  const filters = {
    status: req.query.status as BookingStatus,
    startDate: req.query.startDate as string,
    endDate: req.query.endDate as string
  };

  const bookings = await AdminService.getAllBookings(filters);
  sendSuccess(res, bookings);
});

export const updateBookingStatus = withErrorHandling(async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  const { id } = req.params;

  if (id === undefined || id === null || id.trim().length === 0) {
    sendError(res, 'Booking ID is required', 400);
    return;
  }

  if (!isUpdateBookingStatusRequestBody(req.body)) {
    sendError(res, 'Invalid booking status', 400);
    return;
  }

  const { status } = req.body;
  const booking = await AdminService.updateBookingStatus(id, status);
  sendSuccess(res, booking);
});

// Analytics
export const getAnalyticsOverview = withErrorHandling(async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  const analytics = await AdminService.getAnalyticsOverview();
  sendSuccess(res, analytics);
});

export const getRevenueAnalytics = withErrorHandling(async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  const filters = {
    startDate: req.query.startDate as string,
    endDate: req.query.endDate as string
  };

  const analytics = await AdminService.getRevenueAnalytics(filters);
  sendSuccess(res, analytics);
});

export const getBookingAnalytics = withErrorHandling(async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  const analytics = await AdminService.getBookingAnalytics();
  sendSuccess(res, analytics);
}); 