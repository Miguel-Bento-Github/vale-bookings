import { Request, Response } from 'express';

import {
  getAllUsers,
  updateUserRole,
  deleteUser,
  getAllValets,
  createValet,
  updateValet,
  deleteValet,
  createLocation as createAdminLocation,
  getAllSchedules,
  updateSchedule as updateAdminSchedule,
  deleteSchedule as deleteAdminSchedule,
  createBulkSchedules,
  getAllBookings,
  updateBookingStatus as updateAdminBookingStatus,
  getAnalyticsOverview,
  getRevenueAnalytics,
  getBookingAnalytics
} from '../../../src/controllers/AdminController';
import { register, login, refreshToken } from '../../../src/controllers/AuthController';
import {
  getUserBookings,
  getBookingById,
  createBooking,
  updateBookingStatus,
  cancelBooking
} from '../../../src/controllers/BookingController';
import {
  getLocations,
  getNearbyLocations,
  getLocationById,
  createLocation,
  updateLocation,
  deleteLocation
} from '../../../src/controllers/LocationController';
import {
  getLocationSchedules,
  createSchedule,
  updateSchedule,
  deleteSchedule
} from '../../../src/controllers/ScheduleController';
import { getProfile, updateProfile, deleteAccount } from '../../../src/controllers/UserController';
import Booking from '../../../src/models/Booking';
import Location from '../../../src/models/Location';
import AdminService from '../../../src/services/AdminService';
import * as AuthService from '../../../src/services/AuthService';
import * as BookingService from '../../../src/services/BookingService';
import * as LocationService from '../../../src/services/LocationService';
import * as ScheduleService from '../../../src/services/ScheduleService';
import * as UserService from '../../../src/services/UserService';
import { AppError, AuthenticatedRequest, UserRole } from '../../../src/types';

// Mock all services
jest.mock('../../../src/services/AuthService');
jest.mock('../../../src/services/UserService');
jest.mock('../../../src/services/LocationService');
jest.mock('../../../src/services/BookingService');
jest.mock('../../../src/services/ScheduleService');
jest.mock('../../../src/services/AdminService');

// Mock models
jest.mock('../../../src/models/Location');
jest.mock('../../../src/models/Booking');
jest.mock('../../../src/models/User');
jest.mock('../../../src/models/Schedule');

interface TestAuthenticatedRequest extends Request {
  user: {
    userId: string;
    email: string;
    role: UserRole;
  };
}

interface TestAdminRequest extends TestAuthenticatedRequest {
  user: {
    userId: string;
    email: string;
    role: 'ADMIN';
  };
}

