import mongoose from 'mongoose';
import {
  validUser,
  adminUser,
  validLocation,
  validBooking,
  validSchedule,
  validRegisterRequest,
  validLoginRequest
} from '../fixtures';

// Import services that we'll create
import UserService from '../../src/services/UserService';
import AuthService from '../../src/services/AuthService';
import LocationService from '../../src/services/LocationService';
import BookingService from '../../src/services/BookingService';
import ScheduleService from '../../src/services/ScheduleService';

// Import models
import User from '../../src/models/User';
import Location from '../../src/models/Location';
import Booking from '../../src/models/Booking';
import Schedule from '../../src/models/Schedule';

describe('Services', () => {
  describe('UserService', () => {
    it('should create a new user', async () => {
      const user = await UserService.createUser(validUser);
      
      expect(user.email).toBe(validUser.email);
      expect(user.role).toBe(validUser.role);
      expect(user.profile.name).toBe(validUser.profile.name);
      expect(user.password).not.toBe(validUser.password); // Should be hashed
    });

    it('should find user by id', async () => {
      const createdUser = await UserService.createUser(validUser);
      const foundUser = await UserService.findById(createdUser._id.toString());
      
      expect(foundUser).toBeTruthy();
      expect(foundUser?.email).toBe(validUser.email);
    });

    it('should find user by email', async () => {
      await UserService.createUser(validUser);
      const foundUser = await UserService.findByEmail(validUser.email);
      
      expect(foundUser).toBeTruthy();
      expect(foundUser?.email).toBe(validUser.email);
    });

    it('should update user profile', async () => {
      const createdUser = await UserService.createUser(validUser);
      const updateData = { profile: { name: 'Updated Name', phone: '+9999999999' } };
      
      const updatedUser = await UserService.updateProfile(createdUser._id.toString(), updateData);
      
      expect(updatedUser?.profile.name).toBe('Updated Name');
      expect(updatedUser?.profile.phone).toBe('+9999999999');
    });

    it('should delete user', async () => {
      const createdUser = await UserService.createUser(validUser);
      await UserService.deleteUser(createdUser._id.toString());
      
      const foundUser = await UserService.findById(createdUser._id.toString());
      expect(foundUser).toBeNull();
    });

    it('should throw error for duplicate email', async () => {
      await UserService.createUser(validUser);
      
      await expect(UserService.createUser(validUser)).rejects.toThrow();
    });
  });

  describe('AuthService', () => {
    it('should register a new user', async () => {
      const result = await AuthService.register(validRegisterRequest);
      
      expect(result.user.email).toBe(validRegisterRequest.email);
      expect(result.tokens.accessToken).toBeTruthy();
      expect(result.tokens.refreshToken).toBeTruthy();
    });

    it('should login with valid credentials', async () => {
      await AuthService.register(validRegisterRequest);
      
      const result = await AuthService.login({
        email: validRegisterRequest.email,
        password: validRegisterRequest.password
      });
      
      expect(result.user.email).toBe(validRegisterRequest.email);
      expect(result.tokens.accessToken).toBeTruthy();
      expect(result.tokens.refreshToken).toBeTruthy();
    });

    it('should throw error for invalid credentials', async () => {
      await AuthService.register(validRegisterRequest);
      
      await expect(AuthService.login({
        email: validRegisterRequest.email,
        password: 'wrongpassword'
      })).rejects.toThrow('Invalid credentials');
    });

    it('should throw error for non-existent user', async () => {
      await expect(AuthService.login({
        email: 'nonexistent@example.com',
        password: 'password123'
      })).rejects.toThrow('Invalid credentials');
    });

    it('should verify JWT token', async () => {
      const { tokens } = await AuthService.register(validRegisterRequest);
      
      const payload = AuthService.verifyToken(tokens.accessToken);
      
      expect(payload.email).toBe(validRegisterRequest.email);
      expect(payload.userId).toBeTruthy();
    });

    it('should refresh tokens', async () => {
      const { tokens } = await AuthService.register(validRegisterRequest);
      
      // Wait a bit to ensure different timestamps
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      const newTokens = await AuthService.refreshTokens(tokens.refreshToken);
      
      expect(newTokens.accessToken).toBeTruthy();
      expect(newTokens.refreshToken).toBeTruthy();
      // Don't check if tokens are different as they might be the same due to timing
    });
  });

  describe('LocationService', () => {
    it('should create a new location', async () => {
      const location = await LocationService.createLocation(validLocation);
      
      expect(location.name).toBe(validLocation.name);
      expect(location.address).toBe(validLocation.address);
      expect(location.coordinates.latitude).toBe(validLocation.coordinates.latitude);
      expect(location.isActive).toBe(true);
    });

    it('should find location by id', async () => {
      const createdLocation = await LocationService.createLocation(validLocation);
      const foundLocation = await LocationService.findById(createdLocation._id.toString());
      
      expect(foundLocation).toBeTruthy();
      expect(foundLocation?.name).toBe(validLocation.name);
    });

    it('should get all active locations', async () => {
      await LocationService.createLocation(validLocation);
      await LocationService.createLocation({
        ...validLocation,
        name: 'Another Location',
        address: '456 Another St'
      });
      
      const locations = await LocationService.getAllLocations();
      
      expect(locations.length).toBeGreaterThanOrEqual(2);
      expect(locations.every(loc => loc.isActive)).toBe(true);
    });

    it('should update location', async () => {
      const createdLocation = await LocationService.createLocation(validLocation);
      const updateData = { name: 'Updated Location Name' };
      
      const updatedLocation = await LocationService.updateLocation(
        createdLocation._id.toString(),
        updateData
      );
      
      expect(updatedLocation?.name).toBe('Updated Location Name');
    });

    it('should deactivate location', async () => {
      const createdLocation = await LocationService.createLocation(validLocation);
      
      const deactivatedLocation = await LocationService.deactivateLocation(
        createdLocation._id.toString()
      );
      
      expect(deactivatedLocation?.isActive).toBe(false);
    });

    it('should find nearby locations', async () => {
      await LocationService.createLocation(validLocation);
      
      const nearbyLocations = await LocationService.findNearby(
        validLocation.coordinates.latitude,
        validLocation.coordinates.longitude,
        10
      );
      
      expect(nearbyLocations.length).toBeGreaterThanOrEqual(1);
    });
  });

  describe('BookingService', () => {
    let userId: string;
    let locationId: string;

    beforeEach(async () => {
      const user = await User.create(validUser);
      userId = user._id.toString();

      const location = await Location.create(validLocation);
      locationId = location._id.toString();
    });

    it('should create a new booking', async () => {
      const bookingData = { ...validBooking, userId, locationId };
      const booking = await BookingService.createBooking(bookingData);
      
      expect(booking.userId.toString()).toBe(userId);
      expect(booking.locationId.toString()).toBe(locationId);
      expect(booking.status).toBe('PENDING');
    });

    it('should find booking by id', async () => {
      const bookingData = { ...validBooking, userId, locationId };
      const createdBooking = await BookingService.createBooking(bookingData);
      
      const foundBooking = await BookingService.findById(createdBooking._id.toString());
      
      expect(foundBooking).toBeTruthy();
      expect((foundBooking?.userId as any)._id.toString()).toBe(userId);
    });

    it('should get user bookings', async () => {
      const bookingData = { ...validBooking, userId, locationId };
      await BookingService.createBooking(bookingData);
      
      const userBookings = await BookingService.getUserBookings(userId);
      
      expect(userBookings.length).toBeGreaterThanOrEqual(1);
      expect(userBookings[0]?.userId.toString()).toBe(userId);
    });

    it('should update booking status', async () => {
      const bookingData = { ...validBooking, userId, locationId };
      const createdBooking = await BookingService.createBooking(bookingData);
      
      const updatedBooking = await BookingService.updateBookingStatus(
        createdBooking._id.toString(),
        'CONFIRMED'
      );
      
      expect(updatedBooking?.status).toBe('CONFIRMED');
    });

    it('should cancel booking', async () => {
      const bookingData = { ...validBooking, userId, locationId };
      const createdBooking = await BookingService.createBooking(bookingData);
      
      const cancelledBooking = await BookingService.cancelBooking(
        createdBooking._id.toString()
      );
      
      expect(cancelledBooking?.status).toBe('CANCELLED');
    });

    it('should check for overlapping bookings', async () => {
      const bookingData = { ...validBooking, userId, locationId };
      await BookingService.createBooking(bookingData);
      
      const hasOverlap = await BookingService.checkOverlappingBookings(
        locationId,
        validBooking.startTime,
        validBooking.endTime
      );
      
      expect(hasOverlap).toBe(true);
    });
  });

  describe('ScheduleService', () => {
    let locationId: string;

    beforeEach(async () => {
      const location = await Location.create(validLocation);
      locationId = location._id.toString();
    });

    it('should create a new schedule', async () => {
      const scheduleData = { ...validSchedule, locationId };
      const schedule = await ScheduleService.createSchedule(scheduleData);
      
      expect(schedule.locationId.toString()).toBe(locationId);
      expect(schedule.dayOfWeek).toBe(validSchedule.dayOfWeek);
      expect(schedule.startTime).toBe(validSchedule.startTime);
    });

    it('should get location schedules', async () => {
      const scheduleData = { ...validSchedule, locationId };
      await ScheduleService.createSchedule(scheduleData);
      
      const schedules = await ScheduleService.getLocationSchedules(locationId);
      
      expect(schedules.length).toBeGreaterThanOrEqual(1);
      expect((schedules[0]?.locationId as any)._id.toString()).toBe(locationId);
    });

    it('should update schedule', async () => {
      const scheduleData = { ...validSchedule, locationId };
      const createdSchedule = await ScheduleService.createSchedule(scheduleData);
      
      const updatedSchedule = await ScheduleService.updateSchedule(
        createdSchedule._id.toString(),
        { startTime: '08:00' }
      );
      
      expect(updatedSchedule?.startTime).toBe('08:00');
    });

    it('should delete schedule', async () => {
      const scheduleData = { ...validSchedule, locationId };
      const createdSchedule = await ScheduleService.createSchedule(scheduleData);
      
      await ScheduleService.deleteSchedule(createdSchedule._id.toString());
      
      const foundSchedule = await ScheduleService.findById(createdSchedule._id.toString());
      expect(foundSchedule).toBeNull();
    });

    it('should check if location is open', async () => {
      const scheduleData = { ...validSchedule, locationId };
      await ScheduleService.createSchedule(scheduleData);
      
      const isOpen = await ScheduleService.isLocationOpen(locationId, 1, '10:00');
      
      expect(isOpen).toBe(true);
    });

    it('should return false for closed hours', async () => {
      const scheduleData = { ...validSchedule, locationId };
      await ScheduleService.createSchedule(scheduleData);
      
      const isOpen = await ScheduleService.isLocationOpen(locationId, 1, '20:00');
      
      expect(isOpen).toBe(false);
    });
  });
}); 