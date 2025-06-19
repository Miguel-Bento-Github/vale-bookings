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

// Simple counter for unique test data
let testCounter = 0;

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

const createFreshTestContext = async (app: Application, uniqueId: string): Promise<TestContext> => {
    // Create users with unique emails per test to avoid conflicts
    const uniqueValidUser = {
        ...validUser,
        email: `test-${uniqueId}-${validUser.email}`
    };
    const uniqueAdminUser = {
        ...adminUser,
        email: `admin-${uniqueId}-${adminUser.email}`
    };
    const uniqueValetUser = {
        ...valetUser,
        email: `valet-${uniqueId}-${valetUser.email}`
    };

    // Create users and get tokens in parallel for speed
    const [userResult, adminResult, valetResult] = await Promise.all([
        createUserAndGetToken(app, uniqueValidUser),
        createUserAndGetToken(app, uniqueAdminUser),
        createUserAndGetToken(app, uniqueValetUser)
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
    // Create fresh test data for each test with unique identifiers
    testCounter++;
    return await createFreshTestContext(app, testCounter.toString());
};

// Function to reset counter when needed
export const clearTestDataCache = (): void => {
    testCounter = 0;
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