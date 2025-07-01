import mongoose from 'mongoose';
import request from 'supertest';

import app from '../../../src/app';
import Booking from '../../../src/models/Booking';
import Location from '../../../src/models/Location';
import User from '../../../src/models/User';
import * as AuthService from '../../../src/services/AuthService';
import * as BookingService from '../../../src/services/BookingService';
import * as LocationService from '../../../src/services/LocationService';
import * as UserService from '../../../src/services/UserService';
import { AppError, IUserDocument, ILocationDocument } from '../../../src/types';

// eslint-disable-next-line no-console
const originalConsoleError = console.error;
// eslint-disable-next-line no-console
const originalConsoleLog = console.log;

beforeAll(() => {
  // Suppress console logs during tests
  // eslint-disable-next-line no-console
  console.error = jest.fn();
  // eslint-disable-next-line no-console
  console.log = jest.fn();
});

afterAll(() => {
  // Restore console logs
  // eslint-disable-next-line no-console
  console.error = originalConsoleError;
  // eslint-disable-next-line no-console
  console.log = originalConsoleLog;
});

describe('Error Handling Tests', () => {
  afterEach(async () => {
    await User.deleteMany({});
    await Location.deleteMany({});
    await Booking.deleteMany({});
  });

  describe('AppError Class', () => {
    it('should create AppError with correct properties', () => {
      const error = new AppError('Test error', 400);

      expect(error.message).toBe('Test error');
      expect(error.statusCode).toBe(400);
      expect(error.isOperational).toBe(true);
      expect(error instanceof Error).toBe(true);
    });

    it('should have stack trace defined', () => {
      const error = new AppError('Test error', 500);

      expect(error.stack).toBeDefined();
      expect(typeof error.stack).toBe('string');
    });
  });

  describe('Global Error Handler', () => {
    it('should handle AppError correctly', async () => {
      const response = await request(app)
        .get('/api/test-error')
        .expect(400);

      expect(response.body).toEqual({
        success: false,
        message: 'Test error'
      });
    });

    it('should handle unknown errors with 500 status', async () => {
      const response = await request(app)
        .get('/api/test-unknown-error')
        .expect(500);

      expect(response.body).toEqual({
        success: false,
        message: 'Internal server error'
      });
    });
  });

  describe('LocationService Error Handling', () => {
    it('should handle duplicate location creation', async () => {
      const locationData = {
        name: 'Duplicate Location',
        address: '123 Test St',
        coordinates: { latitude: 40.7128, longitude: -74.0060 },
        isActive: true
      };

      // Create first location
      await LocationService.createLocation(locationData);

      // Try to create duplicate
      await expect(
        LocationService.createLocation(locationData)
      ).rejects.toThrow('A location with the name "Duplicate Location" already exists');
    });

    it('should handle invalid location ID for availability check', async () => {
      const invalidId = new mongoose.Types.ObjectId().toString();

      await expect(
        LocationService.getLocationAvailability(invalidId, new Date())
      ).rejects.toThrow('Location not found');
    });

    it('should handle invalid location ID for timeslots', async () => {
      const invalidId = new mongoose.Types.ObjectId().toString();

      await expect(
        LocationService.getLocationTimeslots(invalidId, new Date())
      ).rejects.toThrow('Location not found');
    });

    it('should handle location deletion with active bookings', async () => {
      // Create location
      const location = await LocationService.createLocation({
        name: 'Test Location',
        address: '123 Test St',
        coordinates: { latitude: 40.7128, longitude: -74.0060 },
        isActive: true
      });

      // Create user
      const user = await UserService.createUser({
        email: 'test@example.com',
        password: 'password123',
        role: 'CUSTOMER',
        profile: {
          name: 'Test User',
          phone: '+1234567890'
        }
      });

      // Create booking
      await BookingService.createBooking({
        userId: String(user._id),
        locationId: String(location._id),
        startTime: new Date(Date.now() + 3600000), // 1 hour from now
        endTime: new Date(Date.now() + 7200000), // 2 hours from now
        status: 'PENDING',
        price: 25,
        notes: 'Test booking'
      });

      // Try to delete location with active booking
      await expect(
        LocationService.deleteLocation(String(location._id))
      ).rejects.toThrow('Cannot delete location with active bookings');
    });
  });

  describe('BookingService Error Handling', () => {
    let user: IUserDocument;
    let location: ILocationDocument;

    beforeEach(async () => {
      user = await UserService.createUser({
        email: 'test@example.com',
        password: 'password123',
        role: 'CUSTOMER',
        profile: {
          name: 'Test User',
          phone: '+1234567890'
        }
      });

      location = await LocationService.createLocation({
        name: 'Test Location',
        address: '123 Test St',
        coordinates: { latitude: 40.7128, longitude: -74.0060 },
        isActive: true
      });
    });

    it('should handle booking not found during update', async () => {
      const invalidId = new mongoose.Types.ObjectId().toString();

      await expect(
        BookingService.updateBooking(invalidId, {
          startTime: new Date(Date.now() + 3600000).toISOString(),
          endTime: new Date(Date.now() + 7200000).toISOString()
        })
      ).rejects.toThrow('Booking not found');
    });

    it('should handle booking not found during cancellation', async () => {
      const invalidId = new mongoose.Types.ObjectId().toString();

      await expect(
        BookingService.cancelBooking(invalidId)
      ).rejects.toThrow('Booking not found');
    });

    it('should handle cancellation of completed booking', async () => {
      // Create booking
      const booking = await BookingService.createBooking({
        userId: String(user._id),
        locationId: String(location._id),
        startTime: new Date(Date.now() + 3600000),
        endTime: new Date(Date.now() + 7200000),
        status: 'PENDING',
        price: 25,
        notes: 'Test booking'
      });

      // Manually set booking status to completed
      await Booking.findByIdAndUpdate(booking._id, { status: 'COMPLETED' });

      await expect(
        BookingService.cancelBooking(String(booking._id))
      ).rejects.toThrow('Completed bookings cannot be cancelled');
    });

    it('should handle cancellation of already cancelled booking', async () => {
      // Create booking
      const booking = await BookingService.createBooking({
        userId: String(user._id),
        locationId: String(location._id),
        startTime: new Date(Date.now() + 3600000),
        endTime: new Date(Date.now() + 7200000),
        status: 'PENDING',
        price: 25,
        notes: 'Test booking'
      });

      // Cancel booking first time
      await BookingService.cancelBooking(String(booking._id));

      // Try to cancel again
      await expect(
        BookingService.cancelBooking(String(booking._id))
      ).rejects.toThrow('Booking is already cancelled');
    });
  });

  describe('AuthService Error Handling', () => {
    let user: IUserDocument;

    beforeEach(async () => {
      user = await UserService.createUser({
        email: 'test@example.com',
        password: 'password123',
        role: 'CUSTOMER',
        profile: {
          name: 'Test User',
          phone: '+1234567890'
        }
      });
    });

    it('should handle invalid email during login', async () => {
      await expect(
        AuthService.login({ email: 'nonexistent@example.com', password: 'password123' })
      ).rejects.toThrow('Invalid credentials');
    });

    it('should handle invalid password during login', async () => {
      await expect(
        AuthService.login({ email: 'test@example.com', password: 'wrongpassword' })
      ).rejects.toThrow('Invalid credentials');
    });

    it('should handle invalid JWT token', () => {
      expect(() =>
        AuthService.verifyToken('invalid.jwt.token')
      ).toThrow('Invalid token');
    });

    it('should handle invalid refresh token', () => {
      expect(() =>
        AuthService.verifyRefreshToken('invalid_refresh_token')
      ).toThrow('Invalid refresh token');
    });

    it('should handle user not found during token refresh', async () => {
      // First create a valid token for a user that will be deleted
      const tokens = AuthService.generateTokens(user);

      // Delete the user
      await UserService.deleteUser(String(user._id));

      // Try to refresh tokens
      await expect(
        AuthService.refreshTokens(tokens.refreshToken)
      ).rejects.toThrow('User not found');
    });
  });

  describe('UserService Error Handling', () => {
    it('should handle duplicate email during user creation', async () => {
      const userData = {
        email: 'duplicate@example.com',
        password: 'password123',
        role: 'CUSTOMER' as const,
        profile: {
          name: 'Test User',
          phone: '+1234567890'
        }
      };

      // Create first user
      await UserService.createUser(userData);

      // Try to create duplicate
      await expect(
        UserService.createUser(userData)
      ).rejects.toThrow('User with this email already exists');
    });
  });

  describe('Content Type Validation', () => {
    it('should reject plain text content type', async () => {
      const response = await request(app)
        .post('/api/auth/register')
        .set('Content-Type', 'text/plain')
        .send('plain text data')
        .expect(400);

      expect(response.body).toEqual({
        success: false,
        error: 'Invalid content type',
        errorCode: 'BAD_REQUEST'
      });
    });

    it('should accept valid JSON content type', async () => {
      const response = await request(app)
        .post('/api/auth/register')
        .set('Content-Type', 'application/json')
        .send({
          email: 'test@example.com',
          password: 'password123',
          profile: {
            name: 'Test User',
            phone: '+1234567890'
          }
        });

      // Should not be rejected due to content type
      expect(response.status).not.toBe(400);
    });
  });

  describe('Edge Cases', () => {
    it('should handle very large coordinates', async () => {
      const locations = await LocationService.findNearby(91, 181, 10);
      expect(locations).toEqual([]);
    });

    it('should handle negative radius', async () => {
      const locations = await LocationService.findNearby(40.7128, -74.0060, -5);
      expect(locations).toEqual([]);
    });

    it('should handle empty search query', async () => {
      const locations = await LocationService.searchLocations('');
      expect(locations).toEqual([]);
    });

    it('should handle special characters in search', async () => {
      const locations = await LocationService.searchLocations('!@#$%^&*()');
      expect(locations).toEqual([]);
    });
  });

  describe('Database Connection Errors', () => {
    it('should handle mongoose validation errors', async () => {
      // Create location with invalid coordinates
      const invalidLocation = {
        name: 'Invalid Location',
        address: '123 Test St',
        coordinates: { latitude: 'invalid' as unknown as number, longitude: -74.0060 },
        isActive: true
      };

      await expect(
        LocationService.createLocation(invalidLocation)
      ).rejects.toThrow();
    });
  });
}); 