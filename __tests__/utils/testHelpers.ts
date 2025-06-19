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

// Cache for shared test data to avoid recreating for every test
let testDataCache: TestContext | null = null;
let cacheCreationPromise: Promise<TestContext> | null = null;

export const createUserAndGetToken = async (app: Application, userData: UserData): Promise<{ userId: string; token: string }> => {
    // Create user with unique email to avoid conflicts
    const uniqueEmail = `${Date.now()}-${Math.random()}-${userData.email}`;
    const user = new User({
        ...userData,
        email: uniqueEmail
    });
    const savedUser = await user.save();

    // Get token
    const loginResponse = await request(app)
        .post('/api/auth/login')
        .send({
            email: uniqueEmail,
            password: userData.password
        });

    const token = loginResponse.body.data?.token as string;
    if (!token) {
        throw new Error('Failed to get authentication token');
    }

    return {
        userId: savedUser._id.toString(),
        token
    };
};

export const createTestLocation = async (): Promise<string> => {
    const location = new Location({
        ...validCreateLocationRequest,
        name: `Test Location ${Date.now()}` // Unique name to avoid conflicts
    });
    const savedLocation = await location.save();
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

const createFreshTestContext = async (app: Application): Promise<TestContext> => {
    // Create users and get tokens in parallel for speed
    const [userResult, adminResult, valetResult] = await Promise.all([
        createUserAndGetToken(app, validUser),
        createUserAndGetToken(app, adminUser),
        createUserAndGetToken(app, valetUser)
    ]);

    // Validate user creation
    if (!userResult.token || !userResult.userId) {
        throw new Error('Failed to create user or get token');
    }
    if (!adminResult.token || !adminResult.userId) {
        throw new Error('Failed to create admin or get token');
    }
    if (!valetResult.token || !valetResult.userId) {
        throw new Error('Failed to create valet or get token');
    }

    // Create location
    const locationId = await createTestLocation();
    if (!locationId) {
        throw new Error('Failed to create test location');
    }

    // Create booking
    const bookingId = await createTestBooking(userResult.userId, locationId);
    if (!bookingId) {
        throw new Error('Failed to create test booking');
    }

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

export const setupTestContext = async (app: Application): Promise<TestContext> => {
    // Use cached test data if available and still valid
    if (testDataCache) {
        // Verify tokens are still valid by making a quick request
        try {
            const response = await request(app)
                .get('/api/bookings')
                .set('Authorization', `Bearer ${testDataCache.userToken}`);

            if (response.status === 200) {
                return testDataCache; // Cache is still valid
            }
        } catch {
            // Cache is invalid, will create fresh data
        }
    }

    // If cache creation is already in progress, wait for it
    if (cacheCreationPromise) {
        testDataCache = await cacheCreationPromise;
        cacheCreationPromise = null;
        return testDataCache;
    }

    // Create fresh test context
    cacheCreationPromise = createFreshTestContext(app);
    testDataCache = await cacheCreationPromise;
    cacheCreationPromise = null;

    return testDataCache;
};

// Function to clear cache when needed (e.g., between test suites)
export const clearTestDataCache = (): void => {
    testDataCache = null;
    cacheCreationPromise = null;
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