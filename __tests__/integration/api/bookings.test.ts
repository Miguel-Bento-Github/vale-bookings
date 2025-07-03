import { Application } from 'express';
import request from 'supertest';

import Booking from '../../../src/models/Booking';
import User from '../../../src/models/User';
import {
  validUser,
  validCreateBookingRequest,
  invalidBookingData
} from '../../fixtures';
import { setupTestContext, expectError, expectSuccess } from '../../utils/testHelpers';
import createTestApp from '../testApp';

describe('Bookings Integration Tests', () => {
  let app: Application;
  let userToken: string;
  let adminToken: string;
  let valetToken: string;
  let userId: string;
  let locationId: string;
  let bookingId: string;

  beforeAll(() => {
    app = createTestApp();
  });

  beforeEach(async () => {
    // Setup users and tokens (cached for speed)
    const context = await setupTestContext(app);
    userToken = context.userToken;
    adminToken = context.adminToken;
    valetToken = context.valetToken;
    userId = context.userId;
    locationId = context.locationId;
    bookingId = context.bookingId;

    // Small delay to ensure all database operations are complete
    await new Promise(resolve => setTimeout(resolve, 50));
  });



  describe('GET /api/bookings', () => {
    it('should get user bookings with authentication', async () => {
      const response = await request(app)
        .get('/api/bookings')
        .set('Authorization', `Bearer ${userToken}`)
        .expect(200);

      expectSuccess(response);
      expect(response.body.data).toEqual(expect.any(Array));
      expect(response.body.data.length).toBeGreaterThanOrEqual(1);

      const booking = response.body.data.find((b: { _id: string }) => b._id === bookingId);
      expect(booking).toMatchObject({
        _id: bookingId,
        userId: userId,
        locationId: locationId,
        status: 'PENDING'
      });
    });

    it('should fail to get bookings without authentication', async () => {
      const response = await request(app)
        .get('/api/bookings')
        .expect(401);

      expectError(response, 401, 'Authentication required');
    });

    it('should return empty array for user with no bookings', async () => {
      // Create another user with no bookings using unique email
      const uniqueEmail = `nobookings-${Date.now()}@example.com`;
      const newUser = new User({
        ...validUser,
        email: uniqueEmail
      });
      await newUser.save();

      const loginResponse = await request(app)
        .post('/api/auth/login')
        .send({
          email: uniqueEmail,
          password: validUser.password
        });

      const response = await request(app)
        .get('/api/bookings')
        .set('Authorization', `Bearer ${loginResponse.body.data.token}`)
        .expect(200);

      expectSuccess(response);
      expect(response.body.data).toHaveLength(0);
    });
  });

  describe('GET /api/bookings/:id', () => {
    it('should get a specific booking by ID for owner', async () => {
      // Verify test context is properly set up
      expect(bookingId).toBeTruthy();
      expect(userToken).toBeTruthy();
      expect(userId).toBeTruthy();
      expect(locationId).toBeTruthy();

      // Verify the booking exists in the database before making the request
      const existingBooking = await Booking.findById(bookingId);
      expect(existingBooking).toBeTruthy();
      expect(existingBooking?.userId.toString()).toBe(userId);

      const response = await request(app)
        .get(`/api/bookings/${bookingId}`)
        .set('Authorization', `Bearer ${userToken}`)
        .expect(200);

      expectSuccess(response);
      expect(response.body.data).toMatchObject({
        _id: bookingId,
        userId: userId,
        locationId: locationId,
        status: 'PENDING'
      });
    });

    it('should allow admin to view any booking', async () => {
      const response = await request(app)
        .get(`/api/bookings/${bookingId}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      expectSuccess(response);
      expect(response.body.data).toMatchObject({
        _id: bookingId,
        userId: userId,
        locationId: locationId
      });
    });

    it('should fail to get booking for non-owner user', async () => {
      // Create another user with unique email
      const uniqueEmail = `other-get-${Date.now()}@example.com`;
      const otherUser = new User({
        ...validUser,
        email: uniqueEmail
      });
      await otherUser.save();

      const loginResponse = await request(app)
        .post('/api/auth/login')
        .send({
          email: uniqueEmail,
          password: validUser.password
        });

      const response = await request(app)
        .get(`/api/bookings/${bookingId}`)
        .set('Authorization', `Bearer ${loginResponse.body.data.token}`)
        .expect(403);

      expectError(response, 403, 'access denied');
    });

    it('should return 404 for non-existent booking', async () => {
      const nonExistentId = '507f1f77bcf86cd799439011';
      const response = await request(app)
        .get(`/api/bookings/${nonExistentId}`)
        .set('Authorization', `Bearer ${userToken}`)
        .expect(404);

      expectError(response, 404, 'not found');
    });
  });

  describe('POST /api/bookings', () => {
    it('should create a new booking successfully', async () => {
      // Verify test context is properly set up
      expect(userToken).toBeTruthy();
      expect(userId).toBeTruthy();
      expect(locationId).toBeTruthy();

      const newBookingData = {
        locationId: locationId,
        startTime: '2025-12-02T09:00:00Z',
        endTime: '2025-12-02T17:00:00Z',
        notes: 'New test booking'
      };

      const response = await request(app)
        .post('/api/bookings')
        .set('Authorization', `Bearer ${userToken}`)
        .send(newBookingData);

      expect(response.status).toBe(201);
      expectSuccess(response, 201);
      expect(response.body.data).toMatchObject({
        userId: userId,
        locationId: locationId,
        status: 'PENDING',
        notes: newBookingData.notes
      });

      // Verify booking was created in database
      const booking = await Booking.findById(response.body.data._id);
      expect(booking).toBeTruthy();
      expect(booking?.userId.toString()).toBe(userId);
    });

    it('should fail to create booking without authentication', async () => {
      const response = await request(app)
        .post('/api/bookings')
        .send(validCreateBookingRequest)
        .expect(401);

      expectError(response, 401, 'Authentication required');
    });

    it('should fail with invalid booking data', async () => {
      const response = await request(app)
        .post('/api/bookings')
        .set('Authorization', `Bearer ${userToken}`)
        .send(invalidBookingData.noLocationId)
        .expect(400);

      expectError(response, 400);
    });

    it('should fail with invalid time range', async () => {
      const response = await request(app)
        .post('/api/bookings')
        .set('Authorization', `Bearer ${userToken}`)
        .send({
          ...invalidBookingData.invalidTimeRange,
          locationId: locationId
        })
        .expect(400);

      expectError(response, 400);
    });

    it('should fail with past date', async () => {
      const response = await request(app)
        .post('/api/bookings')
        .set('Authorization', `Bearer ${userToken}`)
        .send({
          ...invalidBookingData.pastDate,
          locationId: locationId
        })
        .expect(400);

      expectError(response, 400);
    });
  });

  describe('PUT /api/bookings/:id/status', () => {
    it('should allow admin to update booking status', async () => {
      const response = await request(app)
        .put(`/api/bookings/${bookingId}/status`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ status: 'CONFIRMED' })
        .expect(200);

      expectSuccess(response);
      expect(response.body.data).toMatchObject({
        _id: bookingId,
        status: 'CONFIRMED'
      });

      // Verify status was updated in database
      const booking = await Booking.findById(bookingId);
      expect(booking?.status).toBe('CONFIRMED');
    });

    it('should allow valet to update booking status', async () => {
      // First, set booking to CONFIRMED status (valets can only transition from CONFIRMED to IN_PROGRESS)
      await Booking.findByIdAndUpdate(bookingId, { status: 'CONFIRMED' });

      const response = await request(app)
        .put(`/api/bookings/${bookingId}/status`)
        .set('Authorization', `Bearer ${valetToken}`)
        .send({ status: 'IN_PROGRESS' })
        .expect(200);

      expectSuccess(response);
      expect(response.body.data).toMatchObject({
        status: 'IN_PROGRESS'
      });
    });

    it('should fail for regular user to update status', async () => {
      const response = await request(app)
        .put(`/api/bookings/${bookingId}/status`)
        .set('Authorization', `Bearer ${userToken}`)
        .send({ status: 'CONFIRMED' })
        .expect(403);

      expectError(response, 403, 'Forbidden: insufficient permissions');
    });

    it('should fail with invalid status', async () => {
      const response = await request(app)
        .put(`/api/bookings/${bookingId}/status`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ status: 'INVALID_STATUS' })
        .expect(400);

      expectError(response, 400);
    });
  });

  describe('DELETE /api/bookings/:id', () => {
    it('should allow user to cancel their own booking', async () => {
      const response = await request(app)
        .delete(`/api/bookings/${bookingId}`)
        .set('Authorization', `Bearer ${userToken}`)
        .expect(200);

      expectSuccess(response);

      // Verify booking status was updated to CANCELLED
      const booking = await Booking.findById(bookingId);
      expect(booking?.status).toBe('CANCELLED');
    });

    it('should allow admin to cancel any booking', async () => {
      // Create a fresh booking for admin to cancel (since previous test may have cancelled it)
      const freshBooking = new Booking({
        userId: userId,
        locationId: locationId,
        startTime: new Date('2025-12-03T09:00:00Z'),
        endTime: new Date('2025-12-03T17:00:00Z'),
        status: 'PENDING',
        price: 50.00,
        notes: 'Fresh booking for admin cancel test'
      });
      const savedBooking = await freshBooking.save();

      const response = await request(app)
        .delete(`/api/bookings/${savedBooking._id}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      expectSuccess(response);
    });

    it('should fail for non-owner user to cancel booking', async () => {
      // Create another user with unique email
      const uniqueEmail = `other-${Date.now()}@example.com`;
      const otherUser = new User({
        ...validUser,
        email: uniqueEmail
      });
      await otherUser.save();

      const loginResponse = await request(app)
        .post('/api/auth/login')
        .send({
          email: uniqueEmail,
          password: validUser.password
        });

      // Create a fresh booking for this test
      const freshBooking = new Booking({
        userId: userId,
        locationId: locationId,
        startTime: new Date('2025-12-04T09:00:00Z'),
        endTime: new Date('2025-12-04T17:00:00Z'),
        status: 'PENDING',
        price: 50.00,
        notes: 'Fresh booking for non-owner test'
      });
      const savedBooking = await freshBooking.save();

      const response = await request(app)
        .delete(`/api/bookings/${savedBooking._id}`)
        .set('Authorization', `Bearer ${loginResponse.body.data.token}`)
        .expect(403);

      expectError(response, 403, 'Forbidden: access denied');
    });

    it('should fail to cancel non-existent booking', async () => {
      const nonExistentId = '507f1f77bcf86cd799439011';
      const response = await request(app)
        .delete(`/api/bookings/${nonExistentId}`)
        .set('Authorization', `Bearer ${userToken}`)
        .expect(404);

      expectError(response, 404, 'not found');
    });

    it('should fail to cancel already completed booking', async () => {
      // Create a fresh booking and mark it as completed
      const completedBooking = new Booking({
        userId: userId,
        locationId: locationId,
        startTime: new Date('2025-12-05T09:00:00Z'),
        endTime: new Date('2025-12-05T17:00:00Z'),
        status: 'COMPLETED',
        price: 50.00,
        notes: 'Completed booking for test'
      });
      const savedBooking = await completedBooking.save();

      const response = await request(app)
        .delete(`/api/bookings/${savedBooking._id}`)
        .set('Authorization', `Bearer ${userToken}`)
        .expect(400);

      expectError(response, 400, 'Completed bookings cannot be cancelled');
    });
  });
}); 