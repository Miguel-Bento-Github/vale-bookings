import { Application } from 'express';
import request from 'supertest';
import User from '../../src/models/User';
import Location from '../../src/models/Location';
import Booking from '../../src/models/Booking';
import {
    validUser,
    adminUser,
    valetUser,
    validCreateLocationRequest,
    validCreateBookingRequest
} from '../fixtures';

interface TestContext {
    app: Application;
    userToken: string;
    adminToken: string;
    valetToken: string;
    userId: string;
    adminId: string;
    valetId: string;
    locationId: string;
    bookingId: string;
}

interface UserData {
    email: string;
    password: string;
    role: string;
    firstName?: string;
    lastName?: string;
    phone?: string;
}

// Cache for created entities to avoid recreating them
const entityCache = {
    users: new Map<string, any>(),
    locations: new Map<string, any>(),
    tokens: new Map<string, string>(),
};

export const createUserAndGetToken = async (app: Application, userData: UserData, cacheKey: string): Promise<{ userId: string; token: string }> => {
    // Check cache first
    if (entityCache.users.has(cacheKey) && entityCache.tokens.has(cacheKey)) {
        const cachedUser = entityCache.users.get(cacheKey);
        const cachedToken = entityCache.tokens.get(cacheKey);

        if (cachedUser && cachedToken) {
            // Check if user still exists in database, if not recreate
            const existingUser = await User.findById(cachedUser._id);
            if (existingUser) {
                return {
                    userId: cachedUser._id.toString(),
                    token: cachedToken
                };
            }
            // User was deleted, clear cache and recreate
            entityCache.users.delete(cacheKey);
            entityCache.tokens.delete(cacheKey);
        }
    }

    // Create user
    const user = new User(userData);
    const savedUser = await user.save();
    entityCache.users.set(cacheKey, savedUser);

    // Get token
    const loginResponse = await request(app)
        .post('/api/auth/login')
        .send({
            email: userData.email,
            password: userData.password
        });

    const token = loginResponse.body.data?.token as string;
    if (!token) {
        throw new Error('Failed to get authentication token');
    }

    entityCache.tokens.set(cacheKey, token);

    return {
        userId: savedUser._id.toString(),
        token
    };
};

export const createTestLocation = async (cacheKey: string = 'default'): Promise<string> => {
    // Check cache first
    if (entityCache.locations.has(cacheKey)) {
        return entityCache.locations.get(cacheKey)._id.toString();
    }

    const location = new Location(validCreateLocationRequest);
    const savedLocation = await location.save();
    entityCache.locations.set(cacheKey, savedLocation);

    return savedLocation._id.toString();
};

export const createTestBooking = async (userId: string, locationId: string): Promise<string> => {
    const booking = new Booking({
        ...validCreateBookingRequest,
        userId,
        locationId,
        price: 50.00
    });
    const savedBooking = await booking.save();
    return savedBooking._id.toString();
};

export const setupTestContext = async (app: Application): Promise<TestContext> => {
    // Create users and get tokens in parallel for speed
    const [userResult, adminResult, valetResult] = await Promise.all([
        createUserAndGetToken(app, validUser, 'user'),
        createUserAndGetToken(app, adminUser, 'admin'),
        createUserAndGetToken(app, valetUser, 'valet')
    ]);

    // Create location
    const locationId = await createTestLocation();

    // Create booking
    const bookingId = await createTestBooking(userResult.userId, locationId);

    return {
        app,
        userToken: userResult.token,
        adminToken: adminResult.token,
        valetToken: valetResult.token,
        userId: userResult.userId,
        adminId: adminResult.userId,
        valetId: valetResult.userId,
        locationId,
        bookingId
    };
};

// Clear cache when needed (called by global setup)
export const clearTestCache = (): void => {
    entityCache.users.clear();
    entityCache.locations.clear();
    entityCache.tokens.clear();
};

export const expectError = (response: request.Response, statusCode: number, messageContains?: string): void => {
    expect(response.status).toBe(statusCode);
    expect(response.body.success).toBe(false);
    if (messageContains) {
        expect(response.body.message).toContain(messageContains);
    }
};

export const expectSuccess = (response: request.Response, statusCode: number = 200): void => {
    expect(response.status).toBe(statusCode);
    expect(response.body.success).toBe(true);
}; 