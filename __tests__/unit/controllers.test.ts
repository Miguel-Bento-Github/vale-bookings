import request from 'supertest';
import express from 'express';
import jwt from 'jsonwebtoken';
import { AuthController } from '../../src/controllers/AuthController';
import { UserController } from '../../src/controllers/UserController';
import { LocationController } from '../../src/controllers/LocationController';
import { BookingController } from '../../src/controllers/BookingController';
import { ScheduleController } from '../../src/controllers/ScheduleController';
import { AuthService } from '../../src/services/AuthService';
import { UserService } from '../../src/services/UserService';
import { LocationService } from '../../src/services/LocationService';
import { BookingService } from '../../src/services/BookingService';
import { ScheduleService } from '../../src/services/ScheduleService';
import { AppError } from '../../src/types';
import { testUsers, testLocations, testBookings, testSchedules } from '../fixtures/testData';

// Mock services
jest.mock('../../src/services/AuthService');
jest.mock('../../src/services/UserService');
jest.mock('../../src/services/LocationService');
jest.mock('../../src/services/BookingService');
jest.mock('../../src/services/ScheduleService');

const MockedAuthService = AuthService as jest.MockedClass<typeof AuthService>;
const MockedUserService = UserService as jest.MockedClass<typeof UserService>;
const MockedLocationService = LocationService as jest.MockedClass<typeof LocationService>;
const MockedBookingService = BookingService as jest.MockedClass<typeof BookingService>;
const MockedScheduleService = ScheduleService as jest.MockedClass<typeof ScheduleService>;

