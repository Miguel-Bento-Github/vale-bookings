import { Request, Response } from 'express';
import { register, login, refreshToken } from '../../src/controllers/AuthController';
import { getProfile, updateProfile, deleteAccount } from '../../src/controllers/UserController';
import { getLocations, getNearbyLocations, getLocationById, createLocation, updateLocation, deleteLocation } from '../../src/controllers/LocationController';
import { getUserBookings, getBookingById, createBooking, updateBookingStatus, cancelBooking } from '../../src/controllers/BookingController';
import { getLocationSchedules, createSchedule, updateSchedule, deleteSchedule } from '../../src/controllers/ScheduleController';
import * as AuthService from '../../src/services/AuthService';
import * as UserService from '../../src/services/UserService';
import * as LocationService from '../../src/services/LocationService';
import * as BookingService from '../../src/services/BookingService';
import * as ScheduleService from '../../src/services/ScheduleService';
import { AppError } from '../../src/types';

// Mock all services
jest.mock('../../src/services/AuthService');
jest.mock('../../src/services/UserService');
jest.mock('../../src/services/LocationService');
jest.mock('../../src/services/BookingService');
jest.mock('../../src/services/ScheduleService');

describe('Controllers', () => {
  let mockRequest: Partial<Request>;
  let mockResponse: Partial<Response>;
  let mockAuthenticatedRequest: any;

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
    };

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
        const unauthenticatedRequest = { ...mockRequest };

        await getProfile(unauthenticatedRequest as any, mockResponse as Response);

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

        await createLocation(adminRequest, mockResponse as Response);

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

        await createLocation(adminRequest, mockResponse as Response);

        expect(mockResponse.status).toHaveBeenCalledWith(400);
        expect(mockResponse.json).toHaveBeenCalledWith({
          success: false,
          message: 'Name, address, and coordinates are required'
        });
      });
    });

    describe('updateLocation', () => {
      it('should update location successfully for admin', async () => {
        const mockLocation = { _id: '507f1f77bcf86cd799439011', name: 'Original Location' };
        const mockUpdatedLocation = { _id: '507f1f77bcf86cd799439011', name: 'Updated Location' };
        
        (LocationService.updateLocation as jest.Mock).mockResolvedValue(mockUpdatedLocation);

        const adminRequest = {
          ...mockAuthenticatedRequest,
          user: { ...mockAuthenticatedRequest.user, role: 'ADMIN' },
          params: { id: '507f1f77bcf86cd799439011' },
          body: { name: 'Updated Location' }
        };

        await updateLocation(adminRequest, mockResponse as Response);

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

        await updateLocation(adminRequest, mockResponse as Response);

        expect(mockResponse.status).toHaveBeenCalledWith(404);
        expect(mockResponse.json).toHaveBeenCalledWith({
          success: false,
          message: 'Location not found'
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

        await deleteLocation(adminRequest, mockResponse as Response);

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

      it('should return 404 for non-existent location', async () => {
        (LocationService.getLocationById as jest.Mock).mockResolvedValue(null);

        const adminRequest = {
          ...mockAuthenticatedRequest,
          user: { ...mockAuthenticatedRequest.user, role: 'ADMIN' },
          params: { id: '507f1f77bcf86cd799439016' }
        };

        await deleteLocation(adminRequest, mockResponse as Response);

        expect(mockResponse.status).toHaveBeenCalledWith(404);
        expect(mockResponse.json).toHaveBeenCalledWith({
          success: false,
          message: 'Location not found'
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

        await getUserBookings(unauthenticatedRequest as any, mockResponse as Response);

        expect(mockResponse.status).toHaveBeenCalledWith(401);
        expect(mockResponse.json).toHaveBeenCalledWith({
          success: false,
          message: 'Unauthorized'
        });
      });
    });

    describe('getBookingById', () => {
      it('should get booking by id successfully', async () => {
        const mockBooking = { _id: '507f1f77bcf86cd799439013', userId: '507f1f77bcf86cd799439012', status: 'CONFIRMED' };
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
        const unauthenticatedRequest = { ...mockRequest, params: { id: '507f1f77bcf86cd799439013' } };

        await getBookingById(unauthenticatedRequest as any, mockResponse as Response);

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
        const mockBooking = { _id: '507f1f77bcf86cd799439013', userId: '507f1f77bcf86cd799439017', status: 'CONFIRMED' };
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
        const mockBooking = { _id: '507f1f77bcf86cd799439013', userId: '507f1f77bcf86cd799439017', status: 'CONFIRMED' };
        (BookingService.findById as jest.Mock).mockResolvedValue(mockBooking);

        const adminRequest = {
          ...mockAuthenticatedRequest,
          user: { ...mockAuthenticatedRequest.user, role: 'ADMIN' },
          params: { id: '507f1f77bcf86cd799439013' }
        };

        await getBookingById(adminRequest, mockResponse as Response);

        expect(mockResponse.status).toHaveBeenCalledWith(200);
        expect(mockResponse.json).toHaveBeenCalledWith({
          success: true,
          data: mockBooking
        });
      });
    });

    describe('createBooking', () => {
      it('should create booking successfully', async () => {
        const mockBooking = { _id: '507f1f77bcf86cd799439013', userId: '507f1f77bcf86cd799439012', status: 'PENDING' };
        (BookingService.createBooking as jest.Mock).mockResolvedValue(mockBooking);

        mockAuthenticatedRequest.body = {
          locationId: '507f1f77bcf86cd799439011',
          startTime: '2025-12-01T09:00:00Z',
          endTime: '2025-12-01T17:00:00Z',
          price: 50.00
        };

        await createBooking(mockAuthenticatedRequest, mockResponse as Response);

        expect(mockResponse.status).toHaveBeenCalledWith(201);
        expect(mockResponse.json).toHaveBeenCalledWith({
          success: true,
          message: 'Booking created successfully',
          data: mockBooking
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

        await createBooking(unauthenticatedRequest as any, mockResponse as Response);

        expect(mockResponse.status).toHaveBeenCalledWith(401);
        expect(mockResponse.json).toHaveBeenCalledWith({
          success: false,
          message: 'Unauthorized'
        });
      });
    });

    describe('updateBookingStatus', () => {
      it('should update booking status successfully', async () => {
        const mockBooking = { _id: '507f1f77bcf86cd799439013', userId: '507f1f77bcf86cd799439012', status: 'PENDING' };
        const mockUpdatedBooking = { _id: '507f1f77bcf86cd799439013', userId: '507f1f77bcf86cd799439012', status: 'CONFIRMED' };
        
        (BookingService.findById as jest.Mock).mockResolvedValue(mockBooking);
        (BookingService.updateBookingStatus as jest.Mock).mockResolvedValue(mockUpdatedBooking);

        const adminRequest = {
          ...mockAuthenticatedRequest,
          user: { ...mockAuthenticatedRequest.user, role: 'ADMIN' },
          params: { id: '507f1f77bcf86cd799439013' },
          body: { status: 'CONFIRMED' }
        };

        await updateBookingStatus(adminRequest, mockResponse as Response);

        expect(mockResponse.status).toHaveBeenCalledWith(200);
        expect(mockResponse.json).toHaveBeenCalledWith({
          success: true,
          message: 'Booking status updated successfully',
          data: mockUpdatedBooking
        });
      });

      it('should return 401 for unauthenticated request', async () => {
        const unauthenticatedRequest = { 
          ...mockRequest, 
          params: { id: '507f1f77bcf86cd799439013' },
          body: { status: 'CONFIRMED' }
        };

        await updateBookingStatus(unauthenticatedRequest as any, mockResponse as Response);

        expect(mockResponse.status).toHaveBeenCalledWith(401);
        expect(mockResponse.json).toHaveBeenCalledWith({
          success: false,
          message: 'Unauthorized'
        });
      });

      it('should return 400 for missing status', async () => {
        mockAuthenticatedRequest.params = { id: '507f1f77bcf86cd799439013' };
        mockAuthenticatedRequest.body = {};

        await updateBookingStatus(mockAuthenticatedRequest, mockResponse as Response);

        expect(mockResponse.status).toHaveBeenCalledWith(400);
        expect(mockResponse.json).toHaveBeenCalledWith({
          success: false,
          message: 'Status is required'
        });
      });

      it('should return 404 for non-existent booking', async () => {
        (BookingService.findById as jest.Mock).mockResolvedValue(null);

        const adminRequest = {
          ...mockAuthenticatedRequest,
          user: { ...mockAuthenticatedRequest.user, role: 'ADMIN' },
          params: { id: '507f1f77bcf86cd799439016' },
          body: { status: 'CONFIRMED' }
        };

        await updateBookingStatus(adminRequest, mockResponse as Response);

        expect(mockResponse.status).toHaveBeenCalledWith(404);
        expect(mockResponse.json).toHaveBeenCalledWith({
          success: false,
          message: 'Booking not found'
        });
      });

      it('should return 403 for booking not owned by user', async () => {
        const mockBooking = { _id: '507f1f77bcf86cd799439013', userId: '507f1f77bcf86cd799439017', status: 'PENDING' };
        (BookingService.findById as jest.Mock).mockResolvedValue(mockBooking);

        mockAuthenticatedRequest.params = { id: '507f1f77bcf86cd799439013' };
        mockAuthenticatedRequest.body = { status: 'CONFIRMED' };

        await updateBookingStatus(mockAuthenticatedRequest, mockResponse as Response);

        expect(mockResponse.status).toHaveBeenCalledWith(403);
        expect(mockResponse.json).toHaveBeenCalledWith({
          success: false,
          message: 'Forbidden: access denied'
        });
      });
    });

    describe('cancelBooking', () => {
      it('should cancel booking successfully', async () => {
        const mockBooking = { _id: '507f1f77bcf86cd799439013', userId: '507f1f77bcf86cd799439012', status: 'CONFIRMED' };
        const mockCancelledBooking = { _id: '507f1f77bcf86cd799439013', userId: '507f1f77bcf86cd799439012', status: 'CANCELLED' };
        
        (BookingService.findById as jest.Mock).mockResolvedValue(mockBooking);
        (BookingService.cancelBooking as jest.Mock).mockResolvedValue(mockCancelledBooking);

        mockAuthenticatedRequest.params = { id: '507f1f77bcf86cd799439013' };

        await cancelBooking(mockAuthenticatedRequest, mockResponse as Response);

        expect(mockResponse.status).toHaveBeenCalledWith(200);
        expect(mockResponse.json).toHaveBeenCalledWith({
          success: true,
          message: 'Booking cancelled successfully'
        });
      });

      it('should return 401 for unauthenticated request', async () => {
        const unauthenticatedRequest = { ...mockRequest, params: { id: '507f1f77bcf86cd799439013' } };

        await cancelBooking(unauthenticatedRequest as any, mockResponse as Response);

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
        const mockBooking = { _id: '507f1f77bcf86cd799439013', userId: '507f1f77bcf86cd799439017', status: 'CONFIRMED' };
        (BookingService.findById as jest.Mock).mockResolvedValue(mockBooking);

        mockAuthenticatedRequest.params = { id: '507f1f77bcf86cd799439013' };

        await cancelBooking(mockAuthenticatedRequest, mockResponse as Response);

        expect(mockResponse.status).toHaveBeenCalledWith(403);
        expect(mockResponse.json).toHaveBeenCalledWith({
          success: false,
          message: 'Forbidden: access denied'
        });
      });
    });
  });

  describe('ScheduleController', () => {

    describe('getLocationSchedules', () => {
      it('should get location schedules successfully', async () => {
        const mockLocation = { _id: '507f1f77bcf86cd799439011', name: 'Test Location' };
        const mockSchedules = [
          { _id: '507f1f77bcf86cd799439015', locationId: '507f1f77bcf86cd799439011', dayOfWeek: 1, startTime: '09:00', endTime: '18:00' }
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

        await createSchedule(adminRequest, mockResponse as Response);

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

        await createSchedule(adminRequest, mockResponse as Response);

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

        await createSchedule(adminRequest, mockResponse as Response);

        expect(mockResponse.status).toHaveBeenCalledWith(400);
        expect(mockResponse.json).toHaveBeenCalledWith({
          success: false,
          message: 'Time must be in HH:MM format'
        });
      });
    });

    describe('updateSchedule', () => {
      it('should update schedule successfully for admin', async () => {
        const mockSchedule = { _id: '507f1f77bcf86cd799439015', locationId: '507f1f77bcf86cd799439011', dayOfWeek: 1, startTime: '09:00', endTime: '18:00' };
        const mockUpdatedSchedule = { _id: '507f1f77bcf86cd799439015', locationId: '507f1f77bcf86cd799439011', dayOfWeek: 1, startTime: '08:00', endTime: '19:00' };
        
        (ScheduleService.updateSchedule as jest.Mock).mockResolvedValue(mockUpdatedSchedule);

        const adminRequest = {
          ...mockAuthenticatedRequest,
          user: { ...mockAuthenticatedRequest.user, role: 'ADMIN' },
          params: { id: '507f1f77bcf86cd799439015' },
          body: { startTime: '08:00', endTime: '19:00' }
        };

        await updateSchedule(adminRequest, mockResponse as Response);

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

        await updateSchedule(adminRequest, mockResponse as Response);

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

        await updateSchedule(adminRequest, mockResponse as Response);

        expect(mockResponse.status).toHaveBeenCalledWith(400);
        expect(mockResponse.json).toHaveBeenCalledWith({
          success: false,
          message: 'Start time must be in HH:MM format'
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

        await deleteSchedule(adminRequest, mockResponse as Response);

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

        await deleteSchedule(adminRequest, mockResponse as Response);

        expect(mockResponse.status).toHaveBeenCalledWith(404);
        expect(mockResponse.json).toHaveBeenCalledWith({
          success: false,
          message: 'Schedule not found'
        });
      });
    });
  });
}); 