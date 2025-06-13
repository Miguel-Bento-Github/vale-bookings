import { Response } from 'express';

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
export async function getAllUsers(req: AuthenticatedRequest, res: Response): Promise<void> {
  try {
    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 10;
    const result = await AdminService.getAllUsers({ page, limit });

    res.status(200).json({
      success: true,
      data: result.users,
      pagination: result.pagination
    });
  } catch (error) {
    if (error instanceof AppError) {
      res.status(error.statusCode).json({
        success: false,
        message: error.message
      });
    } else {
      res.status(500).json({
        success: false,
        message: 'Internal server error'
      });
    }
  }
}

export async function updateUserRole(req: AuthenticatedRequest, res: Response): Promise<void> {
  try {
    const { id } = req.params;

    if (id === undefined || id === null || id.trim().length === 0) {
      res.status(400).json({
        success: false,
        message: 'User ID is required'
      });
      return;
    }

    if (!isUpdateUserRoleRequestBody(req.body)) {
      res.status(400).json({
        success: false,
        message: 'Invalid role'
      });
      return;
    }

    const { role } = req.body;
    const user = await AdminService.updateUserRole(id, role);

    res.status(200).json({
      success: true,
      data: user
    });
  } catch (error) {
    if (error instanceof AppError) {
      res.status(error.statusCode).json({
        success: false,
        message: error.message
      });
    } else {
      res.status(500).json({
        success: false,
        message: 'Internal server error'
      });
    }
  }
}

export async function deleteUser(req: AuthenticatedRequest, res: Response): Promise<void> {
  try {
    const { id } = req.params;
    const currentUserId = req.user?.userId;

    if (id === undefined || id === null || id.trim().length === 0) {
      res.status(400).json({
        success: false,
        message: 'User ID is required'
      });
      return;
    }

    if (id === currentUserId) {
      res.status(400).json({
        success: false,
        message: 'Cannot delete your own account'
      });
      return;
    }

    await AdminService.deleteUser(id);

    res.status(200).json({
      success: true,
      message: 'User deleted successfully'
    });
  } catch (error) {
    if (error instanceof AppError) {
      res.status(error.statusCode).json({
        success: false,
        message: error.message
      });
    } else {
      res.status(500).json({
        success: false,
        message: 'Internal server error'
      });
    }
  }
}

// Valet Management
export async function getAllValets(req: AuthenticatedRequest, res: Response): Promise<void> {
  try {
    const valets = await AdminService.getAllValets();

    res.status(200).json({
      success: true,
      data: valets
    });
  } catch (error) {
    if (error instanceof AppError) {
      res.status(error.statusCode).json({
        success: false,
        message: error.message
      });
    } else {
      res.status(500).json({
        success: false,
        message: 'Internal server error'
      });
    }
  }
}

export async function createValet(req: AuthenticatedRequest, res: Response): Promise<void> {
  try {
    if (!isCreateValetRequestBody(req.body)) {
      res.status(400).json({
        success: false,
        message: 'Invalid valet data'
      });
      return;
    }

    const valetData = {
      ...req.body,
      role: 'VALET' as const
    };

    const valet = await AdminService.createValet(valetData);

    res.status(201).json({
      success: true,
      data: valet
    });
  } catch (error) {
    if (error instanceof AppError) {
      res.status(error.statusCode).json({
        success: false,
        message: error.message
      });
    } else {
      res.status(500).json({
        success: false,
        message: 'Internal server error'
      });
    }
  }
}

export async function updateValet(req: AuthenticatedRequest, res: Response): Promise<void> {
  try {
    const { id } = req.params;

    if (id === undefined || id === null || id.trim().length === 0) {
      res.status(400).json({
        success: false,
        message: 'Valet ID is required'
      });
      return;
    }

    if (!isUpdateValetRequestBody(req.body)) {
      res.status(400).json({
        success: false,
        message: 'Invalid valet update data'
      });
      return;
    }

    const valet = await AdminService.updateValet(id, req.body);

    res.status(200).json({
      success: true,
      data: valet
    });
  } catch (error) {
    if (error instanceof AppError) {
      res.status(error.statusCode).json({
        success: false,
        message: error.message
      });
    } else {
      res.status(500).json({
        success: false,
        message: 'Internal server error'
      });
    }
  }
}

export async function deleteValet(req: AuthenticatedRequest, res: Response): Promise<void> {
  try {
    const { id } = req.params;

    if (id === undefined || id === null || id.trim().length === 0) {
      res.status(400).json({
        success: false,
        message: 'Valet ID is required'
      });
      return;
    }

    await AdminService.deleteValet(id);

    res.status(200).json({
      success: true,
      message: 'Valet deleted successfully'
    });
  } catch (error) {
    if (error instanceof AppError) {
      res.status(error.statusCode).json({
        success: false,
        message: error.message
      });
    } else {
      res.status(500).json({
        success: false,
        message: 'Internal server error'
      });
    }
  }
}