describe('Controllers', () => {
  let app: express.Application;
  let authController: AuthController;
  let userController: UserController;
  let locationController: LocationController;
  let bookingController: BookingController;
  let scheduleController: ScheduleController;

  beforeEach(() => {
    app = express();
    app.use(express.json());
    
    // Initialize controllers
    authController = new AuthController();
    userController = new UserController();
    locationController = new LocationController();
    bookingController = new BookingController();
    scheduleController = new ScheduleController();

    // Clear all mocks
    jest.clearAllMocks();
  });

  describe('AuthController', () => {
    beforeEach(() => {
      app.post('/auth/register', authController.register.bind(authController));
      app.post('/auth/login', authController.login.bind(authController));
      app.post('/auth/refresh', authController.refreshToken.bind(authController));
    });

    describe('POST /auth/register', () => {
      it('should register a new user successfully', async () => {
        const mockUser = { ...testUsers.validUser, _id: 'user123' };
        const mockTokens = { accessToken: 'access123', refreshToken: 'refresh123' };
        
        MockedAuthService.prototype.register.mockResolvedValue({
          user: mockUser,
          tokens: mockTokens
        });

        const response = await request(app)
          .post('/auth/register')
          .send({
            email: testUsers.validUser.email,
            password: testUsers.validUser.password,
            profile: testUsers.validUser.profile
          });

        expect(response.status).toBe(201);
        expect(response.body.success).toBe(true);
        expect(response.body.data.user).toEqual(mockUser);
        expect(response.body.data.tokens).toEqual(mockTokens);
      });

      it('should return 400 for invalid registration data', async () => {
        const response = await request(app)
          .post('/auth/register')
          .send({
            email: 'invalid-email',
            password: '123'
          });

        expect(response.status).toBe(400);
        expect(response.body.success).toBe(false);
      });

      it('should return 409 for duplicate email', async () => {
        MockedAuthService.prototype.register.mockRejectedValue(
          new AppError('Email already exists', 409)
        );

        const response = await request(app)
          .post('/auth/register')
          .send({
            email: testUsers.validUser.email,
            password: testUsers.validUser.password,
            profile: testUsers.validUser.profile
          });

        expect(response.status).toBe(409);
        expect(response.body.success).toBe(false);
      });
    });

    describe('POST /auth/login', () => {
      it('should login user successfully', async () => {
        const mockUser = { ...testUsers.validUser, _id: 'user123' };
        const mockTokens = { accessToken: 'access123', refreshToken: 'refresh123' };
        
        MockedAuthService.prototype.login.mockResolvedValue({
          user: mockUser,
          tokens: mockTokens
        });

        const response = await request(app)
          .post('/auth/login')
          .send({
            email: testUsers.validUser.email,
            password: testUsers.validUser.password
          });

        expect(response.status).toBe(200);
        expect(response.body.success).toBe(true);
        expect(response.body.data.user).toEqual(mockUser);
        expect(response.body.data.tokens).toEqual(mockTokens);
      });

      it('should return 401 for invalid credentials', async () => {
        MockedAuthService.prototype.login.mockRejectedValue(
          new AppError('Invalid credentials', 401)
        );

        const response = await request(app)
          .post('/auth/login')
          .send({
            email: testUsers.validUser.email,
            password: 'wrongpassword'
          });

        expect(response.status).toBe(401);
        expect(response.body.success).toBe(false);
      });
    });

    describe('POST /auth/refresh', () => {
      it('should refresh tokens successfully', async () => {
        const mockTokens = { accessToken: 'newaccess123', refreshToken: 'newrefresh123' };
        
        MockedAuthService.prototype.refreshTokens.mockResolvedValue(mockTokens);

        const response = await request(app)
          .post('/auth/refresh')
          .send({
            refreshToken: 'oldrefresh123'
          });

        expect(response.status).toBe(200);
        expect(response.body.success).toBe(true);
        expect(response.body.data.tokens).toEqual(mockTokens);
      });

      it('should return 401 for invalid refresh token', async () => {
        MockedAuthService.prototype.refreshTokens.mockRejectedValue(
          new AppError('Invalid refresh token', 401)
        );

        const response = await request(app)
          .post('/auth/refresh')
          .send({
            refreshToken: 'invalidtoken'
          });

        expect(response.status).toBe(401);
        expect(response.body.success).toBe(false);
      });
    });
  });

  describe('UserController', () => {
    beforeEach(() => {
      app.get('/users/profile', userController.getProfile.bind(userController));
      app.put('/users/profile', userController.updateProfile.bind(userController));
      app.delete('/users/profile', userController.deleteAccount.bind(userController));
    });

    describe('GET /users/profile', () => {
      it('should get user profile successfully', async () => {
        const mockUser = { ...testUsers.validUser, _id: 'user123' };
        
        MockedUserService.prototype.findById.mockResolvedValue(mockUser);

        // Mock req.user from auth middleware
        app.use((req, res, next) => {
          (req as any).user = { userId: 'user123' };
          next();
        });

        const response = await request(app)
          .get('/users/profile');

        expect(response.status).toBe(200);
        expect(response.body.success).toBe(true);
        expect(response.body.data.user).toEqual(mockUser);
      });

      it('should return 404 for non-existent user', async () => {
        MockedUserService.prototype.findById.mockResolvedValue(null);

        app.use((req, res, next) => {
          (req as any).user = { userId: 'nonexistent' };
          next();
        });

        const response = await request(app)
          .get('/users/profile');

        expect(response.status).toBe(404);
        expect(response.body.success).toBe(false);
      });
    });

    describe('PUT /users/profile', () => {
      it('should update user profile successfully', async () => {
        const mockUpdatedUser = { 
          ...testUsers.validUser, 
          _id: 'user123',
          profile: { ...testUsers.validUser.profile, name: 'Updated Name' }
        };
        
        MockedUserService.prototype.updateProfile.mockResolvedValue(mockUpdatedUser);

        app.use((req, res, next) => {
          (req as any).user = { userId: 'user123' };
          next();
        });

        const response = await request(app)
          .put('/users/profile')
          .send({
            profile: { name: 'Updated Name', phone: '1234567890' }
          });

        expect(response.status).toBe(200);
        expect(response.body.success).toBe(true);
        expect(response.body.data.user).toEqual(mockUpdatedUser);
      });
    });

    describe('DELETE /users/profile', () => {
      it('should delete user account successfully', async () => {
        MockedUserService.prototype.deleteUser.mockResolvedValue(true);

        app.use((req, res, next) => {
          (req as any).user = { userId: 'user123' };
          next();
        });

        const response = await request(app)
          .delete('/users/profile');

        expect(response.status).toBe(200);
        expect(response.body.success).toBe(true);
        expect(response.body.message).toBe('Account deleted successfully');
      });
    });
  });

  describe('LocationController', () => {
    beforeEach(() => {
      app.get('/locations', locationController.getLocations.bind(locationController));
      app.get('/locations/nearby', locationController.getNearbyLocations.bind(locationController));
      app.get('/locations/:id', locationController.getLocationById.bind(locationController));
      app.post('/locations', locationController.createLocation.bind(locationController));
      app.put('/locations/:id', locationController.updateLocation.bind(locationController));
      app.delete('/locations/:id', locationController.deleteLocation.bind(locationController));
    });

    describe('GET /locations', () => {
      it('should get all active locations', async () => {
        const mockLocations = [testLocations.validLocation];
        
        MockedLocationService.prototype.getAllActiveLocations.mockResolvedValue(mockLocations);

        const response = await request(app)
          .get('/locations');

        expect(response.status).toBe(200);
        expect(response.body.success).toBe(true);
        expect(response.body.data.locations).toEqual(mockLocations);
      });
    });

    describe('GET /locations/nearby', () => {
      it('should get nearby locations', async () => {
        const mockLocations = [testLocations.validLocation];
        
        MockedLocationService.prototype.findNearbyLocations.mockResolvedValue(mockLocations);

        const response = await request(app)
          .get('/locations/nearby')
          .query({
            latitude: 40.7128,
            longitude: -74.0060,
            radius: 5000
          });

        expect(response.status).toBe(200);
        expect(response.body.success).toBe(true);
        expect(response.body.data.locations).toEqual(mockLocations);
      });

      it('should return 400 for missing coordinates', async () => {
        const response = await request(app)
          .get('/locations/nearby');

        expect(response.status).toBe(400);
        expect(response.body.success).toBe(false);
      });
    });

    describe('GET /locations/:id', () => {
      it('should get location by id', async () => {
        const mockLocation = testLocations.validLocation;
        
        MockedLocationService.prototype.findById.mockResolvedValue(mockLocation);

        const response = await request(app)
          .get('/locations/location123');

        expect(response.status).toBe(200);
        expect(response.body.success).toBe(true);
        expect(response.body.data.location).toEqual(mockLocation);
      });

      it('should return 404 for non-existent location', async () => {
        MockedLocationService.prototype.findById.mockResolvedValue(null);

        const response = await request(app)
          .get('/locations/nonexistent');

        expect(response.status).toBe(404);
        expect(response.body.success).toBe(false);
      });
    });

    describe('POST /locations', () => {
      it('should create location successfully (admin only)', async () => {
        const mockLocation = { ...testLocations.validLocation, _id: 'location123' };
        
        MockedLocationService.prototype.createLocation.mockResolvedValue(mockLocation);

        // Mock admin user
        app.use((req, res, next) => {
          (req as any).user = { userId: 'admin123', role: 'ADMIN' };
          next();
        });

        const response = await request(app)
          .post('/locations')
          .send(testLocations.validLocation);

        expect(response.status).toBe(201);
        expect(response.body.success).toBe(true);
        expect(response.body.data.location).toEqual(mockLocation);
      });
    });
  });

  describe('BookingController', () => {
    beforeEach(() => {
      app.get('/bookings', bookingController.getUserBookings.bind(bookingController));
      app.get('/bookings/:id', bookingController.getBookingById.bind(bookingController));
      app.post('/bookings', bookingController.createBooking.bind(bookingController));
      app.put('/bookings/:id/status', bookingController.updateBookingStatus.bind(bookingController));
      app.delete('/bookings/:id', bookingController.cancelBooking.bind(bookingController));
    });

    describe('GET /bookings', () => {
      it('should get user bookings', async () => {
        const mockBookings = [testBookings.validBooking];
        
        MockedBookingService.prototype.getUserBookings.mockResolvedValue(mockBookings);

        app.use((req, res, next) => {
          (req as any).user = { userId: 'user123' };
          next();
        });

        const response = await request(app)
          .get('/bookings');

        expect(response.status).toBe(200);
        expect(response.body.success).toBe(true);
        expect(response.body.data.bookings).toEqual(mockBookings);
      });
    });

    describe('POST /bookings', () => {
      it('should create booking successfully', async () => {
        const mockBooking = { ...testBookings.validBooking, _id: 'booking123' };
        
        MockedBookingService.prototype.createBooking.mockResolvedValue(mockBooking);

        app.use((req, res, next) => {
          (req as any).user = { userId: 'user123' };
          next();
        });

        const response = await request(app)
          .post('/bookings')
          .send({
            locationId: 'location123',
            startTime: testBookings.validBooking.startTime,
            endTime: testBookings.validBooking.endTime,
            price: testBookings.validBooking.price
          });

        expect(response.status).toBe(201);
        expect(response.body.success).toBe(true);
        expect(response.body.data.booking).toEqual(mockBooking);
      });

      it('should return 409 for overlapping booking', async () => {
        MockedBookingService.prototype.createBooking.mockRejectedValue(
          new AppError('Booking time slot is not available', 409)
        );

        app.use((req, res, next) => {
          (req as any).user = { userId: 'user123' };
          next();
        });

        const response = await request(app)
          .post('/bookings')
          .send({
            locationId: 'location123',
            startTime: testBookings.validBooking.startTime,
            endTime: testBookings.validBooking.endTime,
            price: testBookings.validBooking.price
          });

        expect(response.status).toBe(409);
        expect(response.body.success).toBe(false);
      });
    });
  });

  describe('ScheduleController', () => {
    beforeEach(() => {
      app.get('/schedules/location/:locationId', scheduleController.getLocationSchedules.bind(scheduleController));
      app.post('/schedules', scheduleController.createSchedule.bind(scheduleController));
      app.put('/schedules/:id', scheduleController.updateSchedule.bind(scheduleController));
      app.delete('/schedules/:id', scheduleController.deleteSchedule.bind(scheduleController));
    });

    describe('GET /schedules/location/:locationId', () => {
      it('should get location schedules', async () => {
        const mockSchedules = [testSchedules.validSchedule];
        
        MockedScheduleService.prototype.getLocationSchedules.mockResolvedValue(mockSchedules);

        const response = await request(app)
          .get('/schedules/location/location123');

        expect(response.status).toBe(200);
        expect(response.body.success).toBe(true);
        expect(response.body.data.schedules).toEqual(mockSchedules);
      });
    });

    describe('POST /schedules', () => {
      it('should create schedule successfully (admin only)', async () => {
        const mockSchedule = { ...testSchedules.validSchedule, _id: 'schedule123' };
        
        MockedScheduleService.prototype.createSchedule.mockResolvedValue(mockSchedule);

        app.use((req, res, next) => {
          (req as any).user = { userId: 'admin123', role: 'ADMIN' };
          next();
        });

        const response = await request(app)
          .post('/schedules')
          .send(testSchedules.validSchedule);

        expect(response.status).toBe(201);
        expect(response.body.success).toBe(true);
        expect(response.body.data.schedule).toEqual(mockSchedule);
      });
    });
  });
}); 