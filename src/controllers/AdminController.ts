import { Response } from 'express';
import { AuthenticatedRequest, UserRole, BookingStatus } from '../types';
import AdminService from '../services/AdminService';
import { AppError } from '../types';

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
    const { role } = req.body;

    if (!id) {
      res.status(400).json({
        success: false,
        message: 'User ID is required'
      });
      return;
    }

    if (!['CUSTOMER', 'VALET', 'ADMIN'].includes(role)) {
      res.status(400).json({
        success: false,
        message: 'Invalid role'
      });
      return;
    }

    const user = await AdminService.updateUserRole(id, role as UserRole);

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

    if (!id) {
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
    const valetData = {
      ...req.body,
      role: 'VALET' as UserRole
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

    if (!id) {
      res.status(400).json({
        success: false,
        message: 'Valet ID is required'
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

    if (!id) {
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

    if (!id) {
      res.status(400).json({
        success: false,
        message: 'Location ID is required'
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

    if (!id) {
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

    if (!id) {
      res.status(400).json({
        success: false,
        message: 'Schedule ID is required'
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

    if (!id) {
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
    const { locationId, schedules } = req.body;
    const result = await AdminService.createBulkSchedules(locationId, schedules);

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
    const { status } = req.body;

    if (!id) {
      res.status(400).json({
        success: false,
        message: 'Booking ID is required'
      });
      return;
    }

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