// Location Management
export async function createLocation(req: AuthenticatedRequest, res: Response): Promise<void> {
  try {
    if (!isCreateLocationRequestBody(req.body)) {
      res.status(400).json({
        success: false,
        message: 'Invalid location data'
      });
      return;
    }

    const location = await AdminService.createLocation(req.body);

    res.status(201).json({
      success: true,
      data: location
    });
  } catch (error) {
    if (error instanceof AppError) {
      res.status(error.statusCode).json({
        success: false,
        message: error.message
      });
    } else {
      res.status(500).json({
        success: false,
        message: 'Internal server error'
      });
    }
  }
}

export async function updateLocation(req: AuthenticatedRequest, res: Response): Promise<void> {
  try {
    const { id } = req.params;

    if (id === undefined || id === null || id.trim().length === 0) {
      res.status(400).json({
        success: false,
        message: 'Location ID is required'
      });
      return;
    }

    if (!isUpdateLocationRequestBody(req.body)) {
      res.status(400).json({
        success: false,
        message: 'Invalid location update data'
      });
      return;
    }

    const location = await AdminService.updateLocation(id, req.body);

    res.status(200).json({
      success: true,
      data: location
    });
  } catch (error) {
    if (error instanceof AppError) {
      res.status(error.statusCode).json({
        success: false,
        message: error.message
      });
    } else {
      res.status(500).json({
        success: false,
        message: 'Internal server error'
      });
    }
  }
}

export async function deleteLocation(req: AuthenticatedRequest, res: Response): Promise<void> {
  try {
    const { id } = req.params;

    if (id === undefined || id === null || id.trim().length === 0) {
      res.status(400).json({
        success: false,
        message: 'Location ID is required'
      });
      return;
    }

    await AdminService.deleteLocation(id);

    res.status(200).json({
      success: true,
      message: 'Location deleted successfully'
    });
  } catch (error) {
    if (error instanceof AppError) {
      res.status(error.statusCode).json({
        success: false,
        message: error.message
      });
    } else {
      res.status(500).json({
        success: false,
        message: 'Internal server error'
      });
    }
  }
}

// Schedule Management
export async function getAllSchedules(req: AuthenticatedRequest, res: Response): Promise<void> {
  try {
    const schedules = await AdminService.getAllSchedules();

    res.status(200).json({
      success: true,
      data: schedules
    });
  } catch (error) {
    if (error instanceof AppError) {
      res.status(error.statusCode).json({
        success: false,
        message: error.message
      });
    } else {
      res.status(500).json({
        success: false,
        message: 'Internal server error'
      });
    }
  }
}

export async function createSchedule(req: AuthenticatedRequest, res: Response): Promise<void> {
  try {
    if (!isCreateScheduleRequestBody(req.body)) {
      res.status(400).json({
        success: false,
        message: 'Invalid schedule data'
      });
      return;
    }

    const schedule = await AdminService.createSchedule(req.body);

    res.status(201).json({
      success: true,
      data: schedule
    });
  } catch (error) {
    if (error instanceof AppError) {
      res.status(error.statusCode).json({
        success: false,
        message: error.message
      });
    } else {
      res.status(500).json({
        success: false,
        message: 'Internal server error'
      });
    }
  }
}

export async function updateSchedule(req: AuthenticatedRequest, res: Response): Promise<void> {
  try {
    const { id } = req.params;

    if (id === undefined || id === null || id.trim().length === 0) {
      res.status(400).json({
        success: false,
        message: 'Schedule ID is required'
      });
      return;
    }

    if (!isUpdateScheduleRequestBody(req.body)) {
      res.status(400).json({
        success: false,
        message: 'Invalid schedule update data'
      });
      return;
    }

    const schedule = await AdminService.updateSchedule(id, req.body);

    res.status(200).json({
      success: true,
      data: schedule
    });
  } catch (error) {
    if (error instanceof AppError) {
      res.status(error.statusCode).json({
        success: false,
        message: error.message
      });
    } else {
      res.status(500).json({
        success: false,
        message: 'Internal server error'
      });
    }
  }
}

export async function deleteSchedule(req: AuthenticatedRequest, res: Response): Promise<void> {
  try {
    const { id } = req.params;

    if (id === undefined || id === null || id.trim().length === 0) {
      res.status(400).json({
        success: false,
        message: 'Schedule ID is required'
      });
      return;
    }

    await AdminService.deleteSchedule(id);

    res.status(200).json({
      success: true,
      message: 'Schedule deleted successfully'
    });
  } catch (error) {
    if (error instanceof AppError) {
      res.status(error.statusCode).json({
        success: false,
        message: error.message
      });
    } else {
      res.status(500).json({
        success: false,
        message: 'Internal server error'
      });
    }
  }
}