describe('Controllers', () => {
  let mockRequest: Partial<Request>;
  let mockResponse: Partial<Response>;
  let mockAuthenticatedRequest: AuthenticatedRequest;

  beforeEach(() => {
    mockRequest = {
      body: {},
      params: {},
      query: {}
    };

    mockResponse = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn().mockReturnThis()
    };

    mockAuthenticatedRequest = {
      ...mockRequest,
      user: {
        userId: '507f1f77bcf86cd799439012',
        email: 'test@example.com',
        role: 'CUSTOMER'
      }
    } as unknown as AuthenticatedRequest;

    jest.clearAllMocks();
  });

  describe('AuthController', () => {
    describe('register', () => {
      it('should register a user successfully', async () => {
        const mockUser = { _id: '507f1f77bcf86cd799439012', email: 'test@example.com' };
        const mockTokens = { accessToken: 'token123', refreshToken: 'refresh123' };
        
        (AuthService.register as jest.Mock).mockResolvedValue({
          user: mockUser,
          tokens: mockTokens
        });

        mockRequest.body = {
          email: 'test@example.com',
          password: 'password123',
          profile: { name: 'Test User' }
        };

        await register(mockRequest as Request, mockResponse as Response);

        expect(mockResponse.status).toHaveBeenCalledWith(201);
        expect(mockResponse.json).toHaveBeenCalledWith({
          success: true,
          message: 'User registered successfully',
          data: { 
            user: mockUser, 
            token: mockTokens.accessToken,
            refreshToken: mockTokens.refreshToken
          }
        });
      });

      it('should return 400 for missing required fields', async () => {
        mockRequest.body = { email: 'test@example.com' }; // missing password and profile

        await register(mockRequest as Request, mockResponse as Response);

        expect(mockResponse.status).toHaveBeenCalledWith(400);
        expect(mockResponse.json).toHaveBeenCalledWith({
          success: false,
          message: 'Email, password, and profile are required'
        });
      });

      it('should return 400 for invalid email format', async () => {
        mockRequest.body = {
          email: 'invalid-email',
          password: 'password123',
          profile: { name: 'Test User' }
        };

        await register(mockRequest as Request, mockResponse as Response);

        expect(mockResponse.status).toHaveBeenCalledWith(400);
        expect(mockResponse.json).toHaveBeenCalledWith({
          success: false,
          message: 'Invalid email format'
        });
      });

      it('should handle service errors', async () => {
        (AuthService.register as jest.Mock).mockRejectedValue(new AppError('Email already exists', 409));

        mockRequest.body = {
          email: 'test@example.com',
          password: 'password123',
          profile: { name: 'Test User' }
        };

        await register(mockRequest as Request, mockResponse as Response);

        expect(mockResponse.status).toHaveBeenCalledWith(409);
        expect(mockResponse.json).toHaveBeenCalledWith({
          success: false,
          message: 'Email already exists'
        });
      });

      it('should return 400 for invalid password format', async () => {
        mockRequest.body = {
          email: 'test@example.com',
          password: '123', // too short
          profile: { name: 'Test User' }
        };

        await register(mockRequest as Request, mockResponse as Response);

        expect(mockResponse.status).toHaveBeenCalledWith(400);
        expect(mockResponse.json).toHaveBeenCalledWith({
          success: false,
          message: 'password must be at least 6 characters long'
        });
      });

      it('should return 400 for missing profile name', async () => {
        mockRequest.body = {
          email: 'test@example.com',
          password: 'password123',
          profile: {} // missing name
        };

        await register(mockRequest as Request, mockResponse as Response);

        expect(mockResponse.status).toHaveBeenCalledWith(400);
        expect(mockResponse.json).toHaveBeenCalledWith({
          success: false,
          message: 'Profile name is required'
        });
      });

      it('should handle unexpected errors', async () => {
        (AuthService.register as jest.Mock).mockRejectedValue(new Error('Unexpected error'));

        mockRequest.body = {
          email: 'test@example.com',
          password: 'password123',
          profile: { name: 'Test User' }
        };

        await register(mockRequest as Request, mockResponse as Response);

        expect(mockResponse.status).toHaveBeenCalledWith(500);
        expect(mockResponse.json).toHaveBeenCalledWith({
          success: false,
          message: 'Internal server error'
        });
      });
    });

    describe('login', () => {
      it('should login successfully', async () => {
        const mockResult = {
          user: { _id: '507f1f77bcf86cd799439012', email: 'test@example.com' },
          tokens: { accessToken: 'token123', refreshToken: 'refresh123' }
        };

        (AuthService.login as jest.Mock).mockResolvedValue(mockResult);

        mockRequest.body = {
          email: 'test@example.com',
          password: 'password123'
        };

        await login(mockRequest as Request, mockResponse as Response);

        expect(mockResponse.status).toHaveBeenCalledWith(200);
        expect(mockResponse.json).toHaveBeenCalledWith({
          success: true,
          message: 'Login successful',
          data: {
            user: mockResult.user,
            token: mockResult.tokens.accessToken,
            refreshToken: mockResult.tokens.refreshToken
          }
        });
      });

      it('should return 400 for missing credentials', async () => {
        mockRequest.body = { email: 'test@example.com' }; // missing password

        await login(mockRequest as Request, mockResponse as Response);

        expect(mockResponse.status).toHaveBeenCalledWith(400);
        expect(mockResponse.json).toHaveBeenCalledWith({
          success: false,
          message: 'Email and password are required'
        });
      });

      it('should return 400 for invalid email format', async () => {
        mockRequest.body = {
          email: 'invalid-email',
          password: 'password123'
        };

        await login(mockRequest as Request, mockResponse as Response);

        expect(mockResponse.status).toHaveBeenCalledWith(400);
        expect(mockResponse.json).toHaveBeenCalledWith({
          success: false,
          message: 'Invalid email format'
        });
      });

      it('should handle service errors', async () => {
        (AuthService.login as jest.Mock).mockRejectedValue(new AppError('Invalid credentials', 401));

        mockRequest.body = {
          email: 'test@example.com',
          password: 'wrongpassword'
        };

        await login(mockRequest as Request, mockResponse as Response);

        expect(mockResponse.status).toHaveBeenCalledWith(401);
        expect(mockResponse.json).toHaveBeenCalledWith({
          success: false,
          message: 'Invalid credentials'
        });
      });

      it('should handle unexpected errors', async () => {
        (AuthService.login as jest.Mock).mockRejectedValue(new Error('Unexpected error'));

        mockRequest.body = {
          email: 'test@example.com',
          password: 'password123'
        };

        await login(mockRequest as Request, mockResponse as Response);

        expect(mockResponse.status).toHaveBeenCalledWith(500);
        expect(mockResponse.json).toHaveBeenCalledWith({
          success: false,
          message: 'Internal server error'
        });
      });
    });

    describe('refreshToken', () => {
      it('should refresh tokens successfully', async () => {
        const mockTokens = { accessToken: 'newToken123', refreshToken: 'newRefresh123' };
        (AuthService.refreshTokens as jest.Mock).mockResolvedValue(mockTokens);

        mockRequest.body = { refreshToken: 'oldRefresh123' };

        await refreshToken(mockRequest as Request, mockResponse as Response);

        expect(mockResponse.status).toHaveBeenCalledWith(200);
        expect(mockResponse.json).toHaveBeenCalledWith({
          success: true,
          message: 'Token refreshed successfully',
          data: { 
            token: mockTokens.accessToken,
            refreshToken: mockTokens.refreshToken
          }
        });
      });

      it('should return 400 for missing refresh token', async () => {
        mockRequest.body = {};

        await refreshToken(mockRequest as Request, mockResponse as Response);

        expect(mockResponse.status).toHaveBeenCalledWith(400);
        expect(mockResponse.json).toHaveBeenCalledWith({
          success: false,
          message: 'Refresh token is required'
        });
      });

      it('should handle service errors', async () => {
        (AuthService.refreshTokens as jest.Mock).mockRejectedValue(new AppError('Invalid refresh token', 401));

        mockRequest.body = { refreshToken: 'invalidToken' };

        await refreshToken(mockRequest as Request, mockResponse as Response);

        expect(mockResponse.status).toHaveBeenCalledWith(401);
        expect(mockResponse.json).toHaveBeenCalledWith({
          success: false,
          message: 'Invalid refresh token'
        });
      });

      it('should handle unexpected errors', async () => {
        (AuthService.refreshTokens as jest.Mock).mockRejectedValue(new Error('Unexpected error'));

        mockRequest.body = { refreshToken: 'validToken123' };

        await refreshToken(mockRequest as Request, mockResponse as Response);

        expect(mockResponse.status).toHaveBeenCalledWith(500);
        expect(mockResponse.json).toHaveBeenCalledWith({
          success: false,
          message: 'Internal server error'
        });
      });
    });
  });

  describe('UserController', () => {
    describe('getProfile', () => {
      it('should get user profile successfully', async () => {
        const mockUser = { _id: '507f1f77bcf86cd799439012', email: 'test@example.com', profile: { name: 'Test User' } };
        (UserService.findById as jest.Mock).mockResolvedValue(mockUser);

        await getProfile(mockAuthenticatedRequest, mockResponse as Response);

        expect(mockResponse.status).toHaveBeenCalledWith(200);
        expect(mockResponse.json).toHaveBeenCalledWith({
          success: true,
          data: mockUser
        });
      });

      it('should return 401 for unauthenticated request', async () => {
        const unauthenticatedRequest = { ...mockRequest } as Request;

        await getProfile(unauthenticatedRequest, mockResponse as Response);

        expect(mockResponse.status).toHaveBeenCalledWith(401);
        expect(mockResponse.json).toHaveBeenCalledWith({
          success: false,
          message: 'Unauthorized'
        });
      });

      it('should return 401 for non-existent user', async () => {
        (UserService.findById as jest.Mock).mockResolvedValue(null);

        await getProfile(mockAuthenticatedRequest, mockResponse as Response);

        expect(mockResponse.status).toHaveBeenCalledWith(401);
        expect(mockResponse.json).toHaveBeenCalledWith({
          success: false,
          message: 'User not found'
        });
      });

      it('should handle service errors', async () => {
        (UserService.findById as jest.Mock).mockRejectedValue(new AppError('Database error', 500));

        await getProfile(mockAuthenticatedRequest, mockResponse as Response);

        expect(mockResponse.status).toHaveBeenCalledWith(500);
        expect(mockResponse.json).toHaveBeenCalledWith({
          success: false,
          message: 'Database error'
        });
      });

      it('should handle unexpected errors', async () => {
        (UserService.findById as jest.Mock).mockRejectedValue(new Error('Unexpected error'));

        await getProfile(mockAuthenticatedRequest, mockResponse as Response);

        expect(mockResponse.status).toHaveBeenCalledWith(500);
        expect(mockResponse.json).toHaveBeenCalledWith({
          success: false,
          message: 'Internal server error'
        });
      });
    });

    describe('updateProfile', () => {
      it('should update profile successfully', async () => {
        const mockUpdatedUser = { _id: '507f1f77bcf86cd799439012', profile: { name: 'Updated Name' } };
        (UserService.updateProfile as jest.Mock).mockResolvedValue(mockUpdatedUser);

        mockAuthenticatedRequest.body = {
          profile: { name: 'Updated Name', phone: '+1234567890' }
        };

        await updateProfile(mockAuthenticatedRequest, mockResponse as Response);

        expect(mockResponse.status).toHaveBeenCalledWith(200);
        expect(mockResponse.json).toHaveBeenCalledWith({
          success: true,
          message: 'Profile updated successfully',
          data: mockUpdatedUser
        });
      });

      it('should return 400 for missing profile data', async () => {
        mockAuthenticatedRequest.body = {};

        await updateProfile(mockAuthenticatedRequest, mockResponse as Response);

        expect(mockResponse.status).toHaveBeenCalledWith(400);
        expect(mockResponse.json).toHaveBeenCalledWith({
          success: false,
          message: 'Profile data is required'
        });
      });

      it('should return 400 for restricted field updates', async () => {
        mockAuthenticatedRequest.body = {
          email: 'newemail@example.com',
          profile: { name: 'Test User' }
        };

        await updateProfile(mockAuthenticatedRequest, mockResponse as Response);

        expect(mockResponse.status).toHaveBeenCalledWith(400);
        expect(mockResponse.json).toHaveBeenCalledWith({
          success: false,
          message: 'Email and role updates are not allowed through this endpoint'
        });
      });

      it('should return 400 for role update attempt', async () => {
        mockAuthenticatedRequest.body = {
          role: 'ADMIN',
          profile: { name: 'Test User' }
        };

        await updateProfile(mockAuthenticatedRequest, mockResponse as Response);

        expect(mockResponse.status).toHaveBeenCalledWith(400);
        expect(mockResponse.json).toHaveBeenCalledWith({
          success: false,
          message: 'Email and role updates are not allowed through this endpoint'
        });
      });

      it('should return 400 for invalid name type', async () => {
        mockAuthenticatedRequest.body = {
          profile: { name: 123 } // invalid type
        };

        await updateProfile(mockAuthenticatedRequest, mockResponse as Response);

        expect(mockResponse.status).toHaveBeenCalledWith(400);
        expect(mockResponse.json).toHaveBeenCalledWith({
          success: false,
          message: 'Name must be a string'
        });
      });

      it('should return 400 for invalid phone number', async () => {
        mockAuthenticatedRequest.body = {
          profile: { phone: 'invalid-phone' }
        };

        await updateProfile(mockAuthenticatedRequest, mockResponse as Response);

        expect(mockResponse.status).toHaveBeenCalledWith(400);
        expect(mockResponse.json).toHaveBeenCalledWith({
          success: false,
          message: 'Invalid phone number format'
        });
      });

      it('should return 401 when user not found during update', async () => {
        (UserService.updateProfile as jest.Mock).mockResolvedValue(null);

        mockAuthenticatedRequest.body = {
          profile: { name: 'Test User' }
        };

        await updateProfile(mockAuthenticatedRequest, mockResponse as Response);

        expect(mockResponse.status).toHaveBeenCalledWith(401);
        expect(mockResponse.json).toHaveBeenCalledWith({
          success: false,
          message: 'User not found'
        });
      });

      it('should handle service errors', async () => {
        (UserService.updateProfile as jest.Mock).mockRejectedValue(new AppError('Database error', 500));

        mockAuthenticatedRequest.body = {
          profile: { name: 'Test User' }
        };

        await updateProfile(mockAuthenticatedRequest, mockResponse as Response);

        expect(mockResponse.status).toHaveBeenCalledWith(500);
        expect(mockResponse.json).toHaveBeenCalledWith({
          success: false,
          message: 'Database error'
        });
      });

      it('should handle unexpected errors', async () => {
        (UserService.updateProfile as jest.Mock).mockRejectedValue(new Error('Unexpected error'));

        mockAuthenticatedRequest.body = {
          profile: { name: 'Test User' }
        };

        await updateProfile(mockAuthenticatedRequest, mockResponse as Response);

        expect(mockResponse.status).toHaveBeenCalledWith(500);
        expect(mockResponse.json).toHaveBeenCalledWith({
          success: false,
          message: 'Internal server error'
        });
      });
    });

    describe('deleteAccount', () => {
      it('should delete account successfully', async () => {
        const mockUser = { _id: '507f1f77bcf86cd799439012', email: 'test@example.com' };
        (UserService.findById as jest.Mock).mockResolvedValue(mockUser);
        (UserService.deleteUser as jest.Mock).mockResolvedValue(true);

        await deleteAccount(mockAuthenticatedRequest, mockResponse as Response);

        expect(mockResponse.status).toHaveBeenCalledWith(200);
        expect(mockResponse.json).toHaveBeenCalledWith({
          success: true,
          message: 'Account deleted successfully'
        });
      });

      it('should return 401 for unauthenticated request', async () => {
        const unauthenticatedRequest = {
          ...mockRequest,
          user: undefined
        };

        await deleteAccount(unauthenticatedRequest as Request, mockResponse as Response);

        expect(mockResponse.status).toHaveBeenCalledWith(401);
        expect(mockResponse.json).toHaveBeenCalledWith({
          success: false,
          message: 'Unauthorized'
        });
      });

      it('should return 401 when user not found', async () => {
        (UserService.findById as jest.Mock).mockResolvedValue(null);

        await deleteAccount(mockAuthenticatedRequest, mockResponse as Response);

        expect(mockResponse.status).toHaveBeenCalledWith(401);
        expect(mockResponse.json).toHaveBeenCalledWith({
          success: false,
          message: 'User not found'
        });
      });

      it('should handle service errors', async () => {
        const mockUser = { _id: '507f1f77bcf86cd799439012', email: 'test@example.com' };
        (UserService.findById as jest.Mock).mockResolvedValue(mockUser);
        (UserService.deleteUser as jest.Mock).mockRejectedValue(new AppError('Database error', 500));

        await deleteAccount(mockAuthenticatedRequest, mockResponse as Response);

        expect(mockResponse.status).toHaveBeenCalledWith(500);
        expect(mockResponse.json).toHaveBeenCalledWith({
          success: false,
          message: 'Database error'
        });
      });

      it('should handle unexpected errors', async () => {
        const mockUser = { _id: '507f1f77bcf86cd799439012', email: 'test@example.com' };
        (UserService.findById as jest.Mock).mockResolvedValue(mockUser);
        (UserService.deleteUser as jest.Mock).mockRejectedValue(new Error('Unexpected error'));

        await deleteAccount(mockAuthenticatedRequest, mockResponse as Response);

        expect(mockResponse.status).toHaveBeenCalledWith(500);
        expect(mockResponse.json).toHaveBeenCalledWith({
          success: false,
          message: 'Internal server error'
        });
      });
    });
  });

  describe('LocationController', () => {

    describe('getLocations', () => {
      it('should get all locations successfully', async () => {
        const mockLocations = [
          { _id: '507f1f77bcf86cd799439011', name: 'Location 1', isActive: true },
          { _id: 'loc2', name: 'Location 2', isActive: true }
        ];
        (LocationService.getAllLocations as jest.Mock).mockResolvedValue(mockLocations);

        await getLocations(mockRequest as Request, mockResponse as Response);

        expect(mockResponse.status).toHaveBeenCalledWith(200);
        expect(mockResponse.json).toHaveBeenCalledWith({
          success: true,
          data: mockLocations
        });
      });

      it('should handle service errors', async () => {
        (LocationService.getAllLocations as jest.Mock).mockRejectedValue(new AppError('Database error', 500));

        await getLocations(mockRequest as Request, mockResponse as Response);

        expect(mockResponse.status).toHaveBeenCalledWith(500);
        expect(mockResponse.json).toHaveBeenCalledWith({
          success: false,
          message: 'Database error'
        });
      });

      it('should handle unexpected errors', async () => {
        (LocationService.getAllLocations as jest.Mock).mockRejectedValue(new Error('Unexpected error'));

        await getLocations(mockRequest as Request, mockResponse as Response);

        expect(mockResponse.status).toHaveBeenCalledWith(500);
        expect(mockResponse.json).toHaveBeenCalledWith({
          success: false,
          message: 'Internal server error'
        });
      });
    });

    describe('getNearbyLocations', () => {
      it('should get nearby locations successfully', async () => {
        const mockLocations = [{ _id: '507f1f77bcf86cd799439011', name: 'Nearby Location' }];
        (LocationService.findNearby as jest.Mock).mockResolvedValue(mockLocations);

        mockRequest.query = {
          latitude: '40.7128',
          longitude: '-74.0060',
          radius: '5000'
        };

        await getNearbyLocations(mockRequest as Request, mockResponse as Response);

        expect(mockResponse.status).toHaveBeenCalledWith(200);
        expect(mockResponse.json).toHaveBeenCalledWith({
          success: true,
          data: mockLocations
        });
      });

      it('should return 400 for missing coordinates', async () => {
        mockRequest.query = { latitude: '40.7128' }; // missing longitude

        await getNearbyLocations(mockRequest as Request, mockResponse as Response);

        expect(mockResponse.status).toHaveBeenCalledWith(400);
        expect(mockResponse.json).toHaveBeenCalledWith({
          success: false,
          message: 'Latitude and longitude are required'
        });
      });

      it('should return 400 for invalid coordinates', async () => {
        mockRequest.query = {
          latitude: '200', // invalid latitude
          longitude: '-74.0060'
        };

        await getNearbyLocations(mockRequest as Request, mockResponse as Response);

        expect(mockResponse.status).toHaveBeenCalledWith(400);
        expect(mockResponse.json).toHaveBeenCalledWith({
          success: false,
          message: 'Invalid coordinates'
        });
      });

      it('should handle service errors', async () => {
        (LocationService.findNearby as jest.Mock).mockRejectedValue(new AppError('Database error', 500));

        mockRequest.query = {
          latitude: '40.7128',
          longitude: '-74.0060',
          radius: '5000'
        };

        await getNearbyLocations(mockRequest as Request, mockResponse as Response);

        expect(mockResponse.status).toHaveBeenCalledWith(500);
        expect(mockResponse.json).toHaveBeenCalledWith({
          success: false,
          message: 'Database error'
        });
      });

      it('should handle unexpected errors', async () => {
        (LocationService.findNearby as jest.Mock).mockRejectedValue(new Error('Unexpected error'));

        mockRequest.query = {
          latitude: '40.7128',
          longitude: '-74.0060',
          radius: '5000'
        };

        await getNearbyLocations(mockRequest as Request, mockResponse as Response);

        expect(mockResponse.status).toHaveBeenCalledWith(500);
        expect(mockResponse.json).toHaveBeenCalledWith({
          success: false,
          message: 'Internal server error'
        });
      });
    });

    describe('getLocationById', () => {
      it('should get location by id successfully', async () => {
        const mockLocation = { _id: '507f1f77bcf86cd799439011', name: 'Test Location', isActive: true };
        (LocationService.getLocationById as jest.Mock).mockResolvedValue(mockLocation);

        mockRequest.params = { id: '507f1f77bcf86cd799439011' };

        await getLocationById(mockRequest as Request, mockResponse as Response);

        expect(mockResponse.status).toHaveBeenCalledWith(200);
        expect(mockResponse.json).toHaveBeenCalledWith({
          success: true,
          data: mockLocation
        });
      });

      it('should return 404 for non-existent location', async () => {
        (LocationService.getLocationById as jest.Mock).mockResolvedValue(null);

        mockRequest.params = { id: '507f1f77bcf86cd799439016' };

        await getLocationById(mockRequest as Request, mockResponse as Response);

        expect(mockResponse.status).toHaveBeenCalledWith(404);
        expect(mockResponse.json).toHaveBeenCalledWith({
          success: false,
          message: 'Location not found'
        });
      });

      it('should handle service errors', async () => {
        (LocationService.getLocationById as jest.Mock).mockRejectedValue(new AppError('Database error', 500));

        mockRequest.params = { id: '507f1f77bcf86cd799439011' };

        await getLocationById(mockRequest as Request, mockResponse as Response);

        expect(mockResponse.status).toHaveBeenCalledWith(500);
        expect(mockResponse.json).toHaveBeenCalledWith({
          success: false,
          message: 'Database error'
        });
      });

      it('should handle unexpected errors', async () => {
        (LocationService.getLocationById as jest.Mock).mockRejectedValue(new Error('Unexpected error'));

        mockRequest.params = { id: '507f1f77bcf86cd799439011' };

        await getLocationById(mockRequest as Request, mockResponse as Response);

        expect(mockResponse.status).toHaveBeenCalledWith(500);
        expect(mockResponse.json).toHaveBeenCalledWith({
          success: false,
          message: 'Internal server error'
        });
      });
    });

    describe('createLocation', () => {
      it('should create location successfully for admin', async () => {
        const mockLocation = { _id: '507f1f77bcf86cd799439011', name: 'New Location' };
        (LocationService.createLocation as jest.Mock).mockResolvedValue(mockLocation);

        const adminRequest = {
          ...mockAuthenticatedRequest,
          user: { ...mockAuthenticatedRequest.user, role: 'ADMIN' },
          body: {
            name: 'New Location',
            address: '123 Main St',
            coordinates: { latitude: 40.7128, longitude: -74.0060 }
          }
        };

        await createLocation(adminRequest as unknown as AuthenticatedRequest, mockResponse as Response);

        expect(mockResponse.status).toHaveBeenCalledWith(201);
        expect(mockResponse.json).toHaveBeenCalledWith({
          success: true,
          message: 'Location created successfully',
          data: mockLocation
        });
      });

      it('should return 403 for non-admin user', async () => {
        mockAuthenticatedRequest.body = {
          name: 'New Location',
          address: '123 Main St',
          coordinates: { latitude: 40.7128, longitude: -74.0060 }
        };

        await createLocation(mockAuthenticatedRequest, mockResponse as Response);

        expect(mockResponse.status).toHaveBeenCalledWith(403);
        expect(mockResponse.json).toHaveBeenCalledWith({
          success: false,
          message: 'Forbidden: access denied'
        });
      });

      it('should return 400 for missing required fields', async () => {
        const adminRequest = {
          ...mockAuthenticatedRequest,
          user: { ...mockAuthenticatedRequest.user, role: 'ADMIN' },
          body: { name: 'New Location' } // missing address and coordinates
        };

        await createLocation(adminRequest as unknown as AuthenticatedRequest, mockResponse as Response);

        expect(mockResponse.status).toHaveBeenCalledWith(400);
        expect(mockResponse.json).toHaveBeenCalledWith({
          success: false,
          message: 'Name and address are required'
        });
      });

      it('should return 400 for invalid coordinates', async () => {
        const adminRequest = {
          ...mockAuthenticatedRequest,
          user: { ...mockAuthenticatedRequest.user, role: 'ADMIN' },
          body: {
            name: 'New Location',
            address: '123 Main St',
            coordinates: { latitude: 200, longitude: -74.0060 } // invalid latitude
          }
        };

        await createLocation(adminRequest as unknown as AuthenticatedRequest, mockResponse as Response);

        expect(mockResponse.status).toHaveBeenCalledWith(400);
        expect(mockResponse.json).toHaveBeenCalledWith({
          success: false,
          message: 'Invalid coordinates'
        });
      });

      it('should handle service errors', async () => {
        (LocationService.createLocation as jest.Mock).mockRejectedValue(new AppError('Database error', 500));

        const adminRequest = {
          ...mockAuthenticatedRequest,
          user: { ...mockAuthenticatedRequest.user, role: 'ADMIN' },
          body: {
            name: 'New Location',
            address: '123 Main St',
            coordinates: { latitude: 40.7128, longitude: -74.0060 }
          }
        };

        await createLocation(adminRequest as unknown as AuthenticatedRequest, mockResponse as Response);

        expect(mockResponse.status).toHaveBeenCalledWith(500);
        expect(mockResponse.json).toHaveBeenCalledWith({
          success: false,
          message: 'Database error'
        });
      });

      it('should handle unexpected errors', async () => {
        (LocationService.createLocation as jest.Mock).mockRejectedValue(new Error('Unexpected error'));

        const adminRequest = {
          ...mockAuthenticatedRequest,
          user: { ...mockAuthenticatedRequest.user, role: 'ADMIN' },
          body: {
            name: 'New Location',
            address: '123 Main St',
            coordinates: { latitude: 40.7128, longitude: -74.0060 }
          }
        };

        await createLocation(adminRequest as unknown as AuthenticatedRequest, mockResponse as Response);

        expect(mockResponse.status).toHaveBeenCalledWith(500);
        expect(mockResponse.json).toHaveBeenCalledWith({
          success: false,
          message: 'Internal server error'
        });
      });
    });

    describe('updateLocation', () => {
      it('should update location successfully for admin', async () => {
        const mockUpdatedLocation = { _id: '507f1f77bcf86cd799439011', name: 'Updated Location' };
        
        (LocationService.updateLocation as jest.Mock).mockResolvedValue(mockUpdatedLocation);

        const adminRequest = {
          ...mockAuthenticatedRequest,
          user: { ...mockAuthenticatedRequest.user, role: 'ADMIN' },
          params: { id: '507f1f77bcf86cd799439011' },
          body: { name: 'Updated Location' }
        };

        await updateLocation(adminRequest as unknown as AuthenticatedRequest, mockResponse as Response);

        expect(mockResponse.status).toHaveBeenCalledWith(200);
        expect(mockResponse.json).toHaveBeenCalledWith({
          success: true,
          message: 'Location updated successfully',
          data: mockUpdatedLocation
        });
      });

      it('should return 403 for non-admin user', async () => {
        mockAuthenticatedRequest.params = { id: '507f1f77bcf86cd799439011' };
        mockAuthenticatedRequest.body = { name: 'Updated Location' };

        await updateLocation(mockAuthenticatedRequest, mockResponse as Response);

        expect(mockResponse.status).toHaveBeenCalledWith(403);
        expect(mockResponse.json).toHaveBeenCalledWith({
          success: false,
          message: 'Forbidden: access denied'
        });
      });

      it('should return 404 for non-existent location', async () => {
        (LocationService.updateLocation as jest.Mock).mockResolvedValue(null);

        const adminRequest = {
          ...mockAuthenticatedRequest,
          user: { ...mockAuthenticatedRequest.user, role: 'ADMIN' },
          params: { id: '507f1f77bcf86cd799439016' },
          body: { name: 'Updated Location' }
        };

        await updateLocation(adminRequest as unknown as AuthenticatedRequest, mockResponse as Response);

        expect(mockResponse.status).toHaveBeenCalledWith(404);
        expect(mockResponse.json).toHaveBeenCalledWith({
          success: false,
          message: 'Location not found'
        });
      });

      it('should return 400 for missing location ID', async () => {
        const adminRequest = {
          ...mockAuthenticatedRequest,
          user: { ...mockAuthenticatedRequest.user, role: 'ADMIN' },
          params: {}, // missing id
          body: { name: 'Updated Location' }
        };

        await updateLocation(adminRequest as unknown as AuthenticatedRequest, mockResponse as Response);

        expect(mockResponse.status).toHaveBeenCalledWith(400);
        expect(mockResponse.json).toHaveBeenCalledWith({
          success: false,
          message: 'Location ID is required'
        });
      });

      it('should return 400 for invalid coordinates in update', async () => {
        const adminRequest = {
          ...mockAuthenticatedRequest,
          user: { ...mockAuthenticatedRequest.user, role: 'ADMIN' },
          params: { id: '507f1f77bcf86cd799439011' },
          body: {
            name: 'Updated Location',
            coordinates: { latitude: 200, longitude: -74.0060 } // invalid latitude
          }
        };

        await updateLocation(adminRequest as unknown as AuthenticatedRequest, mockResponse as Response);

        expect(mockResponse.status).toHaveBeenCalledWith(400);
        expect(mockResponse.json).toHaveBeenCalledWith({
          success: false,
          message: 'Invalid coordinates'
        });
      });

      it('should handle service errors', async () => {
        (LocationService.updateLocation as jest.Mock).mockRejectedValue(new AppError('Database error', 500));

        const adminRequest = {
          ...mockAuthenticatedRequest,
          user: { ...mockAuthenticatedRequest.user, role: 'ADMIN' },
          params: { id: '507f1f77bcf86cd799439011' },
          body: { name: 'Updated Location' }
        };

        await updateLocation(adminRequest as unknown as AuthenticatedRequest, mockResponse as Response);

        expect(mockResponse.status).toHaveBeenCalledWith(500);
        expect(mockResponse.json).toHaveBeenCalledWith({
          success: false,
          message: 'Database error'
        });
      });

      it('should handle unexpected errors', async () => {
        (LocationService.updateLocation as jest.Mock).mockRejectedValue(new Error('Unexpected error'));

        const adminRequest = {
          ...mockAuthenticatedRequest,
          user: { ...mockAuthenticatedRequest.user, role: 'ADMIN' },
          params: { id: '507f1f77bcf86cd799439011' },
          body: { name: 'Updated Location' }
        };

        await updateLocation(adminRequest as unknown as AuthenticatedRequest, mockResponse as Response);

        expect(mockResponse.status).toHaveBeenCalledWith(500);
        expect(mockResponse.json).toHaveBeenCalledWith({
          success: false,
          message: 'Internal server error'
        });
      });
    });

    describe('deleteLocation', () => {
      it('should delete location successfully for admin', async () => {
        const mockLocation = { _id: '507f1f77bcf86cd799439011', name: 'Test Location' };
        
        (LocationService.getLocationById as jest.Mock).mockResolvedValue(mockLocation);
        (LocationService.deleteLocation as jest.Mock).mockResolvedValue(mockLocation);

        const adminRequest = {
          ...mockAuthenticatedRequest,
          user: { ...mockAuthenticatedRequest.user, role: 'ADMIN' },
          params: { id: '507f1f77bcf86cd799439011' }
        };

        await deleteLocation(adminRequest as unknown as AuthenticatedRequest, mockResponse as Response);

        expect(mockResponse.status).toHaveBeenCalledWith(200);
        expect(mockResponse.json).toHaveBeenCalledWith({
          success: true,
          message: 'Location deleted successfully'
        });
      });

      it('should return 403 for non-admin user', async () => {
        mockAuthenticatedRequest.params = { id: '507f1f77bcf86cd799439011' };

        await deleteLocation(mockAuthenticatedRequest, mockResponse as Response);

        expect(mockResponse.status).toHaveBeenCalledWith(403);
        expect(mockResponse.json).toHaveBeenCalledWith({
          success: false,
          message: 'Forbidden: access denied'
        });
      });

      it('should delete location successfully even if non-existent', async () => {
        (LocationService.deleteLocation as jest.Mock).mockResolvedValue(undefined);

        const adminRequest = {
          ...mockAuthenticatedRequest,
          user: { ...mockAuthenticatedRequest.user, role: 'ADMIN' },
          params: { id: '507f1f77bcf86cd799439016' }
        };

        await deleteLocation(adminRequest as unknown as AuthenticatedRequest, mockResponse as Response);

        expect(mockResponse.status).toHaveBeenCalledWith(200);
        expect(mockResponse.json).toHaveBeenCalledWith({
          success: true,
          message: 'Location deleted successfully'
        });
      });

      it('should return 400 for missing location ID', async () => {
        const adminRequest = {
          ...mockAuthenticatedRequest,
          user: { ...mockAuthenticatedRequest.user, role: 'ADMIN' },
          params: {} // missing id
        };

        await deleteLocation(adminRequest as unknown as AuthenticatedRequest, mockResponse as Response);

        expect(mockResponse.status).toHaveBeenCalledWith(400);
        expect(mockResponse.json).toHaveBeenCalledWith({
          success: false,
          message: 'Location ID is required'
        });
      });

      it('should handle service errors when deleting location', async () => {
        (LocationService.deleteLocation as jest.Mock).mockRejectedValue(new AppError('Database error', 500));

        const adminRequest = {
          ...mockAuthenticatedRequest,
          user: { ...mockAuthenticatedRequest.user, role: 'ADMIN' },
          params: { id: '507f1f77bcf86cd799439011' }
        };

        await deleteLocation(adminRequest as unknown as AuthenticatedRequest, mockResponse as Response);

        expect(mockResponse.status).toHaveBeenCalledWith(500);
        expect(mockResponse.json).toHaveBeenCalledWith({
          success: false,
          message: 'Database error'
        });
      });

      it('should handle validation errors for delete requests', async () => {
        const adminRequest = {
          ...mockAuthenticatedRequest,
          user: { ...mockAuthenticatedRequest.user, role: 'ADMIN' },
          params: { id: '' } // Empty ID
        };

        await deleteLocation(adminRequest as unknown as AuthenticatedRequest, mockResponse as Response);

        expect(mockResponse.status).toHaveBeenCalledWith(400);
        expect(mockResponse.json).toHaveBeenCalledWith({
          success: false,
          message: 'Location ID is required'
        });
      });

      it('should handle unexpected errors', async () => {
        (LocationService.deleteLocation as jest.Mock).mockRejectedValue(new Error('Unexpected error'));

        const adminRequest = {
          ...mockAuthenticatedRequest,
          user: { ...mockAuthenticatedRequest.user, role: 'ADMIN' },
          params: { id: '507f1f77bcf86cd799439011' }
        };

        await deleteLocation(adminRequest as unknown as AuthenticatedRequest, mockResponse as Response);

        expect(mockResponse.status).toHaveBeenCalledWith(500);
        expect(mockResponse.json).toHaveBeenCalledWith({
          success: false,
          message: 'Internal server error'
        });
      });
    });
  });

  describe('BookingController', () => {

    describe('getUserBookings', () => {
      it('should get user bookings successfully', async () => {
        const mockBookings = [
          { _id: '507f1f77bcf86cd799439013', userId: '507f1f77bcf86cd799439012', status: 'CONFIRMED' },
          { _id: '507f1f77bcf86cd799439014', userId: '507f1f77bcf86cd799439012', status: 'PENDING' }
        ];
        (BookingService.getUserBookings as jest.Mock).mockResolvedValue(mockBookings);

        await getUserBookings(mockAuthenticatedRequest, mockResponse as Response);

        expect(mockResponse.status).toHaveBeenCalledWith(200);
        expect(mockResponse.json).toHaveBeenCalledWith({
          success: true,
          data: mockBookings
        });
      });

      it('should return 401 for unauthenticated request', async () => {
        const unauthenticatedRequest = { ...mockRequest };

        await getUserBookings(unauthenticatedRequest as Request, mockResponse as Response);

        expect(mockResponse.status).toHaveBeenCalledWith(401);
        expect(mockResponse.json).toHaveBeenCalledWith({
          success: false,
          message: 'Unauthorized'
        });
      });

      it('should handle service errors', async () => {
        (BookingService.getUserBookings as jest.Mock).mockRejectedValue(new AppError('Database error', 500));

        await getUserBookings(mockAuthenticatedRequest, mockResponse as Response);

        expect(mockResponse.status).toHaveBeenCalledWith(500);
        expect(mockResponse.json).toHaveBeenCalledWith({
          success: false,
          message: 'Database error'
        });
      });

      it('should handle unexpected errors', async () => {
        (BookingService.getUserBookings as jest.Mock).mockRejectedValue(new Error('Unexpected error'));

        await getUserBookings(mockAuthenticatedRequest, mockResponse as Response);

        expect(mockResponse.status).toHaveBeenCalledWith(500);
        expect(mockResponse.json).toHaveBeenCalledWith({
          success: false,
          message: 'Internal server error'
        });
      });
    });

    describe('getBookingById', () => {
      it('should get booking by id successfully', async () => {
        const mockBooking = {
          _id: '507f1f77bcf86cd799439013',
          userId: '507f1f77bcf86cd799439012',
          status: 'CONFIRMED'
        };
        (BookingService.findById as jest.Mock).mockResolvedValue(mockBooking);

        mockAuthenticatedRequest.params = { id: '507f1f77bcf86cd799439013' };

        await getBookingById(mockAuthenticatedRequest, mockResponse as Response);

        expect(mockResponse.status).toHaveBeenCalledWith(200);
        expect(mockResponse.json).toHaveBeenCalledWith({
          success: true,
          data: mockBooking
        });
      });

      it('should return 401 for unauthenticated request', async () => {
        const unauthenticatedRequest = {
          ...mockRequest,
          params: { id: '507f1f77bcf86cd799439013' }
        };

        await getBookingById(unauthenticatedRequest as Request, mockResponse as Response);

        expect(mockResponse.status).toHaveBeenCalledWith(401);
        expect(mockResponse.json).toHaveBeenCalledWith({
          success: false,
          message: 'Unauthorized'
        });
      });

      it('should return 404 for non-existent booking', async () => {
        (BookingService.findById as jest.Mock).mockResolvedValue(null);

        mockAuthenticatedRequest.params = { id: '507f1f77bcf86cd799439016' };

        await getBookingById(mockAuthenticatedRequest, mockResponse as Response);

        expect(mockResponse.status).toHaveBeenCalledWith(404);
        expect(mockResponse.json).toHaveBeenCalledWith({
          success: false,
          message: 'Booking not found'
        });
      });

      it('should return 403 for booking not owned by user', async () => {
        const mockBooking = {
          _id: '507f1f77bcf86cd799439013',
          userId: '507f1f77bcf86cd799439017',
          status: 'CONFIRMED'
        };
        (BookingService.findById as jest.Mock).mockResolvedValue(mockBooking);

        mockAuthenticatedRequest.params = { id: '507f1f77bcf86cd799439013' };

        await getBookingById(mockAuthenticatedRequest, mockResponse as Response);

        expect(mockResponse.status).toHaveBeenCalledWith(403);
        expect(mockResponse.json).toHaveBeenCalledWith({
          success: false,
          message: 'Forbidden: access denied'
        });
      });

      it('should allow admin to access any booking', async () => {
        const mockBooking = {
          _id: '507f1f77bcf86cd799439013',
          userId: '507f1f77bcf86cd799439017',
          status: 'CONFIRMED'
        };
        (BookingService.findById as jest.Mock).mockResolvedValue(mockBooking);

        const adminRequest = {
          ...mockAuthenticatedRequest,
          user: { ...mockAuthenticatedRequest.user, role: 'ADMIN' },
          params: { id: '507f1f77bcf86cd799439013' }
        };

        await getBookingById(adminRequest as unknown as AuthenticatedRequest, mockResponse as Response);

        expect(mockResponse.status).toHaveBeenCalledWith(200);
        expect(mockResponse.json).toHaveBeenCalledWith({
          success: true,
          data: mockBooking
        });
      });

      it('should handle service errors', async () => {
        (BookingService.findById as jest.Mock).mockRejectedValue(new AppError('Database error', 500));

        mockAuthenticatedRequest.params = { id: '507f1f77bcf86cd799439013' };

        await getBookingById(mockAuthenticatedRequest, mockResponse as Response);

        expect(mockResponse.status).toHaveBeenCalledWith(500);
        expect(mockResponse.json).toHaveBeenCalledWith({
          success: false,
          message: 'Database error'
        });
      });

      it('should handle unexpected errors', async () => {
        (BookingService.findById as jest.Mock).mockRejectedValue(new Error('Unexpected error'));

        mockAuthenticatedRequest.params = { id: '507f1f77bcf86cd799439013' };

        await getBookingById(mockAuthenticatedRequest, mockResponse as Response);

        expect(mockResponse.status).toHaveBeenCalledWith(500);
        expect(mockResponse.json).toHaveBeenCalledWith({
          success: false,
          message: 'Internal server error'
        });
      });
    });

    describe('createBooking', () => {
      it('should create booking successfully', async () => {
        const mockLocation = { _id: '507f1f77bcf86cd799439011', isActive: true };
        const mockBooking = { _id: '507f1f77bcf86cd799439013', userId: '507f1f77bcf86cd799439012', status: 'PENDING' };

        (Location.findById as jest.Mock).mockResolvedValue(mockLocation);
        (Booking.find as jest.Mock).mockResolvedValue([]); // No overlapping bookings
        (Booking.create as jest.Mock).mockResolvedValue(mockBooking);

        mockAuthenticatedRequest.body = {
          locationId: '507f1f77bcf86cd799439011',
          startTime: '2025-12-01T09:00:00Z',
          endTime: '2025-12-01T17:00:00Z'
        };

        await createBooking(mockAuthenticatedRequest, mockResponse as Response);

        expect(mockResponse.status).toHaveBeenCalledWith(201);
        expect(mockResponse.json).toHaveBeenCalledWith({
          success: true,
          data: mockBooking,
          message: 'Booking created successfully'
        });
      });

      it('should return 400 for missing required fields', async () => {
        mockAuthenticatedRequest.body = { locationId: '507f1f77bcf86cd799439011' }; // missing other fields

        await createBooking(mockAuthenticatedRequest, mockResponse as Response);

        expect(mockResponse.status).toHaveBeenCalledWith(400);
        expect(mockResponse.json).toHaveBeenCalledWith({
          success: false,
          message: 'Location ID, start time, and end time are required'
        });
      });

      it('should return 401 for unauthenticated request', async () => {
        const unauthenticatedRequest = { ...mockRequest, body: {} };

        await createBooking(unauthenticatedRequest as Request, mockResponse as Response);

        expect(mockResponse.status).toHaveBeenCalledWith(401);
        expect(mockResponse.json).toHaveBeenCalledWith({
          success: false,
          message: 'Unauthorized'
        });
      });

      it('should handle service errors', async () => {
        const mockLocation = { _id: '507f1f77bcf86cd799439011', isActive: true };

        (Location.findById as jest.Mock).mockResolvedValue(mockLocation);
        (Booking.find as jest.Mock).mockResolvedValue([]);
        (Booking.create as jest.Mock).mockRejectedValue(new AppError('Database error', 500));

        mockAuthenticatedRequest.body = {
          locationId: '507f1f77bcf86cd799439011',
          startTime: '2025-12-01T09:00:00Z',
          endTime: '2025-12-01T17:00:00Z'
        };

        await createBooking(mockAuthenticatedRequest, mockResponse as Response);

        expect(mockResponse.status).toHaveBeenCalledWith(500);
        expect(mockResponse.json).toHaveBeenCalledWith({
          success: false,
          message: 'Database error'
        });
      });

      it('should handle unexpected errors', async () => {
        const mockLocation = { _id: '507f1f77bcf86cd799439011', isActive: true };

        (Location.findById as jest.Mock).mockResolvedValue(mockLocation);
        (Booking.find as jest.Mock).mockResolvedValue([]);
        (Booking.create as jest.Mock).mockRejectedValue(new Error('Unexpected error'));

        mockAuthenticatedRequest.body = {
          locationId: '507f1f77bcf86cd799439011',
          startTime: '2025-12-01T09:00:00Z',
          endTime: '2025-12-01T17:00:00Z'
        };

        await createBooking(mockAuthenticatedRequest, mockResponse as Response);

        expect(mockResponse.status).toHaveBeenCalledWith(500);
        expect(mockResponse.json).toHaveBeenCalledWith({
          success: false,
          message: 'Internal server error'
        });
      });
    });

    describe('updateBookingStatus', () => {
      it('should update booking status successfully', async () => {
        const mockUpdatedBooking = {
          _id: '507f1f77bcf86cd799439013',
          userId: '507f1f77bcf86cd799439012',
          status: 'CONFIRMED'
        };
        
        // Mock the service function
        (BookingService.updateBookingStatus as jest.Mock).mockResolvedValue(mockUpdatedBooking);

        const adminRequest = {
          ...mockAuthenticatedRequest,
          user: { ...mockAuthenticatedRequest.user, role: 'ADMIN' },
          params: { id: '507f1f77bcf86cd799439013' },
          body: { status: 'CONFIRMED' }
        };

        await updateBookingStatus(adminRequest as unknown as AuthenticatedRequest, mockResponse as Response);

        expect(mockResponse.status).toHaveBeenCalledWith(200);
        expect(mockResponse.json).toHaveBeenCalledWith({
          success: true,
          data: mockUpdatedBooking,
          message: 'Booking status updated successfully'
        });
      });

      it('should return 401 for unauthenticated request', async () => {
        const unauthenticatedRequest = { 
          ...mockRequest, 
          params: { id: '507f1f77bcf86cd799439013' },
          body: { status: 'CONFIRMED' }
        };

        await updateBookingStatus(unauthenticatedRequest as Request, mockResponse as Response);

        expect(mockResponse.status).toHaveBeenCalledWith(401);
        expect(mockResponse.json).toHaveBeenCalledWith({
          success: false,
          message: 'Unauthorized'
        });
      });

      it('should return 403 for non-admin/valet user', async () => {
        mockAuthenticatedRequest.params = { id: '507f1f77bcf86cd799439013' };
        mockAuthenticatedRequest.body = { status: 'CONFIRMED' };

        await updateBookingStatus(mockAuthenticatedRequest, mockResponse as Response);

        expect(mockResponse.status).toHaveBeenCalledWith(403);
        expect(mockResponse.json).toHaveBeenCalledWith({
          success: false,
          message: 'Forbidden: insufficient permissions'
        });
      });

      it('should return 404 for non-existent booking', async () => {
        (BookingService.updateBookingStatus as jest.Mock).mockResolvedValue(null);

        const adminRequest = {
          ...mockAuthenticatedRequest,
          user: { ...mockAuthenticatedRequest.user, role: 'ADMIN' },
          params: { id: '507f1f77bcf86cd799439016' },
          body: { status: 'CONFIRMED' }
        };

        await updateBookingStatus(adminRequest as unknown as AuthenticatedRequest, mockResponse as Response);

        expect(mockResponse.status).toHaveBeenCalledWith(404);
        expect(mockResponse.json).toHaveBeenCalledWith({
          success: false,
          message: 'Booking not found'
        });
      });

      it('should return 403 for booking not owned by user', async () => {
        const mockBooking = { _id: '507f1f77bcf86cd799439013', userId: '507f1f77bcf86cd799439017', status: 'PENDING' };
        (Booking.findById as jest.Mock).mockResolvedValue(mockBooking);

        mockAuthenticatedRequest.params = { id: '507f1f77bcf86cd799439013' };
        mockAuthenticatedRequest.body = { status: 'CONFIRMED' };

        await updateBookingStatus(mockAuthenticatedRequest, mockResponse as Response);

        expect(mockResponse.status).toHaveBeenCalledWith(403);
        expect(mockResponse.json).toHaveBeenCalledWith({
          success: false,
          message: 'Forbidden: insufficient permissions'
        });
      });

      it('should handle service errors', async () => {
        (BookingService.updateBookingStatus as jest.Mock).mockRejectedValue(new AppError('Database error', 500));

        const adminRequest = {
          ...mockAuthenticatedRequest,
          user: { ...mockAuthenticatedRequest.user, role: 'ADMIN' },
          params: { id: '507f1f77bcf86cd799439013' },
          body: { status: 'CONFIRMED' }
        };

        await updateBookingStatus(adminRequest as unknown as AuthenticatedRequest, mockResponse as Response);

        expect(mockResponse.status).toHaveBeenCalledWith(500);
        expect(mockResponse.json).toHaveBeenCalledWith({
          success: false,
          message: 'Database error'
        });
      });

      it('should handle unexpected errors', async () => {
        (BookingService.updateBookingStatus as jest.Mock).mockRejectedValue(new Error('Unexpected error'));

        const adminRequest = {
          ...mockAuthenticatedRequest,
          user: { ...mockAuthenticatedRequest.user, role: 'ADMIN' },
          params: { id: '507f1f77bcf86cd799439013' },
          body: { status: 'CONFIRMED' }
        };

        await updateBookingStatus(adminRequest as unknown as AuthenticatedRequest, mockResponse as Response);

        expect(mockResponse.status).toHaveBeenCalledWith(500);
        expect(mockResponse.json).toHaveBeenCalledWith({
          success: false,
          message: 'Internal server error'
        });
      });
    });

    describe('cancelBooking', () => {
      it('should cancel booking successfully', async () => {
        const mockBooking = {
          _id: '507f1f77bcf86cd799439013',
          userId: '507f1f77bcf86cd799439012',
          status: 'CONFIRMED'
        };
        const mockCancelledBooking = {
          _id: '507f1f77bcf86cd799439013',
          userId: '507f1f77bcf86cd799439012',
          status: 'CANCELLED'
        };
        
        (BookingService.findById as jest.Mock).mockResolvedValue(mockBooking);
        (BookingService.cancelBooking as jest.Mock).mockResolvedValue(mockCancelledBooking);

        mockAuthenticatedRequest.params = { id: '507f1f77bcf86cd799439013' };

        await cancelBooking(mockAuthenticatedRequest, mockResponse as Response);

        expect(mockResponse.status).toHaveBeenCalledWith(200);
        expect(mockResponse.json).toHaveBeenCalledWith({
          success: true,
          data: mockCancelledBooking,
          message: 'Booking cancelled successfully'
        });
      });

      it('should return 401 for unauthenticated request', async () => {
        const unauthenticatedRequest = {
          ...mockRequest,
          params: { id: '507f1f77bcf86cd799439013' }
        };

        await cancelBooking(unauthenticatedRequest as Request, mockResponse as Response);

        expect(mockResponse.status).toHaveBeenCalledWith(401);
        expect(mockResponse.json).toHaveBeenCalledWith({
          success: false,
          message: 'Unauthorized'
        });
      });

      it('should return 404 for non-existent booking', async () => {
        (BookingService.findById as jest.Mock).mockResolvedValue(null);

        mockAuthenticatedRequest.params = { id: '507f1f77bcf86cd799439016' };

        await cancelBooking(mockAuthenticatedRequest, mockResponse as Response);

        expect(mockResponse.status).toHaveBeenCalledWith(404);
        expect(mockResponse.json).toHaveBeenCalledWith({
          success: false,
          message: 'Booking not found'
        });
      });

      it('should return 403 for booking not owned by user', async () => {
        const mockBooking = {
          _id: '507f1f77bcf86cd799439013',
          userId: '507f1f77bcf86cd799439017',
          status: 'CONFIRMED'
        };
        (BookingService.findById as jest.Mock).mockResolvedValue(mockBooking);

        mockAuthenticatedRequest.params = { id: '507f1f77bcf86cd799439013' };

        await cancelBooking(mockAuthenticatedRequest, mockResponse as Response);

        expect(mockResponse.status).toHaveBeenCalledWith(403);
        expect(mockResponse.json).toHaveBeenCalledWith({
          success: false,
          message: 'Forbidden: access denied'
        });
      });

      it('should handle service errors', async () => {
        (BookingService.findById as jest.Mock).mockRejectedValue(new AppError('Database error', 500));

        mockAuthenticatedRequest.params = { id: '507f1f77bcf86cd799439013' };

        await cancelBooking(mockAuthenticatedRequest, mockResponse as Response);

        expect(mockResponse.status).toHaveBeenCalledWith(500);
        expect(mockResponse.json).toHaveBeenCalledWith({
          success: false,
          message: 'Database error'
        });
      });

      it('should handle unexpected errors', async () => {
        (BookingService.findById as jest.Mock).mockRejectedValue(new Error('Unexpected error'));

        mockAuthenticatedRequest.params = { id: '507f1f77bcf86cd799439013' };

        await cancelBooking(mockAuthenticatedRequest, mockResponse as Response);

        expect(mockResponse.status).toHaveBeenCalledWith(500);
        expect(mockResponse.json).toHaveBeenCalledWith({
          success: false,
          message: 'Internal server error'
        });
      });
    });
  });

  describe('ScheduleController', () => {

    describe('getLocationSchedules', () => {
      it('should get location schedules successfully', async () => {
        const mockLocation = { _id: '507f1f77bcf86cd799439011', name: 'Test Location' };
        const mockSchedules = [
          {
            _id: '507f1f77bcf86cd799439015',
            locationId: '507f1f77bcf86cd799439011',
            dayOfWeek: 1,
            startTime: '09:00',
            endTime: '18:00'
          }
        ];
        
        (LocationService.getLocationById as jest.Mock).mockResolvedValue(mockLocation);
        (ScheduleService.getLocationSchedules as jest.Mock).mockResolvedValue(mockSchedules);

        mockRequest.params = { locationId: '507f1f77bcf86cd799439011' };

        await getLocationSchedules(mockRequest as Request, mockResponse as Response);

        expect(mockResponse.status).toHaveBeenCalledWith(200);
        expect(mockResponse.json).toHaveBeenCalledWith({
          success: true,
          data: mockSchedules
        });
      });

      it('should return 400 for missing location ID', async () => {
        mockRequest.params = {};

        await getLocationSchedules(mockRequest as Request, mockResponse as Response);

        expect(mockResponse.status).toHaveBeenCalledWith(400);
        expect(mockResponse.json).toHaveBeenCalledWith({
          success: false,
          message: 'Location ID is required'
        });
      });

      it('should return 404 for non-existent location', async () => {
        (LocationService.getLocationById as jest.Mock).mockResolvedValue(null);

        mockRequest.params = { locationId: '507f1f77bcf86cd799439016' };

        await getLocationSchedules(mockRequest as Request, mockResponse as Response);

        expect(mockResponse.status).toHaveBeenCalledWith(404);
        expect(mockResponse.json).toHaveBeenCalledWith({
          success: false,
          message: 'Location not found'
        });
      });

      it('should handle service errors', async () => {
        (LocationService.getLocationById as jest.Mock).mockRejectedValue(new AppError('Database error', 500));

        mockRequest.params = { locationId: '507f1f77bcf86cd799439011' };

        await getLocationSchedules(mockRequest as Request, mockResponse as Response);

        expect(mockResponse.status).toHaveBeenCalledWith(500);
        expect(mockResponse.json).toHaveBeenCalledWith({
          success: false,
          message: 'Database error'
        });
      });

      it('should handle unexpected errors', async () => {
        (LocationService.getLocationById as jest.Mock).mockRejectedValue(new Error('Unexpected error'));

        mockRequest.params = { locationId: '507f1f77bcf86cd799439011' };

        await getLocationSchedules(mockRequest as Request, mockResponse as Response);

        expect(mockResponse.status).toHaveBeenCalledWith(500);
        expect(mockResponse.json).toHaveBeenCalledWith({
          success: false,
          message: 'Internal server error'
        });
      });
    });

    describe('createSchedule', () => {
      it('should create schedule successfully for admin', async () => {
        const mockLocation = { _id: '507f1f77bcf86cd799439011', name: 'Test Location' };
        const mockSchedule = { _id: '507f1f77bcf86cd799439015', locationId: '507f1f77bcf86cd799439011', dayOfWeek: 1 };
        
        (LocationService.getLocationById as jest.Mock).mockResolvedValue(mockLocation);
        (ScheduleService.createSchedule as jest.Mock).mockResolvedValue(mockSchedule);

        const adminRequest = {
          ...mockAuthenticatedRequest,
          user: { ...mockAuthenticatedRequest.user, role: 'ADMIN' },
          body: {
            locationId: '507f1f77bcf86cd799439011',
            dayOfWeek: 1,
            startTime: '09:00',
            endTime: '18:00'
          }
        };

        await createSchedule(adminRequest as unknown as AuthenticatedRequest, mockResponse as Response);

        expect(mockResponse.status).toHaveBeenCalledWith(201);
        expect(mockResponse.json).toHaveBeenCalledWith({
          success: true,
          message: 'Schedule created successfully',
          data: mockSchedule
        });
      });

      it('should return 403 for non-admin user', async () => {
        mockAuthenticatedRequest.body = {
          locationId: '507f1f77bcf86cd799439011',
          dayOfWeek: 1,
          startTime: '09:00',
          endTime: '18:00'
        };

        await createSchedule(mockAuthenticatedRequest, mockResponse as Response);

        expect(mockResponse.status).toHaveBeenCalledWith(403);
        expect(mockResponse.json).toHaveBeenCalledWith({
          success: false,
          message: 'Forbidden: access denied'
        });
      });

      it('should return 400 for invalid day of week', async () => {
        const adminRequest = {
          ...mockAuthenticatedRequest,
          user: { ...mockAuthenticatedRequest.user, role: 'ADMIN' },
          body: {
            locationId: '507f1f77bcf86cd799439011',
            dayOfWeek: 8, // invalid day of week
            startTime: '09:00',
            endTime: '18:00'
          }
        };

        await createSchedule(adminRequest as unknown as AuthenticatedRequest, mockResponse as Response);

        expect(mockResponse.status).toHaveBeenCalledWith(400);
        expect(mockResponse.json).toHaveBeenCalledWith({
          success: false,
          message: 'Day of week must be between 0 (Sunday) and 6 (Saturday)'
        });
      });

      it('should return 400 for invalid time format', async () => {
        const adminRequest = {
          ...mockAuthenticatedRequest,
          user: { ...mockAuthenticatedRequest.user, role: 'ADMIN' },
          body: {
            locationId: '507f1f77bcf86cd799439011',
            dayOfWeek: 1,
            startTime: '25:00', // invalid time
            endTime: '18:00'
          }
        };

        await createSchedule(adminRequest as unknown as AuthenticatedRequest, mockResponse as Response);

        expect(mockResponse.status).toHaveBeenCalledWith(400);
        expect(mockResponse.json).toHaveBeenCalledWith({
          success: false,
          message: 'Time must be in HH:MM format'
        });
      });

      it('should return 400 for missing required fields', async () => {
        const adminRequest = {
          ...mockAuthenticatedRequest,
          user: { ...mockAuthenticatedRequest.user, role: 'ADMIN' },
          body: {
            locationId: '507f1f77bcf86cd799439011'
            // missing dayOfWeek, startTime, endTime
          }
        };

        await createSchedule(adminRequest as unknown as AuthenticatedRequest, mockResponse as Response);

        expect(mockResponse.status).toHaveBeenCalledWith(400);
        expect(mockResponse.json).toHaveBeenCalledWith({
          success: false,
          message: 'Location ID, day of week, start time, and end time are required'
        });
      });

      it('should return 400 for end time before start time', async () => {
        const mockLocation = { _id: '507f1f77bcf86cd799439011', name: 'Test Location' };
        (LocationService.getLocationById as jest.Mock).mockResolvedValue(mockLocation);

        const adminRequest = {
          ...mockAuthenticatedRequest,
          user: { ...mockAuthenticatedRequest.user, role: 'ADMIN' },
          body: {
            locationId: '507f1f77bcf86cd799439011',
            dayOfWeek: 1,
            startTime: '18:00',
            endTime: '09:00' // end before start
          }
        };

        await createSchedule(adminRequest as unknown as AuthenticatedRequest, mockResponse as Response);

        expect(mockResponse.status).toHaveBeenCalledWith(400);
        expect(mockResponse.json).toHaveBeenCalledWith({
          success: false,
          message: 'End time must be after start time'
        });
      });

      it('should return 404 for non-existent location', async () => {
        (LocationService.getLocationById as jest.Mock).mockResolvedValue(null);

        const adminRequest = {
          ...mockAuthenticatedRequest,
          user: { ...mockAuthenticatedRequest.user, role: 'ADMIN' },
          body: {
            locationId: '507f1f77bcf86cd799439016',
            dayOfWeek: 1,
            startTime: '09:00',
            endTime: '18:00'
          }
        };

        await createSchedule(adminRequest as unknown as AuthenticatedRequest, mockResponse as Response);

        expect(mockResponse.status).toHaveBeenCalledWith(404);
        expect(mockResponse.json).toHaveBeenCalledWith({
          success: false,
          message: 'Location not found'
        });
      });

      it('should handle service errors', async () => {
        const mockLocation = { _id: '507f1f77bcf86cd799439011', name: 'Test Location' };
        (LocationService.getLocationById as jest.Mock).mockResolvedValue(mockLocation);
        (ScheduleService.createSchedule as jest.Mock).mockRejectedValue(new AppError('Database error', 500));

        const adminRequest = {
          ...mockAuthenticatedRequest,
          user: { ...mockAuthenticatedRequest.user, role: 'ADMIN' },
          body: {
            locationId: '507f1f77bcf86cd799439011',
            dayOfWeek: 1,
            startTime: '09:00',
            endTime: '18:00'
          }
        };

        await createSchedule(adminRequest as unknown as AuthenticatedRequest, mockResponse as Response);

        expect(mockResponse.status).toHaveBeenCalledWith(500);
        expect(mockResponse.json).toHaveBeenCalledWith({
          success: false,
          message: 'Database error'
        });
      });

      it('should handle unexpected errors', async () => {
        (LocationService.getLocationById as jest.Mock).mockRejectedValue(new Error('Unexpected error'));

        const adminRequest = {
          ...mockAuthenticatedRequest,
          user: { ...mockAuthenticatedRequest.user, role: 'ADMIN' },
          body: {
            locationId: '507f1f77bcf86cd799439011',
            dayOfWeek: 1,
            startTime: '09:00',
            endTime: '18:00'
          }
        };

        await createSchedule(adminRequest as unknown as AuthenticatedRequest, mockResponse as Response);

        expect(mockResponse.status).toHaveBeenCalledWith(500);
        expect(mockResponse.json).toHaveBeenCalledWith({
          success: false,
          message: 'Internal server error'
        });
      });
    });

    describe('updateSchedule', () => {
      it('should update schedule successfully for admin', async () => {

        const mockUpdatedSchedule = {
          _id: '507f1f77bcf86cd799439015',
          locationId: '507f1f77bcf86cd799439011',
          dayOfWeek: 1,
          startTime: '08:00',
          endTime: '19:00'
        };
        
        (ScheduleService.updateSchedule as jest.Mock).mockResolvedValue(mockUpdatedSchedule);

        const adminRequest = {
          ...mockAuthenticatedRequest,
          user: { ...mockAuthenticatedRequest.user, role: 'ADMIN' },
          params: { id: '507f1f77bcf86cd799439015' },
          body: { startTime: '08:00', endTime: '19:00' }
        };

        await updateSchedule(adminRequest as unknown as AuthenticatedRequest, mockResponse as Response);

        expect(mockResponse.status).toHaveBeenCalledWith(200);
        expect(mockResponse.json).toHaveBeenCalledWith({
          success: true,
          message: 'Schedule updated successfully',
          data: mockUpdatedSchedule
        });
      });

      it('should return 403 for non-admin user', async () => {
        mockAuthenticatedRequest.params = { id: '507f1f77bcf86cd799439015' };
        mockAuthenticatedRequest.body = { startTime: '08:00' };

        await updateSchedule(mockAuthenticatedRequest, mockResponse as Response);

        expect(mockResponse.status).toHaveBeenCalledWith(403);
        expect(mockResponse.json).toHaveBeenCalledWith({
          success: false,
          message: 'Forbidden: access denied'
        });
      });

      it('should return 404 for non-existent schedule', async () => {
        (ScheduleService.updateSchedule as jest.Mock).mockResolvedValue(null);

        const adminRequest = {
          ...mockAuthenticatedRequest,
          user: { ...mockAuthenticatedRequest.user, role: 'ADMIN' },
          params: { id: '507f1f77bcf86cd799439016' },
          body: { startTime: '08:00' }
        };

        await updateSchedule(adminRequest as unknown as AuthenticatedRequest, mockResponse as Response);

        expect(mockResponse.status).toHaveBeenCalledWith(404);
        expect(mockResponse.json).toHaveBeenCalledWith({
          success: false,
          message: 'Schedule not found'
        });
      });

      it('should return 400 for invalid time format', async () => {
        const adminRequest = {
          ...mockAuthenticatedRequest,
          user: { ...mockAuthenticatedRequest.user, role: 'ADMIN' },
          params: { id: '507f1f77bcf86cd799439015' },
          body: { startTime: '25:00' } // invalid time
        };

        await updateSchedule(adminRequest as unknown as AuthenticatedRequest, mockResponse as Response);

        expect(mockResponse.status).toHaveBeenCalledWith(400);
        expect(mockResponse.json).toHaveBeenCalledWith({
          success: false,
          message: 'Start time must be in HH:MM format'
        });
      });

      it('should return 400 for missing schedule ID', async () => {
        const adminRequest = {
          ...mockAuthenticatedRequest,
          user: { ...mockAuthenticatedRequest.user, role: 'ADMIN' },
          params: {}, // missing id
          body: { startTime: '08:00' }
        };

        await updateSchedule(adminRequest as unknown as AuthenticatedRequest, mockResponse as Response);

        expect(mockResponse.status).toHaveBeenCalledWith(400);
        expect(mockResponse.json).toHaveBeenCalledWith({
          success: false,
          message: 'Schedule ID is required'
        });
      });

      it('should return 400 for invalid day of week in update', async () => {
        const adminRequest = {
          ...mockAuthenticatedRequest,
          user: { ...mockAuthenticatedRequest.user, role: 'ADMIN' },
          params: { id: '507f1f77bcf86cd799439015' },
          body: { dayOfWeek: 8 } // invalid day of week
        };

        await updateSchedule(adminRequest as unknown as AuthenticatedRequest, mockResponse as Response);

        expect(mockResponse.status).toHaveBeenCalledWith(400);
        expect(mockResponse.json).toHaveBeenCalledWith({
          success: false,
          message: 'Day of week must be between 0 (Sunday) and 6 (Saturday)'
        });
      });

      it('should return 400 for invalid end time format', async () => {
        const adminRequest = {
          ...mockAuthenticatedRequest,
          user: { ...mockAuthenticatedRequest.user, role: 'ADMIN' },
          params: { id: '507f1f77bcf86cd799439015' },
          body: { endTime: '25:00' } // invalid time
        };

        await updateSchedule(adminRequest as unknown as AuthenticatedRequest, mockResponse as Response);

        expect(mockResponse.status).toHaveBeenCalledWith(400);
        expect(mockResponse.json).toHaveBeenCalledWith({
          success: false,
          message: 'End time must be in HH:MM format'
        });
      });

      it('should handle service errors', async () => {
        (ScheduleService.updateSchedule as jest.Mock).mockRejectedValue(new AppError('Database error', 500));

        const adminRequest = {
          ...mockAuthenticatedRequest,
          user: { ...mockAuthenticatedRequest.user, role: 'ADMIN' },
          params: { id: '507f1f77bcf86cd799439015' },
          body: { startTime: '08:00' }
        };

        await updateSchedule(adminRequest as unknown as AuthenticatedRequest, mockResponse as Response);

        expect(mockResponse.status).toHaveBeenCalledWith(500);
        expect(mockResponse.json).toHaveBeenCalledWith({
          success: false,
          message: 'Database error'
        });
      });

      it('should handle unexpected errors', async () => {
        (ScheduleService.updateSchedule as jest.Mock).mockRejectedValue(new Error('Unexpected error'));

        const adminRequest = {
          ...mockAuthenticatedRequest,
          user: { ...mockAuthenticatedRequest.user, role: 'ADMIN' },
          params: { id: '507f1f77bcf86cd799439015' },
          body: { startTime: '08:00' }
        };

        await updateSchedule(adminRequest as unknown as AuthenticatedRequest, mockResponse as Response);

        expect(mockResponse.status).toHaveBeenCalledWith(500);
        expect(mockResponse.json).toHaveBeenCalledWith({
          success: false,
          message: 'Internal server error'
        });
      });
    });

    describe('deleteSchedule', () => {
      it('should delete schedule successfully for admin', async () => {
        (ScheduleService.getScheduleById as jest.Mock).mockResolvedValue({ _id: '507f1f77bcf86cd799439015' });
        (ScheduleService.deleteSchedule as jest.Mock).mockResolvedValue(true);

        const adminRequest = {
          ...mockAuthenticatedRequest,
          user: { ...mockAuthenticatedRequest.user, role: 'ADMIN' },
          params: { id: '507f1f77bcf86cd799439015' }
        };

        await deleteSchedule(adminRequest as unknown as AuthenticatedRequest, mockResponse as Response);

        expect(mockResponse.status).toHaveBeenCalledWith(200);
        expect(mockResponse.json).toHaveBeenCalledWith({
          success: true,
          message: 'Schedule deleted successfully'
        });
      });

      it('should return 403 for non-admin user', async () => {
        mockAuthenticatedRequest.params = { id: '507f1f77bcf86cd799439015' };

        await deleteSchedule(mockAuthenticatedRequest, mockResponse as Response);

        expect(mockResponse.status).toHaveBeenCalledWith(403);
        expect(mockResponse.json).toHaveBeenCalledWith({
          success: false,
          message: 'Forbidden: access denied'
        });
      });

      it('should return 404 for non-existent schedule', async () => {
        (ScheduleService.getScheduleById as jest.Mock).mockResolvedValue(null);

        const adminRequest = {
          ...mockAuthenticatedRequest,
          user: { ...mockAuthenticatedRequest.user, role: 'ADMIN' },
          params: { id: '507f1f77bcf86cd799439016' }
        };

        await deleteSchedule(adminRequest as unknown as AuthenticatedRequest, mockResponse as Response);

        expect(mockResponse.status).toHaveBeenCalledWith(404);
        expect(mockResponse.json).toHaveBeenCalledWith({
          success: false,
          message: 'Schedule not found'
        });
      });

      it('should return 400 for missing schedule ID', async () => {
        const adminRequest = {
          ...mockAuthenticatedRequest,
          user: { ...mockAuthenticatedRequest.user, role: 'ADMIN' },
          params: {} // missing id
        };

        await deleteSchedule(adminRequest as unknown as AuthenticatedRequest, mockResponse as Response);

        expect(mockResponse.status).toHaveBeenCalledWith(400);
        expect(mockResponse.json).toHaveBeenCalledWith({
          success: false,
          message: 'Schedule ID is required'
        });
      });

      it('should handle service errors when checking schedule existence', async () => {
        (ScheduleService.getScheduleById as jest.Mock).mockRejectedValue(new AppError('Database error', 500));

        const adminRequest = {
          ...mockAuthenticatedRequest,
          user: { ...mockAuthenticatedRequest.user, role: 'ADMIN' },
          params: { id: '507f1f77bcf86cd799439015' }
        };

        await deleteSchedule(adminRequest as unknown as AuthenticatedRequest, mockResponse as Response);

        expect(mockResponse.status).toHaveBeenCalledWith(500);
        expect(mockResponse.json).toHaveBeenCalledWith({
          success: false,
          message: 'Database error'
        });
      });

      it('should handle service errors when deleting schedule', async () => {
        (ScheduleService.getScheduleById as jest.Mock).mockResolvedValue({ _id: '507f1f77bcf86cd799439015' });
        (ScheduleService.deleteSchedule as jest.Mock).mockRejectedValue(new AppError('Database error', 500));

        const adminRequest = {
          ...mockAuthenticatedRequest,
          user: { ...mockAuthenticatedRequest.user, role: 'ADMIN' },
          params: { id: '507f1f77bcf86cd799439015' }
        };

        await deleteSchedule(adminRequest as unknown as AuthenticatedRequest, mockResponse as Response);

        expect(mockResponse.status).toHaveBeenCalledWith(500);
        expect(mockResponse.json).toHaveBeenCalledWith({
          success: false,
          message: 'Database error'
        });
      });

      it('should handle unexpected errors', async () => {
        (ScheduleService.getScheduleById as jest.Mock).mockRejectedValue(new Error('Unexpected error'));

        const adminRequest = {
          ...mockAuthenticatedRequest,
          user: { ...mockAuthenticatedRequest.user, role: 'ADMIN' },
          params: { id: '507f1f77bcf86cd799439015' }
        };

        await deleteSchedule(adminRequest as unknown as AuthenticatedRequest, mockResponse as Response);

        expect(mockResponse.status).toHaveBeenCalledWith(500);
        expect(mockResponse.json).toHaveBeenCalledWith({
          success: false,
          message: 'Internal server error'
        });
      });
    });
  });

  describe('AdminController', () => {
    let adminRequest: TestAdminRequest;

    beforeEach(() => {
      adminRequest = {
        ...mockAuthenticatedRequest,
        user: { ...mockAuthenticatedRequest.user, role: 'ADMIN' }
      } as TestAdminRequest;
    });

    describe('getAllUsers', () => {
      it('should get all users successfully', async () => {
        const mockResult = {
          users: [{ _id: '1', email: 'user1@example.com' }, { _id: '2', email: 'user2@example.com' }],
          pagination: { page: 1, limit: 10, total: 2, pages: 1 }
        };
        (AdminService.getAllUsers as jest.Mock).mockResolvedValue(mockResult);

        adminRequest.query = { page: '1', limit: '10' };

        await getAllUsers(adminRequest as unknown as AuthenticatedRequest, mockResponse as Response);

        expect(mockResponse.status).toHaveBeenCalledWith(200);
        expect(mockResponse.json).toHaveBeenCalledWith({
          success: true,
          data: mockResult.users,
          pagination: mockResult.pagination
        });
      });

      it('should handle service errors', async () => {
        (AdminService.getAllUsers as jest.Mock).mockRejectedValue(new AppError('Database error', 500));

        await getAllUsers(adminRequest as unknown as AuthenticatedRequest, mockResponse as Response);

        expect(mockResponse.status).toHaveBeenCalledWith(500);
        expect(mockResponse.json).toHaveBeenCalledWith({
          success: false,
          message: 'Database error'
        });
      });

      it('should handle unexpected errors', async () => {
        (AdminService.getAllUsers as jest.Mock).mockRejectedValue(new Error('Unexpected error'));

        await getAllUsers(adminRequest as unknown as AuthenticatedRequest, mockResponse as Response);

        expect(mockResponse.status).toHaveBeenCalledWith(500);
        expect(mockResponse.json).toHaveBeenCalledWith({
          success: false,
          message: 'Internal server error'
        });
      });
    });

    describe('updateUserRole', () => {
      it('should update user role successfully', async () => {
        const mockUser = { _id: '507f1f77bcf86cd799439012', email: 'test@example.com', role: 'VALET' };
        (AdminService.updateUserRole as jest.Mock).mockResolvedValue(mockUser);

        adminRequest.params = { id: '507f1f77bcf86cd799439012' };
        adminRequest.body = { role: 'VALET' };

        await updateUserRole(adminRequest as unknown as AuthenticatedRequest, mockResponse as Response);

        expect(mockResponse.status).toHaveBeenCalledWith(200);
        expect(mockResponse.json).toHaveBeenCalledWith({
          success: true,
          data: mockUser
        });
      });

      it('should return 400 for missing user ID', async () => {
        adminRequest.params = {};
        adminRequest.body = { role: 'VALET' };

        await updateUserRole(adminRequest as unknown as AuthenticatedRequest, mockResponse as Response);

        expect(mockResponse.status).toHaveBeenCalledWith(400);
        expect(mockResponse.json).toHaveBeenCalledWith({
          success: false,
          message: 'User ID is required'
        });
      });

      it('should return 400 for invalid role', async () => {
        adminRequest.params = { id: '507f1f77bcf86cd799439012' };
        adminRequest.body = { role: 'INVALID_ROLE' };

        await updateUserRole(adminRequest as unknown as AuthenticatedRequest, mockResponse as Response);

        expect(mockResponse.status).toHaveBeenCalledWith(400);
        expect(mockResponse.json).toHaveBeenCalledWith({
          success: false,
          message: 'Invalid role'
        });
      });

      it('should handle service errors', async () => {
        (AdminService.updateUserRole as jest.Mock).mockRejectedValue(new AppError('User not found', 404));

        adminRequest.params = { id: '507f1f77bcf86cd799439012' };
        adminRequest.body = { role: 'VALET' };

        await updateUserRole(adminRequest as unknown as AuthenticatedRequest, mockResponse as Response);

        expect(mockResponse.status).toHaveBeenCalledWith(404);
        expect(mockResponse.json).toHaveBeenCalledWith({
          success: false,
          message: 'User not found'
        });
      });

      it('should handle unexpected errors', async () => {
        (AdminService.updateUserRole as jest.Mock).mockRejectedValue(new Error('Unexpected error'));

        adminRequest.params = { id: '507f1f77bcf86cd799439012' };
        adminRequest.body = { role: 'VALET' };

        await updateUserRole(adminRequest as unknown as AuthenticatedRequest, mockResponse as Response);

        expect(mockResponse.status).toHaveBeenCalledWith(500);
        expect(mockResponse.json).toHaveBeenCalledWith({
          success: false,
          message: 'Internal server error'
        });
      });
    });

    describe('deleteUser', () => {
      it('should delete user successfully', async () => {
        (AdminService.deleteUser as jest.Mock).mockResolvedValue(true);

        adminRequest.params = { id: '507f1f77bcf86cd799439012' };
        adminRequest.user = { ...adminRequest.user, userId: '507f1f77bcf86cd799439013' }; // Different user

        await deleteUser(adminRequest as unknown as AuthenticatedRequest, mockResponse as Response);

        expect(mockResponse.status).toHaveBeenCalledWith(200);
        expect(mockResponse.json).toHaveBeenCalledWith({
          success: true,
          message: 'User deleted successfully'
        });
      });

      it('should return 400 for missing user ID', async () => {
        adminRequest.params = {};

        await deleteUser(adminRequest as unknown as AuthenticatedRequest, mockResponse as Response);

        expect(mockResponse.status).toHaveBeenCalledWith(400);
        expect(mockResponse.json).toHaveBeenCalledWith({
          success: false,
          message: 'User ID is required'
        });
      });

      it('should return 400 when trying to delete own account', async () => {
        adminRequest.params = { id: '507f1f77bcf86cd799439012' };
        adminRequest.user = { ...adminRequest.user, userId: '507f1f77bcf86cd799439012' }; // Same user

        await deleteUser(adminRequest as unknown as AuthenticatedRequest, mockResponse as Response);

        expect(mockResponse.status).toHaveBeenCalledWith(400);
        expect(mockResponse.json).toHaveBeenCalledWith({
          success: false,
          message: 'Cannot delete your own account'
        });
      });

      it('should handle service errors', async () => {
        (AdminService.deleteUser as jest.Mock).mockRejectedValue(new AppError('User not found', 404));

        adminRequest.params = { id: '507f1f77bcf86cd799439012' };
        adminRequest.user = { ...adminRequest.user, userId: '507f1f77bcf86cd799439013' };

        await deleteUser(adminRequest as unknown as AuthenticatedRequest, mockResponse as Response);

        expect(mockResponse.status).toHaveBeenCalledWith(404);
        expect(mockResponse.json).toHaveBeenCalledWith({
          success: false,
          message: 'User not found'
        });
      });

      it('should handle unexpected errors', async () => {
        (AdminService.deleteUser as jest.Mock).mockRejectedValue(new Error('Unexpected error'));

        adminRequest.params = { id: '507f1f77bcf86cd799439012' };
        adminRequest.user = { ...adminRequest.user, userId: '507f1f77bcf86cd799439013' };

        await deleteUser(adminRequest as unknown as AuthenticatedRequest, mockResponse as Response);

        expect(mockResponse.status).toHaveBeenCalledWith(500);
        expect(mockResponse.json).toHaveBeenCalledWith({
          success: false,
          message: 'Internal server error'
        });
      });
    });

    describe('getAllValets', () => {
      it('should get all valets successfully', async () => {
        const mockValets = [
          { _id: '1', email: 'valet1@example.com', role: 'VALET' },
          { _id: '2', email: 'valet2@example.com', role: 'VALET' }
        ];
        (AdminService.getAllValets as jest.Mock).mockResolvedValue(mockValets);

        await getAllValets(adminRequest as unknown as AuthenticatedRequest, mockResponse as Response);

        expect(mockResponse.status).toHaveBeenCalledWith(200);
        expect(mockResponse.json).toHaveBeenCalledWith({
          success: true,
          data: mockValets
        });
      });

      it('should handle service errors', async () => {
        (AdminService.getAllValets as jest.Mock).mockRejectedValue(new AppError('Database error', 500));

        await getAllValets(adminRequest as unknown as AuthenticatedRequest, mockResponse as Response);

        expect(mockResponse.status).toHaveBeenCalledWith(500);
        expect(mockResponse.json).toHaveBeenCalledWith({
          success: false,
          message: 'Database error'
        });
      });

      it('should handle unexpected errors', async () => {
        (AdminService.getAllValets as jest.Mock).mockRejectedValue(new Error('Unexpected error'));

        await getAllValets(adminRequest as unknown as AuthenticatedRequest, mockResponse as Response);

        expect(mockResponse.status).toHaveBeenCalledWith(500);
        expect(mockResponse.json).toHaveBeenCalledWith({
          success: false,
          message: 'Internal server error'
        });
      });
    });

    describe('createValet', () => {
      it('should create valet successfully', async () => {
        const mockValet = { _id: '507f1f77bcf86cd799439012', email: 'valet@example.com', role: 'VALET' };
        (AdminService.createValet as jest.Mock).mockResolvedValue(mockValet);

        adminRequest.body = {
          email: 'valet@example.com',
          password: 'password123',
          profile: { name: 'Valet User' }
        };

        await createValet(adminRequest as unknown as AuthenticatedRequest, mockResponse as Response);

        expect(mockResponse.status).toHaveBeenCalledWith(201);
        expect(mockResponse.json).toHaveBeenCalledWith({
          success: true,
          data: mockValet
        });
      });

      it('should handle service errors', async () => {
        (AdminService.createValet as jest.Mock).mockRejectedValue(new AppError('Email already exists', 409));

        adminRequest.body = {
          email: 'valet@example.com',
          password: 'password123',
          profile: { name: 'Valet User' }
        };

        await createValet(adminRequest as unknown as AuthenticatedRequest, mockResponse as Response);

        expect(mockResponse.status).toHaveBeenCalledWith(409);
        expect(mockResponse.json).toHaveBeenCalledWith({
          success: false,
          message: 'Email already exists'
        });
      });

      it('should handle unexpected errors', async () => {
        (AdminService.createValet as jest.Mock).mockRejectedValue(new Error('Unexpected error'));

        adminRequest.body = {
          email: 'valet@example.com',
          password: 'password123',
          profile: { name: 'Valet User' }
        };

        await createValet(adminRequest as unknown as AuthenticatedRequest, mockResponse as Response);

        expect(mockResponse.status).toHaveBeenCalledWith(500);
        expect(mockResponse.json).toHaveBeenCalledWith({
          success: false,
          message: 'Internal server error'
        });
      });
    });

    describe('updateValet', () => {
      it('should update valet successfully', async () => {
        const mockValet = { _id: '507f1f77bcf86cd799439012', email: 'valet@example.com', role: 'VALET' };
        (AdminService.updateValet as jest.Mock).mockResolvedValue(mockValet);

        adminRequest.params = { id: '507f1f77bcf86cd799439012' };
        adminRequest.body = { profile: { name: 'Updated Valet' } };

        await updateValet(adminRequest as unknown as AuthenticatedRequest, mockResponse as Response);

        expect(mockResponse.status).toHaveBeenCalledWith(200);
        expect(mockResponse.json).toHaveBeenCalledWith({
          success: true,
          data: mockValet
        });
      });

      it('should return 400 for missing valet ID', async () => {
        adminRequest.params = {};
        adminRequest.body = { profile: { name: 'Updated Valet' } };

        await updateValet(adminRequest as unknown as AuthenticatedRequest, mockResponse as Response);

        expect(mockResponse.status).toHaveBeenCalledWith(400);
        expect(mockResponse.json).toHaveBeenCalledWith({
          success: false,
          message: 'Valet ID is required'
        });
      });

      it('should handle service errors', async () => {
        (AdminService.updateValet as jest.Mock).mockRejectedValue(new AppError('Valet not found', 404));

        adminRequest.params = { id: '507f1f77bcf86cd799439012' };
        adminRequest.body = { profile: { name: 'Updated Valet' } };

        await updateValet(adminRequest as unknown as AuthenticatedRequest, mockResponse as Response);

        expect(mockResponse.status).toHaveBeenCalledWith(404);
        expect(mockResponse.json).toHaveBeenCalledWith({
          success: false,
          message: 'Valet not found'
        });
      });

      it('should handle unexpected errors', async () => {
        (AdminService.updateValet as jest.Mock).mockRejectedValue(new Error('Unexpected error'));

        adminRequest.params = { id: '507f1f77bcf86cd799439012' };
        adminRequest.body = { profile: { name: 'Updated Valet' } };

        await updateValet(adminRequest as unknown as AuthenticatedRequest, mockResponse as Response);

        expect(mockResponse.status).toHaveBeenCalledWith(500);
        expect(mockResponse.json).toHaveBeenCalledWith({
          success: false,
          message: 'Internal server error'
        });
      });
    });

    describe('deleteValet', () => {
      it('should delete valet successfully', async () => {
        (AdminService.deleteValet as jest.Mock).mockResolvedValue(true);

        adminRequest.params = { id: '507f1f77bcf86cd799439012' };

        await deleteValet(adminRequest as unknown as AuthenticatedRequest, mockResponse as Response);

        expect(mockResponse.status).toHaveBeenCalledWith(200);
        expect(mockResponse.json).toHaveBeenCalledWith({
          success: true,
          message: 'Valet deleted successfully'
        });
      });

      it('should return 400 for missing valet ID', async () => {
        adminRequest.params = {};

        await deleteValet(adminRequest as unknown as AuthenticatedRequest, mockResponse as Response);

        expect(mockResponse.status).toHaveBeenCalledWith(400);
        expect(mockResponse.json).toHaveBeenCalledWith({
          success: false,
          message: 'Valet ID is required'
        });
      });

      it('should handle service errors', async () => {
        (AdminService.deleteValet as jest.Mock).mockRejectedValue(new AppError('Valet not found', 404));

        adminRequest.params = { id: '507f1f77bcf86cd799439012' };

        await deleteValet(adminRequest as unknown as AuthenticatedRequest, mockResponse as Response);

        expect(mockResponse.status).toHaveBeenCalledWith(404);
        expect(mockResponse.json).toHaveBeenCalledWith({
          success: false,
          message: 'Valet not found'
        });
      });

      it('should handle unexpected errors', async () => {
        (AdminService.deleteValet as jest.Mock).mockRejectedValue(new Error('Unexpected error'));

        adminRequest.params = { id: '507f1f77bcf86cd799439012' };

        await deleteValet(adminRequest as unknown as AuthenticatedRequest, mockResponse as Response);

        expect(mockResponse.status).toHaveBeenCalledWith(500);
        expect(mockResponse.json).toHaveBeenCalledWith({
          success: false,
          message: 'Internal server error'
        });
      });
    });

    describe('createAdminLocation', () => {
      it('should create location successfully', async () => {
        const mockLocation = {
          _id: '507f1f77bcf86cd799439011',
          name: 'Test Location',
          address: '123 Test St'
        };
        (AdminService.createLocation as jest.Mock).mockResolvedValue(mockLocation);

        adminRequest.body = {
          name: 'Test Location',
          address: '123 Test St',
          coordinates: { latitude: 40.7128, longitude: -74.0060 }
        };

        await createAdminLocation(adminRequest as unknown as AuthenticatedRequest, mockResponse as Response);

        expect(mockResponse.status).toHaveBeenCalledWith(201);
        expect(mockResponse.json).toHaveBeenCalledWith({
          success: true,
          data: mockLocation
        });
      });

      it('should handle service errors', async () => {
        (AdminService.createLocation as jest.Mock).mockRejectedValue(new AppError('Invalid coordinates', 400));

        adminRequest.body = {
          name: 'Test Location',
          address: '123 Test St',
          coordinates: { latitude: 40.7128, longitude: -74.0060 }
        };

        await createAdminLocation(adminRequest as unknown as AuthenticatedRequest, mockResponse as Response);

        expect(mockResponse.status).toHaveBeenCalledWith(400);
        expect(mockResponse.json).toHaveBeenCalledWith({
          success: false,
          message: 'Invalid coordinates'
        });
      });

      it('should handle unexpected errors', async () => {
        (AdminService.createLocation as jest.Mock).mockRejectedValue(new Error('Unexpected error'));

        adminRequest.body = {
          name: 'Test Location',
          address: '123 Test St',
          coordinates: { latitude: 40.7128, longitude: -74.0060 }
        };

        await createAdminLocation(adminRequest as unknown as AuthenticatedRequest, mockResponse as Response);

        expect(mockResponse.status).toHaveBeenCalledWith(500);
        expect(mockResponse.json).toHaveBeenCalledWith({
          success: false,
          message: 'Internal server error'
        });
      });
    });

    describe('getAllSchedules', () => {
      it('should get all schedules successfully', async () => {
        const mockSchedules = [
          { _id: '1', locationId: 'loc1', dayOfWeek: 1, startTime: '09:00', endTime: '17:00' },
          { _id: '2', locationId: 'loc2', dayOfWeek: 2, startTime: '10:00', endTime: '18:00' }
        ];
        (AdminService.getAllSchedules as jest.Mock).mockResolvedValue(mockSchedules);

        await getAllSchedules(adminRequest as unknown as AuthenticatedRequest, mockResponse as Response);

        expect(mockResponse.status).toHaveBeenCalledWith(200);
        expect(mockResponse.json).toHaveBeenCalledWith({
          success: true,
          data: mockSchedules
        });
      });

      it('should handle service errors', async () => {
        (AdminService.getAllSchedules as jest.Mock).mockRejectedValue(new AppError('Database error', 500));

        await getAllSchedules(adminRequest as unknown as AuthenticatedRequest, mockResponse as Response);

        expect(mockResponse.status).toHaveBeenCalledWith(500);
        expect(mockResponse.json).toHaveBeenCalledWith({
          success: false,
          message: 'Database error'
        });
      });

      it('should handle unexpected errors', async () => {
        (AdminService.getAllSchedules as jest.Mock).mockRejectedValue(new Error('Unexpected error'));

        await getAllSchedules(adminRequest as unknown as AuthenticatedRequest, mockResponse as Response);

        expect(mockResponse.status).toHaveBeenCalledWith(500);
        expect(mockResponse.json).toHaveBeenCalledWith({
          success: false,
          message: 'Internal server error'
        });
      });
    });

    describe('createBulkSchedules', () => {
      it('should create bulk schedules successfully', async () => {
        const mockResult = {
          successful: [
            { _id: '1', locationId: 'loc1', dayOfWeek: 1 },
            { _id: '2', locationId: 'loc1', dayOfWeek: 2 }
          ],
          failed: []
        };
        (AdminService.createBulkSchedules as jest.Mock).mockResolvedValue(mockResult);

        adminRequest.body = {
          locationId: 'loc1',
          schedules: [
            { dayOfWeek: 1, startTime: '09:00', endTime: '17:00' },
            { dayOfWeek: 2, startTime: '09:00', endTime: '17:00' }
          ]
        };

        await createBulkSchedules(adminRequest as unknown as AuthenticatedRequest, mockResponse as Response);

        expect(mockResponse.status).toHaveBeenCalledWith(201);
        expect(mockResponse.json).toHaveBeenCalledWith({
          success: true,
          data: mockResult.successful
        });
      });

      it('should return 207 for partial success', async () => {
        const mockResult = {
          successful: [
            { _id: '1', locationId: 'loc1', dayOfWeek: 1 }
          ],
          failed: [
            { dayOfWeek: 2, error: 'Duplicate schedule' }
          ]
        };
        (AdminService.createBulkSchedules as jest.Mock).mockResolvedValue(mockResult);

        adminRequest.body = {
          locationId: 'loc1',
          schedules: [
            { dayOfWeek: 1, startTime: '09:00', endTime: '17:00' },
            { dayOfWeek: 2, startTime: '09:00', endTime: '17:00' }
          ]
        };

        await createBulkSchedules(adminRequest, mockResponse as Response);

        expect(mockResponse.status).toHaveBeenCalledWith(207);
        expect(mockResponse.json).toHaveBeenCalledWith({
          success: true,
          data: mockResult
        });
      });

      it('should handle service errors', async () => {
        (AdminService.createBulkSchedules as jest.Mock).mockRejectedValue(new AppError('Invalid schedule data', 400));

        adminRequest.body = {
          locationId: 'loc1',
          schedules: [
            { dayOfWeek: 1, startTime: '09:00', endTime: '17:00' }
          ]
        };

        await createBulkSchedules(adminRequest, mockResponse as Response);

        expect(mockResponse.status).toHaveBeenCalledWith(400);
        expect(mockResponse.json).toHaveBeenCalledWith({
          success: false,
          message: 'Invalid schedule data'
        });
      });

      it('should handle unexpected errors', async () => {
        (AdminService.createBulkSchedules as jest.Mock).mockRejectedValue(new Error('Unexpected error'));

        adminRequest.body = {
          locationId: 'loc1',
          schedules: [
            { dayOfWeek: 1, startTime: '09:00', endTime: '17:00' }
          ]
        };

        await createBulkSchedules(adminRequest, mockResponse as Response);

        expect(mockResponse.status).toHaveBeenCalledWith(500);
        expect(mockResponse.json).toHaveBeenCalledWith({
          success: false,
          message: 'Internal server error'
        });
      });
    });

    describe('getAllBookings', () => {
      it('should get all bookings successfully', async () => {
        const mockBookings = [
          { _id: '1', userId: 'user1', locationId: 'loc1', status: 'PENDING' },
          { _id: '2', userId: 'user2', locationId: 'loc2', status: 'CONFIRMED' }
        ];
        (AdminService.getAllBookings as jest.Mock).mockResolvedValue(mockBookings);

        adminRequest.query = { status: 'PENDING' };

        await getAllBookings(adminRequest, mockResponse as Response);

        expect(mockResponse.status).toHaveBeenCalledWith(200);
        expect(mockResponse.json).toHaveBeenCalledWith({
          success: true,
          data: mockBookings
        });
      });

      it('should handle service errors', async () => {
        (AdminService.getAllBookings as jest.Mock).mockRejectedValue(new AppError('Database error', 500));

        adminRequest.query = { status: 'PENDING' };

        await getAllBookings(adminRequest, mockResponse as Response);

        expect(mockResponse.status).toHaveBeenCalledWith(500);
        expect(mockResponse.json).toHaveBeenCalledWith({
          success: false,
          message: 'Database error'
        });
      });

      it('should handle unexpected errors', async () => {
        (AdminService.getAllBookings as jest.Mock).mockRejectedValue(new Error('Unexpected error'));

        adminRequest.query = { status: 'PENDING' };

        await getAllBookings(adminRequest, mockResponse as Response);

        expect(mockResponse.status).toHaveBeenCalledWith(500);
        expect(mockResponse.json).toHaveBeenCalledWith({
          success: false,
          message: 'Internal server error'
        });
      });
    });

    describe('getAnalyticsOverview', () => {
      it('should get analytics overview successfully', async () => {
        const mockAnalytics = {
          totalUsers: 100,
          totalBookings: 50,
          totalRevenue: 1000,
          averageBookingValue: 20
        };
        (AdminService.getAnalyticsOverview as jest.Mock).mockResolvedValue(mockAnalytics);

        await getAnalyticsOverview(adminRequest, mockResponse as Response);

        expect(mockResponse.status).toHaveBeenCalledWith(200);
        expect(mockResponse.json).toHaveBeenCalledWith({
          success: true,
          data: mockAnalytics
        });
      });

      it('should handle service errors', async () => {
        (AdminService.getAnalyticsOverview as jest.Mock).mockRejectedValue(new AppError('Database error', 500));

        await getAnalyticsOverview(adminRequest, mockResponse as Response);

        expect(mockResponse.status).toHaveBeenCalledWith(500);
        expect(mockResponse.json).toHaveBeenCalledWith({
          success: false,
          message: 'Database error'
        });
      });

      it('should handle unexpected errors', async () => {
        (AdminService.getAnalyticsOverview as jest.Mock).mockRejectedValue(new Error('Unexpected error'));

        await getAnalyticsOverview(adminRequest, mockResponse as Response);

        expect(mockResponse.status).toHaveBeenCalledWith(500);
        expect(mockResponse.json).toHaveBeenCalledWith({
          success: false,
          message: 'Internal server error'
        });
      });
    });

    describe('getRevenueAnalytics', () => {
      it('should get revenue analytics successfully', async () => {
        const mockAnalytics = {
          totalRevenue: 1000,
          dailyRevenue: [{ date: '2023-01-01', revenue: 100 }],
          monthlyRevenue: [{ month: '2023-01', revenue: 3000 }]
        };
        (AdminService.getRevenueAnalytics as jest.Mock).mockResolvedValue(mockAnalytics);

        adminRequest.query = { startDate: '2023-01-01', endDate: '2023-01-31' };

        await getRevenueAnalytics(adminRequest, mockResponse as Response);

        expect(mockResponse.status).toHaveBeenCalledWith(200);
        expect(mockResponse.json).toHaveBeenCalledWith({
          success: true,
          data: mockAnalytics
        });
      });

      it('should handle service errors', async () => {
        (AdminService.getRevenueAnalytics as jest.Mock).mockRejectedValue(new AppError('Database error', 500));

        adminRequest.query = { startDate: '2023-01-01', endDate: '2023-01-31' };

        await getRevenueAnalytics(adminRequest, mockResponse as Response);

        expect(mockResponse.status).toHaveBeenCalledWith(500);
        expect(mockResponse.json).toHaveBeenCalledWith({
          success: false,
          message: 'Database error'
        });
      });

      it('should handle unexpected errors', async () => {
        (AdminService.getRevenueAnalytics as jest.Mock).mockRejectedValue(new Error('Unexpected error'));

        adminRequest.query = { startDate: '2023-01-01', endDate: '2023-01-31' };

        await getRevenueAnalytics(adminRequest, mockResponse as Response);

        expect(mockResponse.status).toHaveBeenCalledWith(500);
        expect(mockResponse.json).toHaveBeenCalledWith({
          success: false,
          message: 'Internal server error'
        });
      });
    });

    describe('getBookingAnalytics', () => {
      it('should get booking analytics successfully', async () => {
        const mockAnalytics = {
          totalBookings: 50,
          bookingsByStatus: { PENDING: 10, CONFIRMED: 30, COMPLETED: 10 },
          bookingsByLocation: [{ locationId: 'loc1', count: 25 }, { locationId: 'loc2', count: 25 }]
        };
        (AdminService.getBookingAnalytics as jest.Mock).mockResolvedValue(mockAnalytics);

        await getBookingAnalytics(adminRequest, mockResponse as Response);

        expect(mockResponse.status).toHaveBeenCalledWith(200);
        expect(mockResponse.json).toHaveBeenCalledWith({
          success: true,
          data: mockAnalytics
        });
      });

      it('should handle service errors', async () => {
        (AdminService.getBookingAnalytics as jest.Mock).mockRejectedValue(new AppError('Database error', 500));

        await getBookingAnalytics(adminRequest, mockResponse as Response);

        expect(mockResponse.status).toHaveBeenCalledWith(500);
        expect(mockResponse.json).toHaveBeenCalledWith({
          success: false,
          message: 'Database error'
        });
      });

      it('should handle unexpected errors', async () => {
        (AdminService.getBookingAnalytics as jest.Mock).mockRejectedValue(new Error('Unexpected error'));

        await getBookingAnalytics(adminRequest, mockResponse as Response);

        expect(mockResponse.status).toHaveBeenCalledWith(500);
        expect(mockResponse.json).toHaveBeenCalledWith({
          success: false,
          message: 'Internal server error'
        });
      });
    });

    describe('updateAdminSchedule', () => {
      it('should update schedule successfully', async () => {
        const mockUpdatedSchedule = {
          _id: '1',
          locationId: 'loc1',
          dayOfWeek: 1,
          startTime: '08:00',
          endTime: '19:00'
        };
        (AdminService.updateSchedule as jest.Mock).mockResolvedValue(mockUpdatedSchedule);

        adminRequest.params = { id: '1' };
        adminRequest.body = { startTime: '08:00', endTime: '19:00' };

        await updateAdminSchedule(adminRequest, mockResponse as Response);

        expect(mockResponse.status).toHaveBeenCalledWith(200);
        expect(mockResponse.json).toHaveBeenCalledWith({
          success: true,
          data: mockUpdatedSchedule
        });
      });

      it('should return 400 for missing schedule ID', async () => {
        adminRequest.params = {};
        adminRequest.body = { startTime: '08:00' };

        await updateAdminSchedule(adminRequest, mockResponse as Response);

        expect(mockResponse.status).toHaveBeenCalledWith(400);
        expect(mockResponse.json).toHaveBeenCalledWith({
          success: false,
          message: 'Schedule ID is required'
        });
      });

      it('should handle service errors', async () => {
        (AdminService.updateSchedule as jest.Mock).mockRejectedValue(new AppError('Schedule not found', 404));

        adminRequest.params = { id: '1' };
        adminRequest.body = { startTime: '08:00' };

        await updateAdminSchedule(adminRequest, mockResponse as Response);

        expect(mockResponse.status).toHaveBeenCalledWith(404);
        expect(mockResponse.json).toHaveBeenCalledWith({
          success: false,
          message: 'Schedule not found'
        });
      });

      it('should handle unexpected errors', async () => {
        (AdminService.updateSchedule as jest.Mock).mockRejectedValue(new Error('Unexpected error'));

        adminRequest.params = { id: '1' };
        adminRequest.body = { startTime: '08:00' };

        await updateAdminSchedule(adminRequest, mockResponse as Response);

        expect(mockResponse.status).toHaveBeenCalledWith(500);
        expect(mockResponse.json).toHaveBeenCalledWith({
          success: false,
          message: 'Internal server error'
        });
      });
    });

    describe('deleteAdminSchedule', () => {
      it('should delete schedule successfully', async () => {
        (AdminService.deleteSchedule as jest.Mock).mockResolvedValue(true);

        adminRequest.params = { id: '1' };

        await deleteAdminSchedule(adminRequest, mockResponse as Response);

        expect(mockResponse.status).toHaveBeenCalledWith(200);
        expect(mockResponse.json).toHaveBeenCalledWith({
          success: true,
          message: 'Schedule deleted successfully'
        });
      });

      it('should return 400 for missing schedule ID', async () => {
        adminRequest.params = {};

        await deleteAdminSchedule(adminRequest, mockResponse as Response);

        expect(mockResponse.status).toHaveBeenCalledWith(400);
        expect(mockResponse.json).toHaveBeenCalledWith({
          success: false,
          message: 'Schedule ID is required'
        });
      });

      it('should handle service errors', async () => {
        (AdminService.deleteSchedule as jest.Mock).mockRejectedValue(new AppError('Schedule not found', 404));

        adminRequest.params = { id: '1' };

        await deleteAdminSchedule(adminRequest, mockResponse as Response);

        expect(mockResponse.status).toHaveBeenCalledWith(404);
        expect(mockResponse.json).toHaveBeenCalledWith({
          success: false,
          message: 'Schedule not found'
        });
      });

      it('should handle unexpected errors', async () => {
        (AdminService.deleteSchedule as jest.Mock).mockRejectedValue(new Error('Unexpected error'));

        adminRequest.params = { id: '1' };

        await deleteAdminSchedule(adminRequest, mockResponse as Response);

        expect(mockResponse.status).toHaveBeenCalledWith(500);
        expect(mockResponse.json).toHaveBeenCalledWith({
          success: false,
          message: 'Internal server error'
        });
      });
    });

    describe('updateAdminBookingStatus', () => {
      it('should update booking status successfully', async () => {
        const mockUpdatedBooking = { _id: '1', userId: 'user1', status: 'CONFIRMED' };
        (AdminService.updateBookingStatus as jest.Mock).mockResolvedValue(mockUpdatedBooking);

        adminRequest.params = { id: '1' };
        adminRequest.body = { status: 'CONFIRMED' };

        await updateAdminBookingStatus(adminRequest, mockResponse as Response);

        expect(mockResponse.status).toHaveBeenCalledWith(200);
        expect(mockResponse.json).toHaveBeenCalledWith({
          success: true,
          data: mockUpdatedBooking
        });
      });

      it('should return 400 for missing booking ID', async () => {
        adminRequest.params = {};
        adminRequest.body = { status: 'CONFIRMED' };

        await updateAdminBookingStatus(adminRequest, mockResponse as Response);

        expect(mockResponse.status).toHaveBeenCalledWith(400);
        expect(mockResponse.json).toHaveBeenCalledWith({
          success: false,
          message: 'Booking ID is required'
        });
      });

      it('should handle service errors', async () => {
        (AdminService.updateBookingStatus as jest.Mock).mockRejectedValue(new AppError('Booking not found', 404));

        adminRequest.params = { id: '1' };
        adminRequest.body = { status: 'CONFIRMED' };

        await updateAdminBookingStatus(adminRequest, mockResponse as Response);

        expect(mockResponse.status).toHaveBeenCalledWith(404);
        expect(mockResponse.json).toHaveBeenCalledWith({
          success: false,
          message: 'Booking not found'
        });
      });

      it('should handle unexpected errors', async () => {
        (AdminService.updateBookingStatus as jest.Mock).mockRejectedValue(new Error('Unexpected error'));

        adminRequest.params = { id: '1' };
        adminRequest.body = { status: 'CONFIRMED' };

        await updateAdminBookingStatus(adminRequest, mockResponse as Response);

        expect(mockResponse.status).toHaveBeenCalledWith(500);
        expect(mockResponse.json).toHaveBeenCalledWith({
          success: false,
          message: 'Internal server error'
        });
      });
    });
  });
}); 