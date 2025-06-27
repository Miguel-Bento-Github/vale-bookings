import { Application } from 'express';
import request from 'supertest';

import Booking from '../src/models/Booking';
import Location from '../src/models/Location';
import User from '../src/models/User';

import {
  validUser,
  adminUser,
  valetUser,
  validCreateLocationRequest,
  validCreateBookingRequest
} from './fixtures';

interface TestUserData {
    user: any;
    token: string;
    userId: string;
}

interface TestLocationData {
    location: any;
    locationId: string;
}

interface TestBookingData {
    booking: any;
    bookingId: string;
}

// Cache for test data to reduce database operations
const testDataCache = new Map<string, any>();

export const createTestUser = async (app: Application, userData = validUser, key = 'default'): Promise<TestUserData> => {
  const cacheKey = `user_${key}`;

  if (testDataCache.has(cacheKey)) {
    return testDataCache.get(cacheKey);
  }

  const user = new User(userData);
  const savedUser = await user.save();
  const userId = savedUser._id.toString();

  const loginResponse = await request(app)
    .post('/api/auth/login')
    .send({
      email: userData.email,
      password: userData.password
    });

  const token = loginResponse.body.data.token;

  const result = { user: savedUser, token, userId };
  testDataCache.set(cacheKey, result);

  return result;
};

export const createTestAdmin = async (app: Application): Promise<TestUserData> => {
  return createTestUser(app, adminUser, 'admin');
};

export const createTestValet = async (app: Application): Promise<TestUserData> => {
  return createTestUser(app, valetUser, 'valet');
};

export const createTestLocation = async (locationData = validCreateLocationRequest, key = 'default'): Promise<TestLocationData> => {
  const cacheKey = `location_${key}`;

  if (testDataCache.has(cacheKey)) {
    return testDataCache.get(cacheKey);
  }

  const location = new Location(locationData);
  const savedLocation = await location.save();
  const locationId = savedLocation._id.toString();

  const result = { location: savedLocation, locationId };
  testDataCache.set(cacheKey, result);

  return result;
};

export const createTestBooking = async (
  userId: string,
  locationId: string,
  bookingData = validCreateBookingRequest,
  key = 'default'
): Promise<TestBookingData> => {
  const cacheKey = `booking_${key}_${userId}_${locationId}`;

  if (testDataCache.has(cacheKey)) {
    return testDataCache.get(cacheKey);
  }

  const booking = new Booking({
    ...bookingData,
    userId,
    locationId,
    price: 50.00
  });

  const savedBooking = await booking.save();
  const bookingId = savedBooking._id.toString();

  const result = { booking: savedBooking, bookingId };
  testDataCache.set(cacheKey, result);

  return result;
};

// Batch operations for better performance
export const createTestDataBatch = async (app: Application) => {
  const [userData, adminData, valetData, locationData] = await Promise.all([
    createTestUser(app),
    createTestAdmin(app),
    createTestValet(app),
    createTestLocation()
  ]);

  const bookingData = await createTestBooking(userData.userId, locationData.locationId);

  return {
    user: userData,
    admin: adminData,
    valet: valetData,
    location: locationData,
    booking: bookingData
  };
};

// Clear cache between test suites
export const clearTestCache = (): void => {
  testDataCache.clear();
};

// Fast cleanup - only clear what's needed
export const fastCleanup = async (): Promise<void> => {
  // Only clear collections that were actually used in tests
  const collections = ['bookings', 'users', 'locations'];

  await Promise.all(
    collections.map(async (collectionName) => {
      try {
        const collection = await User.db.collection(collectionName);
        await collection.deleteMany({});
      } catch {
        // Collection might not exist, ignore
      }
    })
  );

  clearTestCache();
}; 