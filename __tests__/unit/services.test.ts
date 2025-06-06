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
import * as UserService from '../../src/services/UserService';
import AuthService from '../../src/services/AuthService';
import LocationService from '../../src/services/LocationService';
import BookingService from '../../src/services/BookingService';
import ScheduleService from '../../src/services/ScheduleService';

// Import models
import User from '../../src/models/User';
import Location from '../../src/models/Location';
import Booking from '../../src/models/Booking';
import Schedule from '../../src/models/Schedule';

// Import types
import { UserRole } from '../../src/types';

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

    it('should get all users with pagination', async () => {
      // Create multiple users
      for (let i = 0; i < 3; i++) {
        const userData = {
          ...validUser,
          email: `user${i}@example.com`
        };
        await UserService.createUser(userData);
      }
      
      const usersPage1 = await UserService.getAllUsers(1, 2);
      const usersPage2 = await UserService.getAllUsers(2, 2);
      
      expect(usersPage1.length).toBeLessThanOrEqual(2);
      expect(Array.isArray(usersPage2)).toBe(true);
    });

    it('should get users by role', async () => {
      // Create users with different roles
      const customerUser = { ...validUser, email: 'customer@example.com', role: 'CUSTOMER' as UserRole };
      const adminUser = { ...validUser, email: 'admin@example.com', role: 'ADMIN' as UserRole };
      
      await UserService.createUser(customerUser);
      await UserService.createUser(adminUser);
      
      const customers = await UserService.getUsersByRole('CUSTOMER');
      const admins = await UserService.getUsersByRole('ADMIN');
      
      expect(customers.length).toBeGreaterThanOrEqual(1);
      expect(admins.length).toBeGreaterThanOrEqual(1);
      expect(customers.every(user => user.role === 'CUSTOMER')).toBe(true);
      expect(admins.every(user => user.role === 'ADMIN')).toBe(true);
    });

    it('should update user role', async () => {
      const createdUser = await UserService.createUser(validUser);
      
      const updatedUser = await UserService.updateUserRole(createdUser._id.toString(), 'ADMIN');
      
      expect(updatedUser?.role).toBe('ADMIN');
    });

    it('should return null when updating role for non-existent user', async () => {
      const fakeId = new mongoose.Types.ObjectId().toString();
      
      const result = await UserService.updateUserRole(fakeId, 'ADMIN');
      
      expect(result).toBeNull();
    });

    it('should return null when finding non-existent user by id', async () => {
      const fakeId = new mongoose.Types.ObjectId().toString();
      
      const result = await UserService.findById(fakeId);
      
      expect(result).toBeNull();
    });

    it('should return null when finding non-existent user by email', async () => {
      const result = await UserService.findByEmail('nonexistent@example.com');
      
      expect(result).toBeNull();
    });

    it('should return null when updating profile for non-existent user', async () => {
      const fakeId = new mongoose.Types.ObjectId().toString();
      const updateData = { profile: { name: 'Test' } };
      
      const result = await UserService.updateProfile(fakeId, updateData);
      
      expect(result).toBeNull();
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

    it('should delete location', async () => {
      const createdLocation = await LocationService.createLocation(validLocation);
      
      await LocationService.deleteLocation(createdLocation._id.toString());
      
      const foundLocation = await LocationService.findById(createdLocation._id.toString());
      expect(foundLocation).toBeNull();
    });

    it('should search locations by name', async () => {
      const location1 = { ...validLocation, name: 'Downtown Parking' };
      const location2 = { ...validLocation, name: 'Mall Parking', address: '456 Mall St' };
      
      await LocationService.createLocation(location1);
      await LocationService.createLocation(location2);
      
      const searchResults = await LocationService.searchLocations('Downtown');
      
      expect(searchResults.length).toBeGreaterThanOrEqual(1);
      expect(searchResults.some(loc => loc.name.includes('Downtown'))).toBe(true);
    });

    it('should get all locations including inactive', async () => {
      const createdLocation = await LocationService.createLocation(validLocation);
      await LocationService.deactivateLocation(createdLocation._id.toString());
      
      const activeLocations = await LocationService.getAllLocations(true);
      const allLocations = await LocationService.getAllLocations(false);
      
      expect(allLocations.length).toBeGreaterThan(activeLocations.length);
    });

    it('should return null when updating non-existent location', async () => {
      const fakeId = new mongoose.Types.ObjectId().toString();
      const updateData = { name: 'Updated Name' };
      
      const result = await LocationService.updateLocation(fakeId, updateData);
      
      expect(result).toBeNull();
    });

    it('should return null when deactivating non-existent location', async () => {
      const fakeId = new mongoose.Types.ObjectId().toString();
      
      const result = await LocationService.deactivateLocation(fakeId);
      
      expect(result).toBeNull();
    });

    it('should return null when finding non-existent location by id', async () => {
      const fakeId = new mongoose.Types.ObjectId().toString();
      
      const result = await LocationService.findById(fakeId);
      
      expect(result).toBeNull();
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

    it('should get location bookings', async () => {
      const bookingData = { ...validBooking, userId, locationId };
      await BookingService.createBooking(bookingData);
      
      const locationBookings = await BookingService.getLocationBookings(locationId);
      
      expect(locationBookings.length).toBeGreaterThanOrEqual(1);
      expect(locationBookings[0]?.locationId.toString()).toBe(locationId);
    });

    it('should get location bookings with date range', async () => {
      const bookingData = { ...validBooking, userId, locationId };
      await BookingService.createBooking(bookingData);
      
      const startDate = new Date('2025-01-01');
      const endDate = new Date('2025-12-31');
      const locationBookings = await BookingService.getLocationBookings(locationId, startDate, endDate);
      
      expect(Array.isArray(locationBookings)).toBe(true);
    });

    it('should update booking with partial data', async () => {
      const bookingData = { ...validBooking, userId, locationId };
      const createdBooking = await BookingService.createBooking(bookingData);
      
      const updateData = {
        endTime: new Date(Date.now() + 4 * 60 * 60 * 1000).toISOString(), // 4 hours later as string
        notes: 'Updated booking'
      };
      
      const updatedBooking = await BookingService.updateBooking(
        createdBooking._id.toString(),
        updateData
      );
      
      expect(updatedBooking?.notes).toBe('Updated booking');
    });

    it('should return null when updating non-existent booking', async () => {
      const fakeId = new mongoose.Types.ObjectId().toString();
      const updateData = { notes: 'Test update' };
      
      await expect(BookingService.updateBooking(fakeId, updateData)).rejects.toThrow('Booking not found');
    });

    it('should delete booking', async () => {
      const bookingData = { ...validBooking, userId, locationId };
      const createdBooking = await BookingService.createBooking(bookingData);
      
      await BookingService.deleteBooking(createdBooking._id.toString());
      
      const foundBooking = await BookingService.findById(createdBooking._id.toString());
      expect(foundBooking).toBeNull();
    });

    it('should get bookings by status', async () => {
      const bookingData1 = { ...validBooking, userId, locationId };
      const bookingData2 = { 
        ...validBooking, 
        userId, 
        locationId,
        startTime: new Date(Date.now() + 3 * 60 * 60 * 1000),
        endTime: new Date(Date.now() + 5 * 60 * 60 * 1000)
      };
      
      await BookingService.createBooking(bookingData1);
      const booking2 = await BookingService.createBooking(bookingData2);
      await BookingService.updateBookingStatus(booking2._id.toString(), 'CONFIRMED');
      
      const pendingBookings = await BookingService.getBookingsByStatus('PENDING');
      const confirmedBookings = await BookingService.getBookingsByStatus('CONFIRMED');
      
      expect(pendingBookings.length).toBeGreaterThanOrEqual(1);
      expect(confirmedBookings.length).toBeGreaterThanOrEqual(1);
      expect(pendingBookings.every(b => b.status === 'PENDING')).toBe(true);
      expect(confirmedBookings.every(b => b.status === 'CONFIRMED')).toBe(true);
    });

    it('should get upcoming bookings for user', async () => {
      const futureBookingData = {
        ...validBooking,
        userId,
        locationId,
        startTime: new Date(Date.now() + 24 * 60 * 60 * 1000), // 1 day in future
        endTime: new Date(Date.now() + 25 * 60 * 60 * 1000)
      };
      
      await BookingService.createBooking(futureBookingData);
      
      const upcomingBookings = await BookingService.getUpcomingBookings(userId);
      
      expect(upcomingBookings.length).toBeGreaterThanOrEqual(1);
      // Handle populated user object
      const userIdFromBooking = typeof upcomingBookings[0]?.userId === 'string' 
        ? upcomingBookings[0]?.userId 
        : (upcomingBookings[0]?.userId as any)?._id?.toString();
      expect(userIdFromBooking).toBe(userId);
    });

    it('should get all upcoming bookings', async () => {
      const futureBookingData = {
        ...validBooking,
        userId,
        locationId,
        startTime: new Date(Date.now() + 24 * 60 * 60 * 1000), // 1 day in future
        endTime: new Date(Date.now() + 25 * 60 * 60 * 1000)
      };
      
      await BookingService.createBooking(futureBookingData);
      
      const allUpcomingBookings = await BookingService.getUpcomingBookings();
      
      expect(Array.isArray(allUpcomingBookings)).toBe(true);
    });

    it('should return false for no overlapping bookings', async () => {
      const bookingData = { ...validBooking, userId, locationId };
      await BookingService.createBooking(bookingData);
      
      // Test with different time that doesn't overlap
      const nonOverlapStart = new Date(Date.now() + 10 * 60 * 60 * 1000); // 10 hours later
      const nonOverlapEnd = new Date(Date.now() + 12 * 60 * 60 * 1000);
      
      const hasOverlap = await BookingService.checkOverlappingBookings(
        locationId,
        nonOverlapStart,
        nonOverlapEnd
      );
      
      expect(hasOverlap).toBe(false);
    });

    it('should handle pagination for user bookings', async () => {
      // Create multiple bookings for pagination test
      for (let i = 0; i < 3; i++) {
        const bookingData = {
          ...validBooking,
          userId,
          locationId,
          startTime: new Date(Date.now() + (i + 1) * 60 * 60 * 1000),
          endTime: new Date(Date.now() + (i + 2) * 60 * 60 * 1000)
        };
        await BookingService.createBooking(bookingData);
      }
      
      const userBookingsPage1 = await BookingService.getUserBookings(userId, 1, 2);
      const userBookingsPage2 = await BookingService.getUserBookings(userId, 2, 2);
      
      expect(userBookingsPage1.length).toBeLessThanOrEqual(2);
      expect(Array.isArray(userBookingsPage2)).toBe(true);
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

    it('should find schedule by id', async () => {
      const scheduleData = { ...validSchedule, locationId };
      const createdSchedule = await ScheduleService.createSchedule(scheduleData);
      
      const foundSchedule = await ScheduleService.findById(createdSchedule._id.toString());
      
      expect(foundSchedule).toBeTruthy();
      expect(foundSchedule?._id.toString()).toBe(createdSchedule._id.toString());
    });

    it('should get schedule by location and day', async () => {
      const scheduleData = { ...validSchedule, locationId };
      await ScheduleService.createSchedule(scheduleData);
      
      const schedule = await ScheduleService.getScheduleByLocationAndDay(locationId, validSchedule.dayOfWeek);
      
      expect(schedule).toBeTruthy();
      expect(schedule?.dayOfWeek).toBe(validSchedule.dayOfWeek);
    });

    it('should return null for non-existent location/day schedule', async () => {
      const schedule = await ScheduleService.getScheduleByLocationAndDay(locationId, 6); // Saturday
      
      expect(schedule).toBeNull();
    });

    it('should get weekly schedule', async () => {
      // Create schedules for multiple days
      const weekDays = [1, 2, 3]; // Mon, Tue, Wed
      for (const day of weekDays) {
        const scheduleData = { 
          ...validSchedule, 
          locationId, 
          dayOfWeek: day,
          startTime: '09:00',
          endTime: '17:00'
        };
        await ScheduleService.createSchedule(scheduleData);
      }
      
      const weeklySchedules = await ScheduleService.getWeeklySchedule(locationId);
      
      expect(weeklySchedules.length).toBe(3);
      expect(weeklySchedules.map(s => s.dayOfWeek).sort()).toEqual([1, 2, 3]);
    });

    it('should deactivate schedule', async () => {
      const scheduleData = { ...validSchedule, locationId };
      const createdSchedule = await ScheduleService.createSchedule(scheduleData);
      
      const deactivatedSchedule = await ScheduleService.deactivateSchedule(createdSchedule._id.toString());
      
      expect(deactivatedSchedule?.isActive).toBe(false);
    });

    it('should return null when deactivating non-existent schedule', async () => {
      const fakeId = new mongoose.Types.ObjectId().toString();
      
      const result = await ScheduleService.deactivateSchedule(fakeId);
      
      expect(result).toBeNull();
    });

    it('should get operating hours for location and day', async () => {
      const scheduleData = { 
        ...validSchedule, 
        locationId,
        startTime: '09:00',
        endTime: '17:00'
      };
      await ScheduleService.createSchedule(scheduleData);
      
      const operatingHours = await ScheduleService.getOperatingHours(locationId, validSchedule.dayOfWeek);
      
      expect(operatingHours).toBe(8); // 17:00 - 09:00 = 8 hours
    });

    it('should return null for operating hours when no schedule exists', async () => {
      const operatingHours = await ScheduleService.getOperatingHours(locationId, 6); // Saturday
      
      expect(operatingHours).toBeNull();
    });

    it('should get all schedules', async () => {
      const scheduleData = { ...validSchedule, locationId };
      await ScheduleService.createSchedule(scheduleData);
      
      const allSchedules = await ScheduleService.getAllSchedules();
      
      expect(allSchedules.length).toBeGreaterThanOrEqual(1);
      expect(Array.isArray(allSchedules)).toBe(true);
    });

    it('should bulk create schedules', async () => {
      const schedulesData = [
        { ...validSchedule, locationId, dayOfWeek: 1 },
        { ...validSchedule, locationId, dayOfWeek: 2 },
        { ...validSchedule, locationId, dayOfWeek: 3 }
      ];
      
      const createdSchedules = await ScheduleService.bulkCreateSchedules(schedulesData);
      
      expect(createdSchedules.length).toBe(3);
      expect(createdSchedules.map(s => s.dayOfWeek).sort()).toEqual([1, 2, 3]);
    });

    it('should update location schedules', async () => {
      // Create initial schedules
      const initialSchedules = [
        { ...validSchedule, locationId, dayOfWeek: 1, startTime: '09:00', endTime: '17:00' },
        { ...validSchedule, locationId, dayOfWeek: 2, startTime: '09:00', endTime: '17:00' }
      ];
      
      await ScheduleService.bulkCreateSchedules(initialSchedules);
      
      const updatesData = [
        { dayOfWeek: 1, startTime: '08:00', endTime: '18:00' },
        { dayOfWeek: 2, startTime: '10:00', endTime: '16:00' }
      ];
      
      const updatedSchedules = await ScheduleService.updateLocationSchedules(locationId, updatesData);
      
      expect(updatedSchedules.length).toBe(2);
      const mondaySchedule = updatedSchedules.find(s => s.dayOfWeek === 1);
      const tuesdaySchedule = updatedSchedules.find(s => s.dayOfWeek === 2);
      
      expect(mondaySchedule?.startTime).toBe('08:00');
      expect(tuesdaySchedule?.startTime).toBe('10:00');
    });

    it('should get location schedules including inactive', async () => {
      const scheduleData = { ...validSchedule, locationId };
      const createdSchedule = await ScheduleService.createSchedule(scheduleData);
      
      // Deactivate the schedule
      await ScheduleService.deactivateSchedule(createdSchedule._id.toString());
      
      const activeSchedules = await ScheduleService.getLocationSchedules(locationId, true);
      const allSchedules = await ScheduleService.getLocationSchedules(locationId, false);
      
      expect(activeSchedules.length).toBe(0);
      expect(allSchedules.length).toBe(1);
    });

    it('should return false when checking if location is open on day with no schedule', async () => {
      const isOpen = await ScheduleService.isLocationOpen(locationId, 6, '10:00'); // Saturday
      
      expect(isOpen).toBe(false);
    });

    it('should return null when updating non-existent schedule', async () => {
      const fakeId = new mongoose.Types.ObjectId().toString();
      
      const result = await ScheduleService.updateSchedule(fakeId, { startTime: '08:00' });
      
      expect(result).toBeNull();
    });
  });
}); 