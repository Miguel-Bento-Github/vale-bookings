import mongoose from 'mongoose';
import {
  validUser,
  adminUser,
  validLocation,
  validBooking,
  validSchedule,
  invalidUserData,
  invalidLocationData,
  invalidBookingData
} from '../fixtures';

// Import models that we'll create
import User from '../../src/models/User';
import Location from '../../src/models/Location';
import Booking from '../../src/models/Booking';
import Schedule from '../../src/models/Schedule';

describe('Models', () => {
  describe('User Model', () => {
    it('should create a valid user', async () => {
      const user = new User(validUser);
      const savedUser = await user.save();

      expect(savedUser.email).toBe(validUser.email);
      expect(savedUser.role).toBe(validUser.role);
      expect(savedUser.profile.name).toBe(validUser.profile.name);
      expect(savedUser.profile.phone).toBe(validUser.profile.phone);
      expect(savedUser.createdAt).toBeDefined();
      expect(savedUser.updatedAt).toBeDefined();
    });

    it('should create user with default role as CUSTOMER', async () => {
      const userData = { ...validUser, role: undefined };
      const user = new User(userData);
      const savedUser = await user.save();

      expect(savedUser.role).toBe('CUSTOMER');
    });

    it('should hash password before saving', async () => {
      const user = new User(validUser);
      const savedUser = await user.save();

      expect(savedUser.password).not.toBe(validUser.password);
      expect(savedUser.password.length).toBeGreaterThan(10);
    });

    it('should require email', async () => {
      const user = new User(invalidUserData.noEmail);
      
      await expect(user.save()).rejects.toThrow();
    });

    it('should validate email format', async () => {
      const user = new User(invalidUserData.invalidEmail);
      
      await expect(user.save()).rejects.toThrow();
    });

    it('should require unique email', async () => {
      const user1 = new User(validUser);
      await user1.save();

      const user2 = new User(validUser);
      await expect(user2.save()).rejects.toThrow();
    });

    it('should require password', async () => {
      const userData = { ...validUser, password: undefined };
      const user = new User(userData);
      
      await expect(user.save()).rejects.toThrow();
    });

    it('should validate password length', async () => {
      const user = new User(invalidUserData.shortPassword);
      
      await expect(user.save()).rejects.toThrow();
    });

    it('should require profile name', async () => {
      const userData = { ...validUser, profile: { phone: '+1234567890' } };
      const user = new User(userData);
      
      await expect(user.save()).rejects.toThrow();
    });

    it('should validate role enum', async () => {
      const userData = { ...validUser, role: 'INVALID_ROLE' as any };
      const user = new User(userData);
      
      await expect(user.save()).rejects.toThrow();
    });

    it('should have comparePassword method', async () => {
      const user = new User(validUser);
      const savedUser = await user.save();

      expect(typeof savedUser.comparePassword).toBe('function');
      expect(await savedUser.comparePassword(validUser.password)).toBe(true);
      expect(await savedUser.comparePassword('wrongpassword')).toBe(false);
    });
  });

  describe('Location Model', () => {
    it('should create a valid location', async () => {
      const location = new Location(validLocation);
      const savedLocation = await location.save();

      expect(savedLocation.name).toBe(validLocation.name);
      expect(savedLocation.address).toBe(validLocation.address);
      expect(savedLocation.coordinates.latitude).toBe(validLocation.coordinates.latitude);
      expect(savedLocation.coordinates.longitude).toBe(validLocation.coordinates.longitude);
      expect(savedLocation.isActive).toBe(validLocation.isActive);
      expect(savedLocation.createdAt).toBeDefined();
      expect(savedLocation.updatedAt).toBeDefined();
    });

    it('should default isActive to true', async () => {
      const locationData = { ...validLocation, isActive: undefined };
      const location = new Location(locationData);
      const savedLocation = await location.save();

      expect(savedLocation.isActive).toBe(true);
    });

    it('should require name', async () => {
      const location = new Location(invalidLocationData.noName);
      
      await expect(location.save()).rejects.toThrow();
    });

    it('should require address', async () => {
      const location = new Location(invalidLocationData.noAddress);
      
      await expect(location.save()).rejects.toThrow();
    });

    it('should require coordinates', async () => {
      const locationData = { ...validLocation, coordinates: undefined };
      const location = new Location(locationData);
      
      await expect(location.save()).rejects.toThrow();
    });

    it('should validate latitude range', async () => {
      const location = new Location(invalidLocationData.invalidCoordinates);
      
      await expect(location.save()).rejects.toThrow();
    });

    it('should validate longitude range', async () => {
      const locationData = {
        ...validLocation,
        coordinates: { latitude: 40.7128, longitude: -181 }
      };
      const location = new Location(locationData);
      
      await expect(location.save()).rejects.toThrow();
    });
  });

  describe('Booking Model', () => {
    let userId: string;
    let locationId: string;

    beforeEach(async () => {
      const user = new User(validUser);
      const savedUser = await user.save();
      userId = savedUser._id.toString();

      const location = new Location(validLocation);
      const savedLocation = await location.save();
      locationId = savedLocation._id.toString();
    });

    it('should create a valid booking', async () => {
      const bookingData = { ...validBooking, userId, locationId };
      const booking = new Booking(bookingData);
      const savedBooking = await booking.save();

      expect(savedBooking.userId.toString()).toBe(userId);
      expect(savedBooking.locationId.toString()).toBe(locationId);
      expect(savedBooking.startTime).toEqual(validBooking.startTime);
      expect(savedBooking.endTime).toEqual(validBooking.endTime);
      expect(savedBooking.status).toBe(validBooking.status);
      expect(savedBooking.price).toBe(validBooking.price);
      expect(savedBooking.notes).toBe(validBooking.notes);
      expect(savedBooking.createdAt).toBeDefined();
      expect(savedBooking.updatedAt).toBeDefined();
    });

    it('should default status to PENDING', async () => {
      const bookingData = { ...validBooking, userId, locationId, status: undefined };
      const booking = new Booking(bookingData);
      const savedBooking = await booking.save();

      expect(savedBooking.status).toBe('PENDING');
    });

    it('should require userId', async () => {
      const bookingData = { 
        locationId,
        startTime: validBooking.startTime,
        endTime: validBooking.endTime,
        status: validBooking.status,
        price: validBooking.price,
        notes: validBooking.notes
      };
      const booking = new Booking(bookingData);
      
      await expect(booking.save()).rejects.toThrow();
    });

    it('should require locationId', async () => {
      const bookingData = { 
        userId,
        startTime: validBooking.startTime,
        endTime: validBooking.endTime,
        status: validBooking.status,
        price: validBooking.price,
        notes: validBooking.notes
      };
      const booking = new Booking(bookingData);
      
      await expect(booking.save()).rejects.toThrow();
    });

    it('should require startTime', async () => {
      const bookingData = { ...validBooking, userId, locationId, startTime: undefined };
      const booking = new Booking(bookingData);
      
      await expect(booking.save()).rejects.toThrow();
    });

    it('should require endTime', async () => {
      const bookingData = { ...validBooking, userId, locationId, endTime: undefined };
      const booking = new Booking(bookingData);
      
      await expect(booking.save()).rejects.toThrow();
    });

    it('should validate status enum', async () => {
      const bookingData = { ...validBooking, userId, locationId, status: 'INVALID_STATUS' as any };
      const booking = new Booking(bookingData);
      
      await expect(booking.save()).rejects.toThrow();
    });

    it('should validate price is positive', async () => {
      const bookingData = { ...validBooking, userId, locationId, price: -10 };
      const booking = new Booking(bookingData);
      
      await expect(booking.save()).rejects.toThrow();
    });

    it('should validate endTime is after startTime', async () => {
      const bookingData = {
        ...validBooking,
        userId,
        locationId,
        startTime: new Date('2024-12-01T17:00:00Z'),
        endTime: new Date('2024-12-01T09:00:00Z')
      };
      const booking = new Booking(bookingData);
      
      await expect(booking.save()).rejects.toThrow();
    });
  });

  describe('Schedule Model', () => {
    let locationId: string;

    beforeEach(async () => {
      const location = new Location(validLocation);
      const savedLocation = await location.save();
      locationId = savedLocation._id.toString();
    });

    it('should create a valid schedule', async () => {
      const scheduleData = { ...validSchedule, locationId };
      const schedule = new Schedule(scheduleData);
      const savedSchedule = await schedule.save();

      expect(savedSchedule.locationId.toString()).toBe(locationId);
      expect(savedSchedule.dayOfWeek).toBe(validSchedule.dayOfWeek);
      expect(savedSchedule.startTime).toBe(validSchedule.startTime);
      expect(savedSchedule.endTime).toBe(validSchedule.endTime);
      expect(savedSchedule.isActive).toBe(validSchedule.isActive);
      expect(savedSchedule.createdAt).toBeDefined();
      expect(savedSchedule.updatedAt).toBeDefined();
    });

    it('should default isActive to true', async () => {
      const scheduleData = { ...validSchedule, locationId, isActive: undefined };
      const schedule = new Schedule(scheduleData);
      const savedSchedule = await schedule.save();

      expect(savedSchedule.isActive).toBe(true);
    });

    it('should require locationId', async () => {
      const scheduleData = { 
        dayOfWeek: validSchedule.dayOfWeek,
        startTime: validSchedule.startTime,
        endTime: validSchedule.endTime,
        isActive: validSchedule.isActive
      };
      const schedule = new Schedule(scheduleData);
      
      await expect(schedule.save()).rejects.toThrow();
    });

    it('should require dayOfWeek', async () => {
      const scheduleData = { ...validSchedule, locationId, dayOfWeek: undefined };
      const schedule = new Schedule(scheduleData);
      
      await expect(schedule.save()).rejects.toThrow();
    });

    it('should validate dayOfWeek range (0-6)', async () => {
      const scheduleData = { ...validSchedule, locationId, dayOfWeek: 7 };
      const schedule = new Schedule(scheduleData);
      
      await expect(schedule.save()).rejects.toThrow();
    });

    it('should require startTime', async () => {
      const scheduleData = { ...validSchedule, locationId, startTime: undefined };
      const schedule = new Schedule(scheduleData);
      
      await expect(schedule.save()).rejects.toThrow();
    });

    it('should require endTime', async () => {
      const scheduleData = { ...validSchedule, locationId, endTime: undefined };
      const schedule = new Schedule(scheduleData);
      
      await expect(schedule.save()).rejects.toThrow();
    });

    it('should validate time format (HH:MM)', async () => {
      const scheduleData = { ...validSchedule, locationId, startTime: '25:00' };
      const schedule = new Schedule(scheduleData);
      
      await expect(schedule.save()).rejects.toThrow();
    });

    it('should prevent duplicate schedules for same location and day', async () => {
      const scheduleData = { ...validSchedule, locationId };
      
      const schedule1 = new Schedule(scheduleData);
      await schedule1.save();

      const schedule2 = new Schedule(scheduleData);
      await expect(schedule2.save()).rejects.toThrow();
    });
  });
}); 