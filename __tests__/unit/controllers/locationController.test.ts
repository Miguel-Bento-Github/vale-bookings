import { Request, Response } from 'express';
import mongoose from 'mongoose';

import * as LocationController from '../../../src/controllers/LocationController';
import * as LocationService from '../../../src/services/LocationService';
import { AppError, AuthenticatedRequest, ILocationDocument, UserRole } from '../../../src/types';
import * as validation from '../../../src/utils/validation';

jest.mock('../../../src/services/LocationService');
jest.mock('../../../src/utils/validation');

const mockLocationService = LocationService as jest.Mocked<typeof LocationService>;
const mockValidation = validation as jest.Mocked<typeof validation>;

describe('LocationController', () => {
  let mockReq: Partial<Request>;
  let mockAuthReq: Partial<AuthenticatedRequest>;
  let mockRes: Partial<Response>;

  const mockLocation = {
    _id: '507f1f77bcf86cd799439011',
    name: 'Test Location',
    address: '123 Test St',
    coordinates: { latitude: 40.7128, longitude: -74.0060 },
    isActive: true
  } as ILocationDocument;

  beforeEach(() => {
    mockReq = {
      params: {},
      query: {},
      body: {}
    };
    mockAuthReq = {
      params: {},
      query: {},
      body: {},
      user: { userId: 'admin-id', email: 'admin@test.com', role: 'ADMIN' }
    };
    mockRes = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn()
    };
    jest.clearAllMocks();
  });

  describe('getLocations', () => {
    it('should get all locations successfully', async () => {
      mockLocationService.getAllLocations.mockResolvedValue([mockLocation]);

      await LocationController.getLocations(mockReq as Request, mockRes as Response);

      expect(mockRes.status).toHaveBeenCalledWith(200);
      expect(mockRes.json).toHaveBeenCalledWith({
        success: true,
        data: [mockLocation]
      });
    });

    it('should handle AppError', async () => {
      const appError = new AppError('Service error', 400);
      mockLocationService.getAllLocations.mockRejectedValue(appError);

      await LocationController.getLocations(mockReq as Request, mockRes as Response);

      expect(mockRes.status).toHaveBeenCalledWith(400);
      expect(mockRes.json).toHaveBeenCalledWith({
        success: false,
        message: 'Service error'
      });
    });

    it('should handle generic error', async () => {
      mockLocationService.getAllLocations.mockRejectedValue(new Error('Generic error'));

      await LocationController.getLocations(mockReq as Request, mockRes as Response);

      expect(mockRes.status).toHaveBeenCalledWith(500);
      expect(mockRes.json).toHaveBeenCalledWith({
        success: false,
        message: 'Internal server error'
      });
    });
  });

  describe('getNearbyLocations', () => {
    it('should get nearby locations with lat/lng params', async () => {
      mockReq.query = { lat: '40.7128', lng: '-74.0060', radius: '5000' };
      mockValidation.validateCoordinates.mockReturnValue(true);
      mockLocationService.findNearby.mockResolvedValue([mockLocation]);

      await LocationController.getNearbyLocations(mockReq as Request, mockRes as Response);

      expect(mockLocationService.findNearby).toHaveBeenCalledWith(40.7128, -74.0060, 5);
      expect(mockRes.status).toHaveBeenCalledWith(200);
      expect(mockRes.json).toHaveBeenCalledWith({
        success: true,
        data: [mockLocation]
      });
    });

    it('should get nearby locations with latitude/longitude params', async () => {
      mockReq.query = { latitude: '40.7128', longitude: '-74.0060' };
      mockValidation.validateCoordinates.mockReturnValue(true);
      mockLocationService.findNearby.mockResolvedValue([mockLocation]);

      await LocationController.getNearbyLocations(mockReq as Request, mockRes as Response);

      expect(mockLocationService.findNearby).toHaveBeenCalledWith(40.7128, -74.0060, 10);
      expect(mockRes.status).toHaveBeenCalledWith(200);
    });

    it('should return 400 when latitude is missing', async () => {
      mockReq.query = { lng: '-74.0060' };

      await LocationController.getNearbyLocations(mockReq as Request, mockRes as Response);

      expect(mockRes.status).toHaveBeenCalledWith(400);
      expect(mockRes.json).toHaveBeenCalledWith({
        success: false,
        message: 'Latitude and longitude are required'
      });
    });

    it('should return 400 when longitude is missing', async () => {
      mockReq.query = { lat: '40.7128' };

      await LocationController.getNearbyLocations(mockReq as Request, mockRes as Response);

      expect(mockRes.status).toHaveBeenCalledWith(400);
      expect(mockRes.json).toHaveBeenCalledWith({
        success: false,
        message: 'Latitude and longitude are required'
      });
    });

    it('should return 400 for invalid coordinates', async () => {
      mockReq.query = { lat: '40.7128', lng: '-74.0060' };
      mockValidation.validateCoordinates.mockReturnValue(false);

      await LocationController.getNearbyLocations(mockReq as Request, mockRes as Response);

      expect(mockRes.status).toHaveBeenCalledWith(400);
      expect(mockRes.json).toHaveBeenCalledWith({
        success: false,
        message: 'Invalid coordinates'
      });
    });

    it('should return 400 for invalid radius', async () => {
      mockReq.query = { lat: '40.7128', lng: '-74.0060', radius: 'invalid' };
      mockValidation.validateCoordinates.mockReturnValue(true);

      await LocationController.getNearbyLocations(mockReq as Request, mockRes as Response);

      expect(mockRes.status).toHaveBeenCalledWith(400);
      expect(mockRes.json).toHaveBeenCalledWith({
        success: false,
        message: 'Invalid radius parameter'
      });
    });

    it('should return 400 for negative radius', async () => {
      mockReq.query = { lat: '40.7128', lng: '-74.0060', radius: '-5' };
      mockValidation.validateCoordinates.mockReturnValue(true);

      await LocationController.getNearbyLocations(mockReq as Request, mockRes as Response);

      expect(mockRes.status).toHaveBeenCalledWith(400);
      expect(mockRes.json).toHaveBeenCalledWith({
        success: false,
        message: 'Invalid radius parameter'
      });
    });
  });

  describe('getLocationById', () => {
    it('should get location by id successfully', async () => {
      mockReq.params = { id: '507f1f77bcf86cd799439011' };
      jest.spyOn(mongoose.Types.ObjectId, 'isValid').mockReturnValue(true);
      mockLocationService.getLocationById.mockResolvedValue(mockLocation);

      await LocationController.getLocationById(mockReq as Request, mockRes as Response);

      expect(mockRes.status).toHaveBeenCalledWith(200);
      expect(mockRes.json).toHaveBeenCalledWith({
        success: true,
        data: mockLocation
      });
    });

    it('should return 400 when id is missing', async () => {
      mockReq.params = {};

      await LocationController.getLocationById(mockReq as Request, mockRes as Response);

      expect(mockRes.status).toHaveBeenCalledWith(400);
      expect(mockRes.json).toHaveBeenCalledWith({
        success: false,
        message: 'Location ID is required'
      });
    });

    it('should return 400 for invalid id format', async () => {
      mockReq.params = { id: 'invalid-id' };
      jest.spyOn(mongoose.Types.ObjectId, 'isValid').mockReturnValue(false);

      await LocationController.getLocationById(mockReq as Request, mockRes as Response);

      expect(mockRes.status).toHaveBeenCalledWith(400);
      expect(mockRes.json).toHaveBeenCalledWith({
        success: false,
        message: 'Invalid ID format'
      });
    });

    it('should return 404 when location not found', async () => {
      mockReq.params = { id: '507f1f77bcf86cd799439011' };
      jest.spyOn(mongoose.Types.ObjectId, 'isValid').mockReturnValue(true);
      mockLocationService.getLocationById.mockResolvedValue(null);

      await LocationController.getLocationById(mockReq as Request, mockRes as Response);

      expect(mockRes.status).toHaveBeenCalledWith(404);
      expect(mockRes.json).toHaveBeenCalledWith({
        success: false,
        message: 'Location not found'
      });
    });
  });

  describe('createLocation', () => {
    it('should create location successfully', async () => {
      mockAuthReq.body = {
        name: 'New Location',
        address: '456 New St',
        coordinates: { latitude: 40.7128, longitude: -74.0060 }
      };
      mockValidation.validateCoordinates.mockReturnValue(true);
      mockLocationService.createLocation.mockResolvedValue(mockLocation);

      await LocationController.createLocation(mockAuthReq as AuthenticatedRequest, mockRes as Response);

      expect(mockRes.status).toHaveBeenCalledWith(201);
      expect(mockRes.json).toHaveBeenCalledWith({
        success: true,
        message: 'Location created successfully',
        data: mockLocation
      });
    });

    it('should return 403 for non-admin user', async () => {
      mockAuthReq.user = { userId: 'user-id', email: 'user@test.com', role: 'CUSTOMER' as UserRole };

      await LocationController.createLocation(mockAuthReq as AuthenticatedRequest, mockRes as Response);

      expect(mockRes.status).toHaveBeenCalledWith(403);
      expect(mockRes.json).toHaveBeenCalledWith({
        success: false,
        message: 'Forbidden: access denied'
      });
    });

    it('should return 400 for missing required fields', async () => {
      mockAuthReq.body = { name: 'Test' };

      await LocationController.createLocation(mockAuthReq as AuthenticatedRequest, mockRes as Response);

      expect(mockRes.status).toHaveBeenCalledWith(400);
      expect(mockRes.json).toHaveBeenCalledWith({
        success: false,
        message: 'Name, address, and coordinates are required'
      });
    });

    it('should return 400 for invalid coordinates format', async () => {
      mockAuthReq.body = {
        name: 'Test',
        address: 'Test St',
        coordinates: { latitude: 'invalid', longitude: -74.0060 }
      };

      await LocationController.createLocation(mockAuthReq as AuthenticatedRequest, mockRes as Response);

      expect(mockRes.status).toHaveBeenCalledWith(400);
      expect(mockRes.json).toHaveBeenCalledWith({
        success: false,
        message: 'Invalid coordinates format'
      });
    });

    it('should return 400 for invalid coordinates', async () => {
      mockAuthReq.body = {
        name: 'Test',
        address: 'Test St',
        coordinates: { latitude: 40.7128, longitude: -74.0060 }
      };
      mockValidation.validateCoordinates.mockReturnValue(false);

      await LocationController.createLocation(mockAuthReq as AuthenticatedRequest, mockRes as Response);

      expect(mockRes.status).toHaveBeenCalledWith(400);
      expect(mockRes.json).toHaveBeenCalledWith({
        success: false,
        message: 'Invalid coordinates'
      });
    });
  });

  describe('updateLocation', () => {
    it('should update location successfully', async () => {
      mockAuthReq.params = { id: '507f1f77bcf86cd799439011' };
      mockAuthReq.body = { name: 'Updated Location' };
      mockLocationService.updateLocation.mockResolvedValue(mockLocation);

      await LocationController.updateLocation(mockAuthReq as AuthenticatedRequest, mockRes as Response);

      expect(mockRes.status).toHaveBeenCalledWith(200);
      expect(mockRes.json).toHaveBeenCalledWith({
        success: true,
        message: 'Location updated successfully',
        data: mockLocation
      });
    });

    it('should return 403 for non-admin user', async () => {
      mockAuthReq.user = { userId: 'user-id', email: 'user@test.com', role: 'CUSTOMER' as UserRole };

      await LocationController.updateLocation(mockAuthReq as AuthenticatedRequest, mockRes as Response);

      expect(mockRes.status).toHaveBeenCalledWith(403);
      expect(mockRes.json).toHaveBeenCalledWith({
        success: false,
        message: 'Forbidden: access denied'
      });
    });

    it('should return 400 for missing id', async () => {
      mockAuthReq.params = {};

      await LocationController.updateLocation(mockAuthReq as AuthenticatedRequest, mockRes as Response);

      expect(mockRes.status).toHaveBeenCalledWith(400);
      expect(mockRes.json).toHaveBeenCalledWith({
        success: false,
        message: 'Location ID is required'
      });
    });

    it('should return 400 for invalid coordinates', async () => {
      mockAuthReq.params = { id: '507f1f77bcf86cd799439011' };
      mockAuthReq.body = {
        coordinates: { latitude: 40.7128, longitude: -74.0060 }
      };
      mockValidation.validateCoordinates.mockReturnValue(false);

      await LocationController.updateLocation(mockAuthReq as AuthenticatedRequest, mockRes as Response);

      expect(mockRes.status).toHaveBeenCalledWith(400);
      expect(mockRes.json).toHaveBeenCalledWith({
        success: false,
        message: 'Invalid coordinates'
      });
    });

    it('should return 404 when location not found', async () => {
      mockAuthReq.params = { id: '507f1f77bcf86cd799439011' };
      mockAuthReq.body = { name: 'Updated' };
      mockLocationService.updateLocation.mockResolvedValue(null);

      await LocationController.updateLocation(mockAuthReq as AuthenticatedRequest, mockRes as Response);

      expect(mockRes.status).toHaveBeenCalledWith(404);
      expect(mockRes.json).toHaveBeenCalledWith({
        success: false,
        message: 'Location not found'
      });
    });
  });

  describe('deleteLocation', () => {
    it('should delete location successfully', async () => {
      mockAuthReq.params = { id: '507f1f77bcf86cd799439011' };
      mockLocationService.getLocationById.mockResolvedValue(mockLocation);
      mockLocationService.deleteLocation.mockResolvedValue(undefined);

      await LocationController.deleteLocation(mockAuthReq as AuthenticatedRequest, mockRes as Response);

      expect(mockRes.status).toHaveBeenCalledWith(200);
      expect(mockRes.json).toHaveBeenCalledWith({
        success: true,
        message: 'Location deleted successfully'
      });
    });

    it('should return 403 for non-admin user', async () => {
      mockAuthReq.user = { userId: 'user-id', email: 'user@test.com', role: 'CUSTOMER' as UserRole };

      await LocationController.deleteLocation(mockAuthReq as AuthenticatedRequest, mockRes as Response);

      expect(mockRes.status).toHaveBeenCalledWith(403);
      expect(mockRes.json).toHaveBeenCalledWith({
        success: false,
        message: 'Forbidden: access denied'
      });
    });

    it('should return 400 for missing id', async () => {
      mockAuthReq.params = {};

      await LocationController.deleteLocation(mockAuthReq as AuthenticatedRequest, mockRes as Response);

      expect(mockRes.status).toHaveBeenCalledWith(400);
      expect(mockRes.json).toHaveBeenCalledWith({
        success: false,
        message: 'Location ID is required'
      });
    });

    it('should return 404 when location not found', async () => {
      mockAuthReq.params = { id: '507f1f77bcf86cd799439011' };
      mockLocationService.getLocationById.mockResolvedValue(null);

      await LocationController.deleteLocation(mockAuthReq as AuthenticatedRequest, mockRes as Response);

      expect(mockRes.status).toHaveBeenCalledWith(404);
      expect(mockRes.json).toHaveBeenCalledWith({
        success: false,
        message: 'Location not found'
      });
    });
  });

  describe('searchLocations', () => {
    it('should search locations successfully', async () => {
      mockReq.query = { q: 'test location' };
      mockLocationService.getAllLocations.mockResolvedValue([mockLocation]);

      await LocationController.searchLocations(mockReq as Request, mockRes as Response);

      expect(mockRes.status).toHaveBeenCalledWith(200);
      expect(mockRes.json).toHaveBeenCalledWith({
        success: true,
        data: [mockLocation]
      });
    });

    it('should return 400 when search query is missing', async () => {
      mockReq.query = {};

      await LocationController.searchLocations(mockReq as Request, mockRes as Response);

      expect(mockRes.status).toHaveBeenCalledWith(400);
      expect(mockRes.json).toHaveBeenCalledWith({
        success: false,
        message: 'Search query parameter (q) is required'
      });
    });

    it('should search with location and radius filters', async () => {
      mockReq.query = {
        q: 'test',
        lat: '40.7128',
        lng: '-74.0060',
        radius: '5'
      };
      mockValidation.validateCoordinates.mockReturnValue(true);
      mockLocationService.findNearby.mockResolvedValue([mockLocation]);

      await LocationController.searchLocations(mockReq as Request, mockRes as Response);

      expect(mockLocationService.findNearby).toHaveBeenCalledWith(40.7128, -74.0060, 5);
      expect(mockRes.status).toHaveBeenCalledWith(200);
    });

    it('should return 400 for invalid coordinates in search', async () => {
      mockReq.query = {
        q: 'test',
        lat: '40.7128',
        lng: '-74.0060',
        radius: '5'
      };
      mockValidation.validateCoordinates.mockReturnValue(false);

      await LocationController.searchLocations(mockReq as Request, mockRes as Response);

      expect(mockRes.status).toHaveBeenCalledWith(400);
      expect(mockRes.json).toHaveBeenCalledWith({
        success: false,
        message: 'Invalid coordinates'
      });
    });

    it('should handle AppError in search', async () => {
      mockReq.query = { q: 'test' };
      const appError = new AppError('Search error', 400);
      mockLocationService.getAllLocations.mockRejectedValue(appError);

      await LocationController.searchLocations(mockReq as Request, mockRes as Response);

      expect(mockRes.status).toHaveBeenCalledWith(400);
      expect(mockRes.json).toHaveBeenCalledWith({
        success: false,
        message: 'Search error'
      });
    });
  });

  describe('getLocationAvailability', () => {
    it('should get location availability successfully', async () => {
      mockReq.params = { id: '507f1f77bcf86cd799439011' };
      mockReq.query = { date: '2024-01-15' };
      jest.spyOn(mongoose.Types.ObjectId, 'isValid').mockReturnValue(true);
      mockLocationService.getLocationById.mockResolvedValue(mockLocation);

      await LocationController.getLocationAvailability(mockReq as Request, mockRes as Response);

      expect(mockRes.status).toHaveBeenCalledWith(200);
      expect(mockRes.json).toHaveBeenCalledWith({
        success: true,
        data: expect.objectContaining({
          date: expect.any(Date),
          total: expect.any(Number),
          available: expect.any(Number),
          hourlyAvailability: expect.any(Array)
        })
      });
    });

    it('should return 400 when id is missing', async () => {
      mockReq.params = {};

      await LocationController.getLocationAvailability(mockReq as Request, mockRes as Response);

      expect(mockRes.status).toHaveBeenCalledWith(400);
      expect(mockRes.json).toHaveBeenCalledWith({
        success: false,
        message: 'Location ID is required'
      });
    });

    it('should return 400 for invalid id format', async () => {
      mockReq.params = { id: 'invalid-id' };
      jest.spyOn(mongoose.Types.ObjectId, 'isValid').mockReturnValue(false);

      await LocationController.getLocationAvailability(mockReq as Request, mockRes as Response);

      expect(mockRes.status).toHaveBeenCalledWith(400);
      expect(mockRes.json).toHaveBeenCalledWith({
        success: false,
        message: 'Invalid ID format'
      });
    });

    it('should return 400 for missing date', async () => {
      mockReq.params = { id: '507f1f77bcf86cd799439011' };
      mockReq.query = {};
      jest.spyOn(mongoose.Types.ObjectId, 'isValid').mockReturnValue(true);

      await LocationController.getLocationAvailability(mockReq as Request, mockRes as Response);

      expect(mockRes.status).toHaveBeenCalledWith(400);
      expect(mockRes.json).toHaveBeenCalledWith({
        success: false,
        message: 'Invalid date format'
      });
    });

    it('should return 400 for invalid date format', async () => {
      mockReq.params = { id: '507f1f77bcf86cd799439011' };
      mockReq.query = { date: 'invalid-date' };
      jest.spyOn(mongoose.Types.ObjectId, 'isValid').mockReturnValue(true);

      await LocationController.getLocationAvailability(mockReq as Request, mockRes as Response);

      expect(mockRes.status).toHaveBeenCalledWith(400);
      expect(mockRes.json).toHaveBeenCalledWith({
        success: false,
        message: 'Invalid date format'
      });
    });

    it('should return 404 when location not found', async () => {
      mockReq.params = { id: '507f1f77bcf86cd799439011' };
      mockReq.query = { date: '2024-01-15' };
      jest.spyOn(mongoose.Types.ObjectId, 'isValid').mockReturnValue(true);
      mockLocationService.getLocationById.mockResolvedValue(null);

      await LocationController.getLocationAvailability(mockReq as Request, mockRes as Response);

      expect(mockRes.status).toHaveBeenCalledWith(404);
      expect(mockRes.json).toHaveBeenCalledWith({
        success: false,
        message: 'Location not found'
      });
    });
  });

  describe('getLocationTimeSlots', () => {
    it('should get location time slots successfully', async () => {
      mockReq.params = { id: '507f1f77bcf86cd799439011' };
      mockReq.query = { date: '2024-01-15' };
      jest.spyOn(mongoose.Types.ObjectId, 'isValid').mockReturnValue(true);
      mockLocationService.getLocationById.mockResolvedValue(mockLocation);

      await LocationController.getLocationTimeSlots(mockReq as Request, mockRes as Response);

      expect(mockRes.status).toHaveBeenCalledWith(200);
      expect(mockRes.json).toHaveBeenCalledWith({
        success: true,
        data: expect.any(Array)
      });
    });

    it('should return 400 when id is missing', async () => {
      mockReq.params = {};

      await LocationController.getLocationTimeSlots(mockReq as Request, mockRes as Response);

      expect(mockRes.status).toHaveBeenCalledWith(400);
      expect(mockRes.json).toHaveBeenCalledWith({
        success: false,
        message: 'Location ID is required'
      });
    });

    it('should return 400 when date is missing', async () => {
      mockReq.params = { id: '507f1f77bcf86cd799439011' };
      mockReq.query = {};

      await LocationController.getLocationTimeSlots(mockReq as Request, mockRes as Response);

      expect(mockRes.status).toHaveBeenCalledWith(400);
      expect(mockRes.json).toHaveBeenCalledWith({
        success: false,
        message: 'Date parameter is required'
      });
    });

    it('should return 400 for invalid id format', async () => {
      mockReq.params = { id: 'invalid-id' };
      mockReq.query = { date: '2024-01-15' };
      jest.spyOn(mongoose.Types.ObjectId, 'isValid').mockReturnValue(false);

      await LocationController.getLocationTimeSlots(mockReq as Request, mockRes as Response);

      expect(mockRes.status).toHaveBeenCalledWith(400);
      expect(mockRes.json).toHaveBeenCalledWith({
        success: false,
        message: 'Invalid ID format'
      });
    });

    it('should return 400 for invalid date format', async () => {
      mockReq.params = { id: '507f1f77bcf86cd799439011' };
      mockReq.query = { date: 'invalid-date' };
      jest.spyOn(mongoose.Types.ObjectId, 'isValid').mockReturnValue(true);

      await LocationController.getLocationTimeSlots(mockReq as Request, mockRes as Response);

      expect(mockRes.status).toHaveBeenCalledWith(400);
      expect(mockRes.json).toHaveBeenCalledWith({
        success: false,
        message: 'Invalid date format'
      });
    });

    it('should return 404 when location not found', async () => {
      mockReq.params = { id: '507f1f77bcf86cd799439011' };
      mockReq.query = { date: '2024-01-15' };
      jest.spyOn(mongoose.Types.ObjectId, 'isValid').mockReturnValue(true);
      mockLocationService.getLocationById.mockResolvedValue(null);

      await LocationController.getLocationTimeSlots(mockReq as Request, mockRes as Response);

      expect(mockRes.status).toHaveBeenCalledWith(404);
      expect(mockRes.json).toHaveBeenCalledWith({
        success: false,
        message: 'Location not found'
      });
    });
  });

  describe('getRealtimeAvailability', () => {
    it('should get realtime availability successfully', async () => {
      mockReq.params = { id: '507f1f77bcf86cd799439011' };
      jest.spyOn(mongoose.Types.ObjectId, 'isValid').mockReturnValue(true);
      mockLocationService.getLocationById.mockResolvedValue(mockLocation);

      await LocationController.getRealtimeAvailability(mockReq as Request, mockRes as Response);

      expect(mockRes.status).toHaveBeenCalledWith(200);
      expect(mockRes.json).toHaveBeenCalledWith({
        success: true,
        data: expect.objectContaining({
          locationId: '507f1f77bcf86cd799439011',
          total: expect.any(Number),
          available: expect.any(Number),
          lastUpdated: expect.any(Date),
          trend: expect.stringMatching(/increasing|decreasing/),
          nextUpdate: expect.any(Date)
        })
      });
    });

    it('should return 400 when id is missing', async () => {
      mockReq.params = {};

      await LocationController.getRealtimeAvailability(mockReq as Request, mockRes as Response);

      expect(mockRes.status).toHaveBeenCalledWith(400);
      expect(mockRes.json).toHaveBeenCalledWith({
        success: false,
        message: 'Location ID is required'
      });
    });

    it('should return 400 for invalid id format', async () => {
      mockReq.params = { id: 'invalid-id' };
      jest.spyOn(mongoose.Types.ObjectId, 'isValid').mockReturnValue(false);

      await LocationController.getRealtimeAvailability(mockReq as Request, mockRes as Response);

      expect(mockRes.status).toHaveBeenCalledWith(400);
      expect(mockRes.json).toHaveBeenCalledWith({
        success: false,
        message: 'Invalid ID format'
      });
    });

    it('should return 404 when location not found', async () => {
      mockReq.params = { id: '507f1f77bcf86cd799439011' };
      jest.spyOn(mongoose.Types.ObjectId, 'isValid').mockReturnValue(true);
      mockLocationService.getLocationById.mockResolvedValue(null);

      await LocationController.getRealtimeAvailability(mockReq as Request, mockRes as Response);

      expect(mockRes.status).toHaveBeenCalledWith(404);
      expect(mockRes.json).toHaveBeenCalledWith({
        success: false,
        message: 'Location not found'
      });
    });

    it('should handle AppError in realtime availability', async () => {
      mockReq.params = { id: '507f1f77bcf86cd799439011' };
      jest.spyOn(mongoose.Types.ObjectId, 'isValid').mockReturnValue(true);
      const appError = new AppError('Service error', 500);
      mockLocationService.getLocationById.mockRejectedValue(appError);

      await LocationController.getRealtimeAvailability(mockReq as Request, mockRes as Response);

      expect(mockRes.status).toHaveBeenCalledWith(500);
      expect(mockRes.json).toHaveBeenCalledWith({
        success: false,
        message: 'Service error'
      });
    });
  });
}); 