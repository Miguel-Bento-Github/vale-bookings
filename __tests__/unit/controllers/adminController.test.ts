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
        users: [],
        pagination: { currentPage: 1, totalPages: 1, totalItems: 1, itemsPerPage: 10 }
      };
      (mockAdminService.getAllUsers as jest.MockedFunction<typeof mockAdminService.getAllUsers>)
        .mockResolvedValue(mockResult);

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
      (mockAdminService.getAllUsers as jest.MockedFunction<typeof mockAdminService.getAllUsers>)
        .mockRejectedValue(appError);

      await AdminController.getAllUsers(mockReq as AuthenticatedRequest, mockRes as Response);

      expect(mockRes.status).toHaveBeenCalledWith(400);
      expect(mockRes.json).toHaveBeenCalledWith({
        success: false,
        message: 'Service error'
      });
    });

    it('should handle generic error', async () => {
      (mockAdminService.getAllUsers as jest.MockedFunction<typeof mockAdminService.getAllUsers>)
        .mockRejectedValue(new Error('Generic error'));

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
      const mockUser = {} as never;
      (mockAdminService.updateUserRole as jest.MockedFunction<typeof mockAdminService.updateUserRole>)
        .mockResolvedValue(mockUser);

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
      (mockAdminService.deleteUser as jest.MockedFunction<typeof mockAdminService.deleteUser>)
        .mockResolvedValue(undefined);

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
      const mockValets = [] as never[];
      (mockAdminService.getAllValets as jest.MockedFunction<typeof mockAdminService.getAllValets>)
        .mockResolvedValue(mockValets);

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
      const mockValet = {} as never;
      (mockAdminService.createValet as jest.MockedFunction<typeof mockAdminService.createValet>)
        .mockResolvedValue(mockValet);

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
      const mockValet = {} as never;
      (mockAdminService.updateValet as jest.MockedFunction<typeof mockAdminService.updateValet>)
        .mockResolvedValue(mockValet);

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
      (mockAdminService.deleteValet as jest.MockedFunction<typeof mockAdminService.deleteValet>)
        .mockResolvedValue(undefined);

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
      const mockLocation = {} as never;
      (mockAdminService.createLocation as jest.MockedFunction<typeof mockAdminService.createLocation>)
        .mockResolvedValue(mockLocation);

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
      const mockLocation = {} as never;
      (mockAdminService.updateLocation as jest.MockedFunction<typeof mockAdminService.updateLocation>)
        .mockResolvedValue(mockLocation);

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
      (mockAdminService.deleteLocation as jest.MockedFunction<typeof mockAdminService.deleteLocation>)
        .mockResolvedValue(undefined);

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
      const mockSchedules = [] as never[];
      (mockAdminService.getAllSchedules as jest.MockedFunction<typeof mockAdminService.getAllSchedules>)
        .mockResolvedValue(mockSchedules);

      await AdminController.getAllSchedules(mockReq as AuthenticatedRequest, mockRes as Response);

      expect(mockRes.status).toHaveBeenCalledWith(200);
      expect(mockRes.json).toHaveBeenCalledWith({
        success: true,
        data: mockSchedules
      });
    });

    it('should handle AppError in getAllSchedules', async () => {
      const appError = new AppError('Schedule error', 400);
      (mockAdminService.getAllSchedules as jest.MockedFunction<typeof mockAdminService.getAllSchedules>)
        .mockRejectedValue(appError);

      await AdminController.getAllSchedules(mockReq as AuthenticatedRequest, mockRes as Response);

      expect(mockRes.status).toHaveBeenCalledWith(400);
      expect(mockRes.json).toHaveBeenCalledWith({
        success: false,
        message: 'Schedule error'
      });
    });

    it('should handle generic error in getAllSchedules', async () => {
      (mockAdminService.getAllSchedules as jest.MockedFunction<typeof mockAdminService.getAllSchedules>)
        .mockRejectedValue(new Error('Generic error'));

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
      const mockSchedule = {} as never;
      (mockAdminService.createSchedule as jest.MockedFunction<typeof mockAdminService.createSchedule>)
        .mockResolvedValue(mockSchedule);

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
      (mockAdminService.createSchedule as jest.MockedFunction<typeof mockAdminService.createSchedule>)
        .mockRejectedValue(appError);

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
      (mockAdminService.createSchedule as jest.MockedFunction<typeof mockAdminService.createSchedule>)
        .mockRejectedValue(new Error('Generic error'));

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
      const mockSchedule = {} as never;
      (mockAdminService.updateSchedule as jest.MockedFunction<typeof mockAdminService.updateSchedule>)
        .mockResolvedValue(mockSchedule);

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
      (mockAdminService.updateSchedule as jest.MockedFunction<typeof mockAdminService.updateSchedule>)
        .mockRejectedValue(appError);

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
      (mockAdminService.updateSchedule as jest.MockedFunction<typeof mockAdminService.updateSchedule>)
        .mockRejectedValue(new Error('Generic error'));

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
      (mockAdminService.deleteSchedule as jest.MockedFunction<typeof mockAdminService.deleteSchedule>)
        .mockResolvedValue(undefined);

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
      (mockAdminService.deleteSchedule as jest.MockedFunction<typeof mockAdminService.deleteSchedule>)
        .mockRejectedValue(appError);

      await AdminController.deleteSchedule(mockReq as AuthenticatedRequest, mockRes as Response);

      expect(mockRes.status).toHaveBeenCalledWith(404);
      expect(mockRes.json).toHaveBeenCalledWith({
        success: false,
        message: 'Schedule not found'
      });
    });

    it('should handle generic error in deleteSchedule', async () => {
      mockReq.params = { id: 'schedule-id' };
      (mockAdminService.deleteSchedule as jest.MockedFunction<typeof mockAdminService.deleteSchedule>)
        .mockRejectedValue(new Error('Generic error'));

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
        successful: [],
        failed: []
      };
      (mockAdminService.createBulkSchedules as jest.MockedFunction<typeof mockAdminService.createBulkSchedules>)
        .mockResolvedValue(mockResult as never);

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
        successful: [],
        failed: [{}]
      };
      (mockAdminService.createBulkSchedules as jest.MockedFunction<typeof mockAdminService.createBulkSchedules>)
        .mockResolvedValue(mockResult as never);

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
      (mockAdminService.createBulkSchedules as jest.MockedFunction<typeof mockAdminService.createBulkSchedules>)
        .mockRejectedValue(appError);

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
      (mockAdminService.createBulkSchedules as jest.MockedFunction<typeof mockAdminService.createBulkSchedules>)
        .mockRejectedValue(new Error('Generic error'));

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
      const mockResult = {
        bookings: [] as never[],
        pagination: {
          currentPage: 1,
          totalPages: 1,
          totalItems: 0,
          itemsPerPage: 10
        }
      };
      (mockAdminService.getAllBookings as jest.MockedFunction<typeof mockAdminService.getAllBookings>)
        .mockResolvedValue(mockResult);

      await AdminController.getAllBookings(mockReq as AuthenticatedRequest, mockRes as Response);

      expect(mockRes.status).toHaveBeenCalledWith(200);
      expect(mockRes.json).toHaveBeenCalledWith({
        success: true,
        data: mockResult.bookings,
        pagination: mockResult.pagination
      });
    });

    it('should handle AppError in getAllBookings', async () => {
      const appError = new AppError('Booking error', 400);
      (mockAdminService.getAllBookings as jest.MockedFunction<typeof mockAdminService.getAllBookings>)
        .mockRejectedValue(appError);

      await AdminController.getAllBookings(mockReq as AuthenticatedRequest, mockRes as Response);

      expect(mockRes.status).toHaveBeenCalledWith(400);
      expect(mockRes.json).toHaveBeenCalledWith({
        success: false,
        message: 'Booking error'
      });
    });

    it('should handle generic error in getAllBookings', async () => {
      (mockAdminService.getAllBookings as jest.MockedFunction<typeof mockAdminService.getAllBookings>)
        .mockRejectedValue(new Error('Generic error'));

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
      const mockBooking = {} as never;
      (mockAdminService.updateBookingStatus as jest.MockedFunction<typeof mockAdminService.updateBookingStatus>)
        .mockResolvedValue(mockBooking);

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
      (mockAdminService.updateBookingStatus as jest.MockedFunction<typeof mockAdminService.updateBookingStatus>)
        .mockRejectedValue(appError);

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
      (mockAdminService.updateBookingStatus as jest.MockedFunction<typeof mockAdminService.updateBookingStatus>)
        .mockRejectedValue(new Error('Generic error'));

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
      const mockAnalytics = {} as never;
      (mockAdminService.getAnalyticsOverview as jest.MockedFunction<typeof mockAdminService.getAnalyticsOverview>)
        .mockResolvedValue(mockAnalytics);

      await AdminController.getAnalyticsOverview(mockReq as AuthenticatedRequest, mockRes as Response);

      expect(mockRes.status).toHaveBeenCalledWith(200);
      expect(mockRes.json).toHaveBeenCalledWith({
        success: true,
        data: mockAnalytics
      });
    });

    it('should handle AppError in getAnalyticsOverview', async () => {
      const appError = new AppError('Analytics error', 400);
      (mockAdminService.getAnalyticsOverview as jest.MockedFunction<typeof mockAdminService.getAnalyticsOverview>)
        .mockRejectedValue(appError);

      await AdminController.getAnalyticsOverview(mockReq as AuthenticatedRequest, mockRes as Response);

      expect(mockRes.status).toHaveBeenCalledWith(400);
      expect(mockRes.json).toHaveBeenCalledWith({
        success: false,
        message: 'Analytics error'
      });
    });

    it('should handle generic error in getAnalyticsOverview', async () => {
      (mockAdminService.getAnalyticsOverview as jest.MockedFunction<typeof mockAdminService.getAnalyticsOverview>)
        .mockRejectedValue(new Error('Generic error'));

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
      const mockRevenue = {} as never;
      (mockAdminService.getRevenueAnalytics as jest.MockedFunction<typeof mockAdminService.getRevenueAnalytics>)
        .mockResolvedValue(mockRevenue);

      await AdminController.getRevenueAnalytics(mockReq as AuthenticatedRequest, mockRes as Response);

      expect(mockRes.status).toHaveBeenCalledWith(200);
      expect(mockRes.json).toHaveBeenCalledWith({
        success: true,
        data: mockRevenue
      });
    });

    it('should handle AppError in getRevenueAnalytics', async () => {
      const appError = new AppError('Revenue analytics error', 400);
      (mockAdminService.getRevenueAnalytics as jest.MockedFunction<typeof mockAdminService.getRevenueAnalytics>)
        .mockRejectedValue(appError);

      await AdminController.getRevenueAnalytics(mockReq as AuthenticatedRequest, mockRes as Response);

      expect(mockRes.status).toHaveBeenCalledWith(400);
      expect(mockRes.json).toHaveBeenCalledWith({
        success: false,
        message: 'Revenue analytics error'
      });
    });

    it('should handle generic error in getRevenueAnalytics', async () => {
      (mockAdminService.getRevenueAnalytics as jest.MockedFunction<typeof mockAdminService.getRevenueAnalytics>)
        .mockRejectedValue(new Error('Generic error'));

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
      const mockBookingAnalytics = {} as never;
      (mockAdminService.getBookingAnalytics as jest.MockedFunction<typeof mockAdminService.getBookingAnalytics>)
        .mockResolvedValue(mockBookingAnalytics);

      await AdminController.getBookingAnalytics(mockReq as AuthenticatedRequest, mockRes as Response);

      expect(mockRes.status).toHaveBeenCalledWith(200);
      expect(mockRes.json).toHaveBeenCalledWith({
        success: true,
        data: mockBookingAnalytics
      });
    });

    it('should handle AppError in getBookingAnalytics', async () => {
      const appError = new AppError('Booking analytics error', 400);
      (mockAdminService.getBookingAnalytics as jest.MockedFunction<typeof mockAdminService.getBookingAnalytics>)
        .mockRejectedValue(appError);

      await AdminController.getBookingAnalytics(mockReq as AuthenticatedRequest, mockRes as Response);

      expect(mockRes.status).toHaveBeenCalledWith(400);
      expect(mockRes.json).toHaveBeenCalledWith({
        success: false,
        message: 'Booking analytics error'
      });
    });

    it('should handle generic error in getBookingAnalytics', async () => {
      (mockAdminService.getBookingAnalytics as jest.MockedFunction<typeof mockAdminService.getBookingAnalytics>)
        .mockRejectedValue(new Error('Generic error'));

      await AdminController.getBookingAnalytics(mockReq as AuthenticatedRequest, mockRes as Response);

      expect(mockRes.status).toHaveBeenCalledWith(500);
      expect(mockRes.json).toHaveBeenCalledWith({
        success: false,
        message: 'Internal server error'
      });
    });
  });
}); 