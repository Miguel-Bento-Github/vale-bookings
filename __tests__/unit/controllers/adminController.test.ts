import { Response } from 'express';

import * as AdminController from '../../../src/controllers/AdminController';
import AdminService from '../../../src/services/AdminService';
import { AppError, AuthenticatedRequest, UserRole } from '../../../src/types';

jest.mock('../../../src/services/AdminService');

const mockAdminService = AdminService as jest.Mocked<typeof AdminService>;

describe('AdminController', () => {
  let mockReq: Partial<AuthenticatedRequest>;
  let mockRes: Partial<Response>;

  beforeEach(() => {
    mockReq = {
      params: {},
      query: {},
      body: {},
      user: { userId: 'admin-id', email: 'admin@test.com', role: 'ADMIN' as UserRole }
    };
    mockRes = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn()
    };
    jest.clearAllMocks();
  });

  describe('getAllUsers', () => {
    it('should get all users with pagination', async () => {
      const mockResult = {
        users: [{ id: '1', email: 'user@test.com' }],
        pagination: { currentPage: 1, totalPages: 1, totalItems: 1, itemsPerPage: 10 }
      };
      mockAdminService.getAllUsers.mockResolvedValue(mockResult as any);

      await AdminController.getAllUsers(mockReq as AuthenticatedRequest, mockRes as Response);

      expect(mockRes.status).toHaveBeenCalledWith(200);
      expect(mockRes.json).toHaveBeenCalledWith({
        success: true,
        data: mockResult.users,
        pagination: mockResult.pagination
      });
    });

    it('should handle AppError', async () => {
      const appError = new AppError('Service error', 400);
      mockAdminService.getAllUsers.mockRejectedValue(appError);

      await AdminController.getAllUsers(mockReq as AuthenticatedRequest, mockRes as Response);

      expect(mockRes.status).toHaveBeenCalledWith(400);
      expect(mockRes.json).toHaveBeenCalledWith({
        success: false,
        message: 'Service error'
      });
    });

    it('should handle generic error', async () => {
      mockAdminService.getAllUsers.mockRejectedValue(new Error('Generic error'));

      await AdminController.getAllUsers(mockReq as AuthenticatedRequest, mockRes as Response);

      expect(mockRes.status).toHaveBeenCalledWith(500);
      expect(mockRes.json).toHaveBeenCalledWith({
        success: false,
        message: 'Internal server error'
      });
    });
  });

  describe('updateUserRole', () => {
    it('should update user role successfully', async () => {
      mockReq.params = { id: 'user-id' };
      mockReq.body = { role: 'VALET' };
      const mockUser = { id: 'user-id', role: 'VALET' };
      mockAdminService.updateUserRole.mockResolvedValue(mockUser as any);

      await AdminController.updateUserRole(mockReq as AuthenticatedRequest, mockRes as Response);

      expect(mockRes.status).toHaveBeenCalledWith(200);
      expect(mockRes.json).toHaveBeenCalledWith({
        success: true,
        data: mockUser
      });
    });

    it('should return 400 for missing user ID', async () => {
      mockReq.params = {};

      await AdminController.updateUserRole(mockReq as AuthenticatedRequest, mockRes as Response);

      expect(mockRes.status).toHaveBeenCalledWith(400);
      expect(mockRes.json).toHaveBeenCalledWith({
        success: false,
        message: 'User ID is required'
      });
    });

    it('should return 400 for invalid role', async () => {
      mockReq.params = { id: 'user-id' };
      mockReq.body = { role: 'INVALID_ROLE' };

      await AdminController.updateUserRole(mockReq as AuthenticatedRequest, mockRes as Response);

      expect(mockRes.status).toHaveBeenCalledWith(400);
      expect(mockRes.json).toHaveBeenCalledWith({
        success: false,
        message: 'Invalid role'
      });
    });
  });

  describe('deleteUser', () => {
    it('should delete user successfully', async () => {
      mockReq.params = { id: 'user-id' };
      mockAdminService.deleteUser.mockResolvedValue(undefined);

      await AdminController.deleteUser(mockReq as AuthenticatedRequest, mockRes as Response);

      expect(mockRes.status).toHaveBeenCalledWith(200);
      expect(mockRes.json).toHaveBeenCalledWith({
        success: true,
        message: 'User deleted successfully'
      });
    });

    it('should return 400 for missing user ID', async () => {
      mockReq.params = {};

      await AdminController.deleteUser(mockReq as AuthenticatedRequest, mockRes as Response);

      expect(mockRes.status).toHaveBeenCalledWith(400);
      expect(mockRes.json).toHaveBeenCalledWith({
        success: false,
        message: 'User ID is required'
      });
    });
  });

  describe('getAllValets', () => {
    it('should get all valets successfully', async () => {
      const mockValets = [{ id: '1', email: 'valet@test.com' }];
      mockAdminService.getAllValets.mockResolvedValue(mockValets as any);

      await AdminController.getAllValets(mockReq as AuthenticatedRequest, mockRes as Response);

      expect(mockRes.status).toHaveBeenCalledWith(200);
      expect(mockRes.json).toHaveBeenCalledWith({
        success: true,
        data: mockValets
      });
    });
  });

  describe('createValet', () => {
    it('should create valet successfully', async () => {
      mockReq.body = {
        email: 'valet@test.com',
        password: 'password123',
        profile: { name: 'Test Valet' }
      };
      const mockValet = { id: '1', email: 'valet@test.com' };
      mockAdminService.createValet.mockResolvedValue(mockValet as any);

      await AdminController.createValet(mockReq as AuthenticatedRequest, mockRes as Response);

      expect(mockRes.status).toHaveBeenCalledWith(201);
      expect(mockRes.json).toHaveBeenCalledWith({
        success: true,
        data: mockValet
      });
    });

    it('should return 400 for invalid valet data', async () => {
      mockReq.body = { email: 'invalid' };

      await AdminController.createValet(mockReq as AuthenticatedRequest, mockRes as Response);

      expect(mockRes.status).toHaveBeenCalledWith(400);
      expect(mockRes.json).toHaveBeenCalledWith({
        success: false,
        message: 'Invalid valet data'
      });
    });
  });

  describe('updateValet', () => {
    it('should update valet successfully', async () => {
      mockReq.params = { id: 'valet-id' };
      mockReq.body = { profile: { name: 'Updated Valet' } };
      const mockValet = { id: 'valet-id', profile: { name: 'Updated Valet' } };
      mockAdminService.updateValet.mockResolvedValue(mockValet as any);

      await AdminController.updateValet(mockReq as AuthenticatedRequest, mockRes as Response);

      expect(mockRes.status).toHaveBeenCalledWith(200);
      expect(mockRes.json).toHaveBeenCalledWith({
        success: true,
        data: mockValet
      });
    });

    it('should return 400 for missing valet ID', async () => {
      mockReq.params = {};

      await AdminController.updateValet(mockReq as AuthenticatedRequest, mockRes as Response);

      expect(mockRes.status).toHaveBeenCalledWith(400);
      expect(mockRes.json).toHaveBeenCalledWith({
        success: false,
        message: 'Valet ID is required'
      });
    });

    it('should return 400 for invalid valet data', async () => {
      mockReq.params = { id: 'valet-id' };
      mockReq.body = { profile: 'invalid' };

      await AdminController.updateValet(mockReq as AuthenticatedRequest, mockRes as Response);

      expect(mockRes.status).toHaveBeenCalledWith(400);
      expect(mockRes.json).toHaveBeenCalledWith({
        success: false,
        message: 'Invalid valet update data'
      });
    });
  });

  describe('deleteValet', () => {
    it('should delete valet successfully', async () => {
      mockReq.params = { id: 'valet-id' };
      mockAdminService.deleteValet.mockResolvedValue(undefined);

      await AdminController.deleteValet(mockReq as AuthenticatedRequest, mockRes as Response);

      expect(mockRes.status).toHaveBeenCalledWith(200);
      expect(mockRes.json).toHaveBeenCalledWith({
        success: true,
        message: 'Valet deleted successfully'
      });
    });

    it('should return 400 for missing valet ID', async () => {
      mockReq.params = {};

      await AdminController.deleteValet(mockReq as AuthenticatedRequest, mockRes as Response);

      expect(mockRes.status).toHaveBeenCalledWith(400);
      expect(mockRes.json).toHaveBeenCalledWith({
        success: false,
        message: 'Valet ID is required'
      });
    });
  });

  describe('createLocation', () => {
    it('should create location successfully', async () => {
      mockReq.body = {
        name: 'Test Location',
        address: '123 Test St',
        coordinates: { latitude: 40.7128, longitude: -74.0060 }
      };
      const mockLocation = { id: '1', name: 'Test Location' };
      mockAdminService.createLocation.mockResolvedValue(mockLocation as any);

      await AdminController.createLocation(mockReq as AuthenticatedRequest, mockRes as Response);

      expect(mockRes.status).toHaveBeenCalledWith(201);
      expect(mockRes.json).toHaveBeenCalledWith({
        success: true,
        data: mockLocation
      });
    });

    it('should return 400 for invalid location data', async () => {
      mockReq.body = { name: 'invalid' };

      await AdminController.createLocation(mockReq as AuthenticatedRequest, mockRes as Response);

      expect(mockRes.status).toHaveBeenCalledWith(400);
      expect(mockRes.json).toHaveBeenCalledWith({
        success: false,
        message: 'Invalid location data'
      });
    });
  });

  describe('updateLocation', () => {
    it('should update location successfully', async () => {
      mockReq.params = { id: 'location-id' };
      mockReq.body = { name: 'Updated Location' };
      const mockLocation = { id: 'location-id', name: 'Updated Location' };
      mockAdminService.updateLocation.mockResolvedValue(mockLocation as any);

      await AdminController.updateLocation(mockReq as AuthenticatedRequest, mockRes as Response);

      expect(mockRes.status).toHaveBeenCalledWith(200);
      expect(mockRes.json).toHaveBeenCalledWith({
        success: true,
        data: mockLocation
      });
    });

    it('should return 400 for missing location ID', async () => {
      mockReq.params = {};

      await AdminController.updateLocation(mockReq as AuthenticatedRequest, mockRes as Response);

      expect(mockRes.status).toHaveBeenCalledWith(400);
      expect(mockRes.json).toHaveBeenCalledWith({
        success: false,
        message: 'Location ID is required'
      });
    });

    it('should return 400 for invalid location data', async () => {
      mockReq.params = { id: 'location-id' };
      mockReq.body = { coordinates: 'invalid' };

      await AdminController.updateLocation(mockReq as AuthenticatedRequest, mockRes as Response);

      expect(mockRes.status).toHaveBeenCalledWith(400);
      expect(mockRes.json).toHaveBeenCalledWith({
        success: false,
        message: 'Invalid location update data'
      });
    });
  });

  describe('deleteLocation', () => {
    it('should delete location successfully', async () => {
      mockReq.params = { id: 'location-id' };
      mockAdminService.deleteLocation.mockResolvedValue(undefined);

      await AdminController.deleteLocation(mockReq as AuthenticatedRequest, mockRes as Response);

      expect(mockRes.status).toHaveBeenCalledWith(200);
      expect(mockRes.json).toHaveBeenCalledWith({
        success: true,
        message: 'Location deleted successfully'
      });
    });

    it('should return 400 for missing location ID', async () => {
      mockReq.params = {};

      await AdminController.deleteLocation(mockReq as AuthenticatedRequest, mockRes as Response);

      expect(mockRes.status).toHaveBeenCalledWith(400);
      expect(mockRes.json).toHaveBeenCalledWith({
        success: false,
        message: 'Location ID is required'
      });
    });
  });

  describe('getAllSchedules', () => {
    it('should get all schedules successfully', async () => {
      const mockSchedules = [{ id: '1', locationId: 'loc-1' }];
      mockAdminService.getAllSchedules.mockResolvedValue(mockSchedules as any);

      await AdminController.getAllSchedules(mockReq as AuthenticatedRequest, mockRes as Response);

      expect(mockRes.status).toHaveBeenCalledWith(200);
      expect(mockRes.json).toHaveBeenCalledWith({
        success: true,
        data: mockSchedules
      });
    });

    it('should handle AppError in getAllSchedules', async () => {
      const appError = new AppError('Schedule error', 400);
      mockAdminService.getAllSchedules.mockRejectedValue(appError);

      await AdminController.getAllSchedules(mockReq as AuthenticatedRequest, mockRes as Response);

      expect(mockRes.status).toHaveBeenCalledWith(400);
      expect(mockRes.json).toHaveBeenCalledWith({
        success: false,
        message: 'Schedule error'
      });
    });

    it('should handle generic error in getAllSchedules', async () => {
      mockAdminService.getAllSchedules.mockRejectedValue(new Error('Generic error'));

      await AdminController.getAllSchedules(mockReq as AuthenticatedRequest, mockRes as Response);

      expect(mockRes.status).toHaveBeenCalledWith(500);
      expect(mockRes.json).toHaveBeenCalledWith({
        success: false,
        message: 'Internal server error'
      });
    });
  });

  describe('createSchedule', () => {
    it('should create schedule successfully', async () => {
      mockReq.body = {
        locationId: 'location-id',
        dayOfWeek: 1,
        startTime: '09:00',
        endTime: '17:00'
      };
      const mockSchedule = { id: '1', locationId: 'location-id' };
      mockAdminService.createSchedule.mockResolvedValue(mockSchedule as any);

      await AdminController.createSchedule(mockReq as AuthenticatedRequest, mockRes as Response);

      expect(mockRes.status).toHaveBeenCalledWith(201);
      expect(mockRes.json).toHaveBeenCalledWith({
        success: true,
        data: mockSchedule
      });
    });

    it('should return 400 for invalid schedule data', async () => {
      mockReq.body = { locationId: 'invalid' };

      await AdminController.createSchedule(mockReq as AuthenticatedRequest, mockRes as Response);

      expect(mockRes.status).toHaveBeenCalledWith(400);
      expect(mockRes.json).toHaveBeenCalledWith({
        success: false,
        message: 'Invalid schedule data'
      });
    });

    it('should handle AppError in createSchedule', async () => {
      mockReq.body = {
        locationId: 'location-id',
        dayOfWeek: 1,
        startTime: '09:00',
        endTime: '17:00'
      };
      const appError = new AppError('Schedule creation failed', 400);
      mockAdminService.createSchedule.mockRejectedValue(appError);

      await AdminController.createSchedule(mockReq as AuthenticatedRequest, mockRes as Response);

      expect(mockRes.status).toHaveBeenCalledWith(400);
      expect(mockRes.json).toHaveBeenCalledWith({
        success: false,
        message: 'Schedule creation failed'
      });
    });

    it('should handle generic error in createSchedule', async () => {
      mockReq.body = {
        locationId: 'location-id',
        dayOfWeek: 1,
        startTime: '09:00',
        endTime: '17:00'
      };
      mockAdminService.createSchedule.mockRejectedValue(new Error('Generic error'));

      await AdminController.createSchedule(mockReq as AuthenticatedRequest, mockRes as Response);

      expect(mockRes.status).toHaveBeenCalledWith(500);
      expect(mockRes.json).toHaveBeenCalledWith({
        success: false,
        message: 'Internal server error'
      });
    });
  });

  describe('updateSchedule', () => {
    it('should update schedule successfully', async () => {
      mockReq.params = { id: 'schedule-id' };
      mockReq.body = { startTime: '08:00' };
      const mockSchedule = { id: 'schedule-id', startTime: '08:00' };
      mockAdminService.updateSchedule.mockResolvedValue(mockSchedule as any);

      await AdminController.updateSchedule(mockReq as AuthenticatedRequest, mockRes as Response);

      expect(mockRes.status).toHaveBeenCalledWith(200);
      expect(mockRes.json).toHaveBeenCalledWith({
        success: true,
        data: mockSchedule
      });
    });

    it('should return 400 for missing schedule ID', async () => {
      mockReq.params = {};

      await AdminController.updateSchedule(mockReq as AuthenticatedRequest, mockRes as Response);

      expect(mockRes.status).toHaveBeenCalledWith(400);
      expect(mockRes.json).toHaveBeenCalledWith({
        success: false,
        message: 'Schedule ID is required'
      });
    });

    it('should return 400 for invalid schedule update data', async () => {
      mockReq.params = { id: 'schedule-id' };
      mockReq.body = { dayOfWeek: 'invalid' };

      await AdminController.updateSchedule(mockReq as AuthenticatedRequest, mockRes as Response);

      expect(mockRes.status).toHaveBeenCalledWith(400);
      expect(mockRes.json).toHaveBeenCalledWith({
        success: false,
        message: 'Invalid schedule update data'
      });
    });

    it('should handle AppError in updateSchedule', async () => {
      mockReq.params = { id: 'schedule-id' };
      mockReq.body = { startTime: '08:00' };
      const appError = new AppError('Schedule update failed', 404);
      mockAdminService.updateSchedule.mockRejectedValue(appError);

      await AdminController.updateSchedule(mockReq as AuthenticatedRequest, mockRes as Response);

      expect(mockRes.status).toHaveBeenCalledWith(404);
      expect(mockRes.json).toHaveBeenCalledWith({
        success: false,
        message: 'Schedule update failed'
      });
    });

    it('should handle generic error in updateSchedule', async () => {
      mockReq.params = { id: 'schedule-id' };
      mockReq.body = { startTime: '08:00' };
      mockAdminService.updateSchedule.mockRejectedValue(new Error('Generic error'));

      await AdminController.updateSchedule(mockReq as AuthenticatedRequest, mockRes as Response);

      expect(mockRes.status).toHaveBeenCalledWith(500);
      expect(mockRes.json).toHaveBeenCalledWith({
        success: false,
        message: 'Internal server error'
      });
    });
  });

  describe('deleteSchedule', () => {
    it('should delete schedule successfully', async () => {
      mockReq.params = { id: 'schedule-id' };
      mockAdminService.deleteSchedule.mockResolvedValue(undefined);

      await AdminController.deleteSchedule(mockReq as AuthenticatedRequest, mockRes as Response);

      expect(mockRes.status).toHaveBeenCalledWith(200);
      expect(mockRes.json).toHaveBeenCalledWith({
        success: true,
        message: 'Schedule deleted successfully'
      });
    });

    it('should return 400 for missing schedule ID', async () => {
      mockReq.params = {};

      await AdminController.deleteSchedule(mockReq as AuthenticatedRequest, mockRes as Response);

      expect(mockRes.status).toHaveBeenCalledWith(400);
      expect(mockRes.json).toHaveBeenCalledWith({
        success: false,
        message: 'Schedule ID is required'
      });
    });

    it('should handle AppError in deleteSchedule', async () => {
      mockReq.params = { id: 'schedule-id' };
      const appError = new AppError('Schedule not found', 404);
      mockAdminService.deleteSchedule.mockRejectedValue(appError);

      await AdminController.deleteSchedule(mockReq as AuthenticatedRequest, mockRes as Response);

      expect(mockRes.status).toHaveBeenCalledWith(404);
      expect(mockRes.json).toHaveBeenCalledWith({
        success: false,
        message: 'Schedule not found'
      });
    });

    it('should handle generic error in deleteSchedule', async () => {
      mockReq.params = { id: 'schedule-id' };
      mockAdminService.deleteSchedule.mockRejectedValue(new Error('Generic error'));

      await AdminController.deleteSchedule(mockReq as AuthenticatedRequest, mockRes as Response);

      expect(mockRes.status).toHaveBeenCalledWith(500);
      expect(mockRes.json).toHaveBeenCalledWith({
        success: false,
        message: 'Internal server error'
      });
    });
  });

  describe('createBulkSchedules', () => {
    it('should create bulk schedules successfully', async () => {
      mockReq.body = {
        locationId: 'location-id',
        schedules: [
          { dayOfWeek: 1, startTime: '09:00', endTime: '17:00' },
          { dayOfWeek: 2, startTime: '09:00', endTime: '17:00' }
        ]
      };
      const mockResult = {
        successful: [{ id: '1' }, { id: '2' }],
        failed: []
      };
      mockAdminService.createBulkSchedules.mockResolvedValue(mockResult as any);

      await AdminController.createBulkSchedules(mockReq as AuthenticatedRequest, mockRes as Response);

      expect(mockRes.status).toHaveBeenCalledWith(201);
      expect(mockRes.json).toHaveBeenCalledWith({
        success: true,
        data: mockResult.successful
      });
    });

    it('should return 207 for partial success', async () => {
      mockReq.body = {
        locationId: 'location-id',
        schedules: [
          { dayOfWeek: 1, startTime: '09:00', endTime: '17:00' },
          { dayOfWeek: 2, startTime: '09:00', endTime: '17:00' }
        ]
      };
      const mockResult = {
        successful: [{ id: '1' }],
        failed: [{ error: 'Duplicate schedule' }]
      };
      mockAdminService.createBulkSchedules.mockResolvedValue(mockResult as any);

      await AdminController.createBulkSchedules(mockReq as AuthenticatedRequest, mockRes as Response);

      expect(mockRes.status).toHaveBeenCalledWith(207);
      expect(mockRes.json).toHaveBeenCalledWith({
        success: true,
        data: mockResult
      });
    });

    it('should return 400 for missing locationId', async () => {
      mockReq.body = { schedules: [] };

      await AdminController.createBulkSchedules(mockReq as AuthenticatedRequest, mockRes as Response);

      expect(mockRes.status).toHaveBeenCalledWith(400);
      expect(mockRes.json).toHaveBeenCalledWith({
        success: false,
        message: 'Invalid bulk schedule data'
      });
    });

    it('should return 400 for empty schedules array', async () => {
      mockReq.body = {
        locationId: 'location-id',
        schedules: []
      };

      await AdminController.createBulkSchedules(mockReq as AuthenticatedRequest, mockRes as Response);

      expect(mockRes.status).toHaveBeenCalledWith(400);
      expect(mockRes.json).toHaveBeenCalledWith({
        success: false,
        message: 'Invalid bulk schedule data'
      });
    });

    it('should return 400 for invalid schedule in bulk request', async () => {
      mockReq.body = {
        locationId: 'location-id',
        schedules: [
          { dayOfWeek: 'invalid', startTime: '09:00', endTime: '17:00' }
        ]
      };

      await AdminController.createBulkSchedules(mockReq as AuthenticatedRequest, mockRes as Response);

      expect(mockRes.status).toHaveBeenCalledWith(400);
      expect(mockRes.json).toHaveBeenCalledWith({
        success: false,
        message: 'Invalid schedule data in bulk request'
      });
    });

    it('should return 400 for non-object schedule in bulk request', async () => {
      mockReq.body = {
        locationId: 'location-id',
        schedules: ['invalid']
      };

      await AdminController.createBulkSchedules(mockReq as AuthenticatedRequest, mockRes as Response);

      expect(mockRes.status).toHaveBeenCalledWith(400);
      expect(mockRes.json).toHaveBeenCalledWith({
        success: false,
        message: 'Invalid schedule data in bulk request'
      });
    });

    it('should handle AppError in createBulkSchedules', async () => {
      mockReq.body = {
        locationId: 'location-id',
        schedules: [
          { dayOfWeek: 1, startTime: '09:00', endTime: '17:00' }
        ]
      };
      const appError = new AppError('Bulk creation failed', 400);
      mockAdminService.createBulkSchedules.mockRejectedValue(appError);

      await AdminController.createBulkSchedules(mockReq as AuthenticatedRequest, mockRes as Response);

      expect(mockRes.status).toHaveBeenCalledWith(400);
      expect(mockRes.json).toHaveBeenCalledWith({
        success: false,
        message: 'Bulk creation failed'
      });
    });

    it('should handle generic error in createBulkSchedules', async () => {
      mockReq.body = {
        locationId: 'location-id',
        schedules: [
          { dayOfWeek: 1, startTime: '09:00', endTime: '17:00' }
        ]
      };
      mockAdminService.createBulkSchedules.mockRejectedValue(new Error('Generic error'));

      await AdminController.createBulkSchedules(mockReq as AuthenticatedRequest, mockRes as Response);

      expect(mockRes.status).toHaveBeenCalledWith(500);
      expect(mockRes.json).toHaveBeenCalledWith({
        success: false,
        message: 'Internal server error'
      });
    });
  });

  describe('getAllBookings', () => {
    it('should get all bookings successfully', async () => {
      mockReq.query = { status: 'PENDING', startDate: '2024-01-01', endDate: '2024-01-31' };
      const mockBookings = [{ id: '1', status: 'PENDING' }];
      mockAdminService.getAllBookings.mockResolvedValue(mockBookings as any);

      await AdminController.getAllBookings(mockReq as AuthenticatedRequest, mockRes as Response);

      expect(mockAdminService.getAllBookings).toHaveBeenCalledWith({
        status: 'PENDING',
        startDate: '2024-01-01',
        endDate: '2024-01-31'
      });
      expect(mockRes.status).toHaveBeenCalledWith(200);
      expect(mockRes.json).toHaveBeenCalledWith({
        success: true,
        data: mockBookings
      });
    });

    it('should handle AppError in getAllBookings', async () => {
      const appError = new AppError('Booking error', 400);
      mockAdminService.getAllBookings.mockRejectedValue(appError);

      await AdminController.getAllBookings(mockReq as AuthenticatedRequest, mockRes as Response);

      expect(mockRes.status).toHaveBeenCalledWith(400);
      expect(mockRes.json).toHaveBeenCalledWith({
        success: false,
        message: 'Booking error'
      });
    });

    it('should handle generic error in getAllBookings', async () => {
      mockAdminService.getAllBookings.mockRejectedValue(new Error('Generic error'));

      await AdminController.getAllBookings(mockReq as AuthenticatedRequest, mockRes as Response);

      expect(mockRes.status).toHaveBeenCalledWith(500);
      expect(mockRes.json).toHaveBeenCalledWith({
        success: false,
        message: 'Internal server error'
      });
    });
  });

  describe('updateBookingStatus', () => {
    it('should update booking status successfully', async () => {
      mockReq.params = { id: 'booking-id' };
      mockReq.body = { status: 'CONFIRMED' };
      const mockBooking = { id: 'booking-id', status: 'CONFIRMED' };
      mockAdminService.updateBookingStatus.mockResolvedValue(mockBooking as any);

      await AdminController.updateBookingStatus(mockReq as AuthenticatedRequest, mockRes as Response);

      expect(mockRes.status).toHaveBeenCalledWith(200);
      expect(mockRes.json).toHaveBeenCalledWith({
        success: true,
        data: mockBooking
      });
    });

    it('should return 400 for missing booking ID', async () => {
      mockReq.params = {};

      await AdminController.updateBookingStatus(mockReq as AuthenticatedRequest, mockRes as Response);

      expect(mockRes.status).toHaveBeenCalledWith(400);
      expect(mockRes.json).toHaveBeenCalledWith({
        success: false,
        message: 'Booking ID is required'
      });
    });

    it('should return 400 for invalid booking status', async () => {
      mockReq.params = { id: 'booking-id' };
      mockReq.body = { status: 'INVALID_STATUS' };

      await AdminController.updateBookingStatus(mockReq as AuthenticatedRequest, mockRes as Response);

      expect(mockRes.status).toHaveBeenCalledWith(400);
      expect(mockRes.json).toHaveBeenCalledWith({
        success: false,
        message: 'Invalid booking status'
      });
    });

    it('should handle AppError in updateBookingStatus', async () => {
      mockReq.params = { id: 'booking-id' };
      mockReq.body = { status: 'CONFIRMED' };
      const appError = new AppError('Booking not found', 404);
      mockAdminService.updateBookingStatus.mockRejectedValue(appError);

      await AdminController.updateBookingStatus(mockReq as AuthenticatedRequest, mockRes as Response);

      expect(mockRes.status).toHaveBeenCalledWith(404);
      expect(mockRes.json).toHaveBeenCalledWith({
        success: false,
        message: 'Booking not found'
      });
    });

    it('should handle generic error in updateBookingStatus', async () => {
      mockReq.params = { id: 'booking-id' };
      mockReq.body = { status: 'CONFIRMED' };
      mockAdminService.updateBookingStatus.mockRejectedValue(new Error('Generic error'));

      await AdminController.updateBookingStatus(mockReq as AuthenticatedRequest, mockRes as Response);

      expect(mockRes.status).toHaveBeenCalledWith(500);
      expect(mockRes.json).toHaveBeenCalledWith({
        success: false,
        message: 'Internal server error'
      });
    });
  });

  describe('getAnalyticsOverview', () => {
    it('should get analytics overview successfully', async () => {
      const mockAnalytics = { totalBookings: 100, totalRevenue: 5000 };
      mockAdminService.getAnalyticsOverview.mockResolvedValue(mockAnalytics as any);

      await AdminController.getAnalyticsOverview(mockReq as AuthenticatedRequest, mockRes as Response);

      expect(mockRes.status).toHaveBeenCalledWith(200);
      expect(mockRes.json).toHaveBeenCalledWith({
        success: true,
        data: mockAnalytics
      });
    });

    it('should handle AppError in getAnalyticsOverview', async () => {
      const appError = new AppError('Analytics error', 400);
      mockAdminService.getAnalyticsOverview.mockRejectedValue(appError);

      await AdminController.getAnalyticsOverview(mockReq as AuthenticatedRequest, mockRes as Response);

      expect(mockRes.status).toHaveBeenCalledWith(400);
      expect(mockRes.json).toHaveBeenCalledWith({
        success: false,
        message: 'Analytics error'
      });
    });

    it('should handle generic error in getAnalyticsOverview', async () => {
      mockAdminService.getAnalyticsOverview.mockRejectedValue(new Error('Generic error'));

      await AdminController.getAnalyticsOverview(mockReq as AuthenticatedRequest, mockRes as Response);

      expect(mockRes.status).toHaveBeenCalledWith(500);
      expect(mockRes.json).toHaveBeenCalledWith({
        success: false,
        message: 'Internal server error'
      });
    });
  });

  describe('getRevenueAnalytics', () => {
    it('should get revenue analytics successfully', async () => {
      mockReq.query = { startDate: '2024-01-01', endDate: '2024-01-31' };
      const mockRevenue = { totalRevenue: 5000, dailyRevenue: [] };
      mockAdminService.getRevenueAnalytics.mockResolvedValue(mockRevenue as any);

      await AdminController.getRevenueAnalytics(mockReq as AuthenticatedRequest, mockRes as Response);

      expect(mockRes.status).toHaveBeenCalledWith(200);
      expect(mockRes.json).toHaveBeenCalledWith({
        success: true,
        data: mockRevenue
      });
    });

    it('should handle AppError in getRevenueAnalytics', async () => {
      const appError = new AppError('Revenue analytics error', 400);
      mockAdminService.getRevenueAnalytics.mockRejectedValue(appError);

      await AdminController.getRevenueAnalytics(mockReq as AuthenticatedRequest, mockRes as Response);

      expect(mockRes.status).toHaveBeenCalledWith(400);
      expect(mockRes.json).toHaveBeenCalledWith({
        success: false,
        message: 'Revenue analytics error'
      });
    });

    it('should handle generic error in getRevenueAnalytics', async () => {
      mockAdminService.getRevenueAnalytics.mockRejectedValue(new Error('Generic error'));

      await AdminController.getRevenueAnalytics(mockReq as AuthenticatedRequest, mockRes as Response);

      expect(mockRes.status).toHaveBeenCalledWith(500);
      expect(mockRes.json).toHaveBeenCalledWith({
        success: false,
        message: 'Internal server error'
      });
    });
  });

  describe('getBookingAnalytics', () => {
    it('should get booking analytics successfully', async () => {
      mockReq.query = { startDate: '2024-01-01', endDate: '2024-01-31' };
      const mockBookingAnalytics = { totalBookings: 100, bookingsByStatus: {} };
      mockAdminService.getBookingAnalytics.mockResolvedValue(mockBookingAnalytics as any);

      await AdminController.getBookingAnalytics(mockReq as AuthenticatedRequest, mockRes as Response);

      expect(mockRes.status).toHaveBeenCalledWith(200);
      expect(mockRes.json).toHaveBeenCalledWith({
        success: true,
        data: mockBookingAnalytics
      });
    });

    it('should handle AppError in getBookingAnalytics', async () => {
      const appError = new AppError('Booking analytics error', 400);
      mockAdminService.getBookingAnalytics.mockRejectedValue(appError);

      await AdminController.getBookingAnalytics(mockReq as AuthenticatedRequest, mockRes as Response);

      expect(mockRes.status).toHaveBeenCalledWith(400);
      expect(mockRes.json).toHaveBeenCalledWith({
        success: false,
        message: 'Booking analytics error'
      });
    });

    it('should handle generic error in getBookingAnalytics', async () => {
      mockAdminService.getBookingAnalytics.mockRejectedValue(new Error('Generic error'));

      await AdminController.getBookingAnalytics(mockReq as AuthenticatedRequest, mockRes as Response);

      expect(mockRes.status).toHaveBeenCalledWith(500);
      expect(mockRes.json).toHaveBeenCalledWith({
        success: false,
        message: 'Internal server error'
      });
    });
  });
}); 