export async function createBulkSchedules(req: AuthenticatedRequest, res: Response): Promise<void> {
  try {
    const bodyObj = req.body as Record<string, unknown>;

    if (
      typeof bodyObj.locationId !== 'string' ||
      !Array.isArray(bodyObj.schedules) ||
      bodyObj.schedules.length === 0
    ) {
      res.status(400).json({
        success: false,
        message: 'Invalid bulk schedule data'
      });
      return;
    }

    // Validate each schedule in the array
    const schedules = bodyObj.schedules as unknown[];
    const validatedScheduleData: ICreateScheduleRequest[] = [];

    for (const schedule of schedules) {
      if (typeof schedule !== 'object' || schedule === null) {
        res.status(400).json({
          success: false,
          message: 'Invalid schedule data in bulk request'
        });
        return;
      }

      const scheduleWithLocation = {
        ...(schedule as Record<string, unknown>),
        locationId: bodyObj.locationId
      };

      if (!isCreateScheduleRequestBody(scheduleWithLocation)) {
        res.status(400).json({
          success: false,
          message: 'Invalid schedule data in bulk request'
        });
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
      res.status(201).json({
        success: true,
        data: result.successful
      });
    }
  } catch (error) {
    if (error instanceof AppError) {
      res.status(error.statusCode).json({
        success: false,
        message: error.message
      });
    } else {
      res.status(500).json({
        success: false,
        message: 'Internal server error'
      });
    }
  }
}

// Booking Oversight
export async function getAllBookings(req: AuthenticatedRequest, res: Response): Promise<void> {
  try {
    const filters = {
      status: req.query.status as BookingStatus,
      startDate: req.query.startDate as string,
      endDate: req.query.endDate as string
    };

    const bookings = await AdminService.getAllBookings(filters);

    res.status(200).json({
      success: true,
      data: bookings
    });
  } catch (error) {
    if (error instanceof AppError) {
      res.status(error.statusCode).json({
        success: false,
        message: error.message
      });
    } else {
      res.status(500).json({
        success: false,
        message: 'Internal server error'
      });
    }
  }
}

export async function updateBookingStatus(req: AuthenticatedRequest, res: Response): Promise<void> {
  try {
    const { id } = req.params;

    if (id === undefined || id === null || id.trim().length === 0) {
      res.status(400).json({
        success: false,
        message: 'Booking ID is required'
      });
      return;
    }

    if (!isUpdateBookingStatusRequestBody(req.body)) {
      res.status(400).json({
        success: false,
        message: 'Invalid booking status'
      });
      return;
    }

    const { status } = req.body;
    const booking = await AdminService.updateBookingStatus(id, status);

    res.status(200).json({
      success: true,
      data: booking
    });
  } catch (error) {
    if (error instanceof AppError) {
      res.status(error.statusCode).json({
        success: false,
        message: error.message
      });
    } else {
      res.status(500).json({
        success: false,
        message: 'Internal server error'
      });
    }
  }
}

// Analytics
export async function getAnalyticsOverview(req: AuthenticatedRequest, res: Response): Promise<void> {
  try {
    const analytics = await AdminService.getAnalyticsOverview();

    res.status(200).json({
      success: true,
      data: analytics
    });
  } catch (error) {
    if (error instanceof AppError) {
      res.status(error.statusCode).json({
        success: false,
        message: error.message
      });
    } else {
      res.status(500).json({
        success: false,
        message: 'Internal server error'
      });
    }
  }
}

export async function getRevenueAnalytics(req: AuthenticatedRequest, res: Response): Promise<void> {
  try {
    const filters = {
      startDate: req.query.startDate as string,
      endDate: req.query.endDate as string
    };

    const analytics = await AdminService.getRevenueAnalytics(filters);

    res.status(200).json({
      success: true,
      data: analytics
    });
  } catch (error) {
    if (error instanceof AppError) {
      res.status(error.statusCode).json({
        success: false,
        message: error.message
      });
    } else {
      res.status(500).json({
        success: false,
        message: 'Internal server error'
      });
    }
  }
}

export async function getBookingAnalytics(req: AuthenticatedRequest, res: Response): Promise<void> {
  try {
    const analytics = await AdminService.getBookingAnalytics();

    res.status(200).json({
      success: true,
      data: analytics
    });
  } catch (error) {
    if (error instanceof AppError) {
      res.status(error.statusCode).json({
        success: false,
        message: error.message
      });
    } else {
      res.status(500).json({
        success: false,
        message: 'Internal server error'
      });
    }
  }
} 