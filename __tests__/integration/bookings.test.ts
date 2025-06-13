import { Application } from 'express';
import request from 'supertest';


import Booking from '../../src/models/Booking';
import Location from '../../src/models/Location';
import User from '../../src/models/User';
import {
  validUser,
  adminUser,
  valetUser,
  validCreateLocationRequest,
  validCreateBookingRequest,
  invalidBookingData
} from '../fixtures';

import createTestApp from './testApp';

describe('Bookings Integration Tests', () => {
  let app: Application;
  let userToken: string;
  let adminToken: string;
  let valetToken: string;
  let userId: string;
  let adminId: string;
  let valetId: string;
  let locationId: string;
  let bookingId: string;

  beforeAll(() => {
    app = createTestApp();
  });

  beforeEach(async () => {
    // Create test users and get tokens
    const user = new User(validUser);
    const savedUser = await user.save();
    userId = savedUser._id.toString();

    const admin = new User(adminUser);
    const savedAdmin = await admin.save();
    adminId = savedAdmin._id.toString();

    const valet = new User(valetUser);
    const savedValet = await valet.save();
    valetId = savedValet._id.toString();

    // Login to get tokens
    const userLoginResponse = await request(app)
      .post('/api/auth/login')
      .send({
        email: validUser.email,
        password: validUser.password
      });
    userToken = userLoginResponse.body.data.token;

    const adminLoginResponse = await request(app)
      .post('/api/auth/login')
      .send({
        email: adminUser.email,
        password: adminUser.password
      });
    adminToken = adminLoginResponse.body.data.token;

    const valetLoginResponse = await request(app)
      .post('/api/auth/login')
      .send({
        email: valetUser.email,
        password: valetUser.password
      });
    valetToken = valetLoginResponse.body.data.token;

    // Create a test location
    const location = new Location(validCreateLocationRequest);
    const savedLocation = await location.save();
    locationId = savedLocation._id.toString();

    // Create a test booking
    const booking = new Booking({
      ...validCreateBookingRequest,
      userId: userId,
      locationId: locationId,
      price: 50.00
    });
    const savedBooking = await booking.save();
    bookingId = savedBooking._id.toString();
  });

  describe('GET /api/bookings', () => {
    it('should get user bookings with authentication', async () => {
      const response = await request(app)
        .get('/api/bookings')
        .set('Authorization', `Bearer ${userToken}`)
        .expect(200);

      expect(response.body).toMatchObject({
        success: true,
        data: expect.any(Array)
      });

      expect(response.body.data).toHaveLength(1);
      expect(response.body.data[0]).toMatchObject({
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

      expect(response.body).toMatchObject({
        success: false,
        message: expect.stringContaining('Authentication required')
      });
    });

    it('should return empty array for user with no bookings', async () => {
      // Create another user with no bookings
      const newUser = new User({
        ...validUser,
        email: 'nobookings@example.com'
      });
      await newUser.save();

      const loginResponse = await request(app)
        .post('/api/auth/login')
        .send({
          email: 'nobookings@example.com',
          password: validUser.password
        });

      const response = await request(app)
        .get('/api/bookings')
        .set('Authorization', `Bearer ${loginResponse.body.data.token}`)
        .expect(200);

      expect(response.body.data).toHaveLength(0);
    });
  });

  describe('GET /api/bookings/:id', () => {
    it('should get a specific booking by ID for owner', async () => {
      const response = await request(app)
        .get(`/api/bookings/${bookingId}`)
        .set('Authorization', `Bearer ${userToken}`)
        .expect(200);

      expect(response.body).toMatchObject({
        success: true,
        data: {
          _id: bookingId,
          userId: userId,
          locationId: locationId,
          status: 'PENDING'
        }
      });
    });

    it('should allow admin to view any booking', async () => {
      const response = await request(app)
        .get(`/api/bookings/${bookingId}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      expect(response.body).toMatchObject({
        success: true,
        data: {
          _id: bookingId,
          userId: userId,
          locationId: locationId
        }
      });
    });

    it('should fail to get booking for non-owner user', async () => {
      // Create another user
      const otherUser = new User({
        ...validUser,
        email: 'other@example.com'
      });
      await otherUser.save();

      const loginResponse = await request(app)
        .post('/api/auth/login')
        .send({
          email: 'other@example.com',
          password: validUser.password
        });

      const response = await request(app)
        .get(`/api/bookings/${bookingId}`)
        .set('Authorization', `Bearer ${loginResponse.body.data.token}`)
        .expect(403);

      expect(response.body).toMatchObject({
        success: false,
        message: expect.stringContaining('access denied')
      });
    });

    it('should return 404 for non-existent booking', async () => {
      const nonExistentId = '507f1f77bcf86cd799439011';
      const response = await request(app)
        .get(`/api/bookings/${nonExistentId}`)
        .set('Authorization', `Bearer ${userToken}`)
        .expect(404);

      expect(response.body).toMatchObject({
        success: false,
        message: expect.stringContaining('not found')
      });
    });
  });

  describe('POST /api/bookings', () => {
    it('should create a new booking successfully', async () => {
      const newBookingData = {
        locationId: locationId,
        startTime: '2025-12-02T09:00:00Z',
        endTime: '2025-12-02T17:00:00Z',
        notes: 'New test booking'
      };

      const response = await request(app)
        .post('/api/bookings')
        .set('Authorization', `Bearer ${userToken}`)
        .send(newBookingData)
        .expect(201);

      expect(response.body).toMatchObject({
        success: true,
        message: 'Booking created successfully',
        data: {
          userId: userId,
          locationId: locationId,
          status: 'PENDING',
          notes: newBookingData.notes
        }
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

      expect(response.body).toMatchObject({
        success: false,
        message: expect.stringContaining('Authentication required')
      });
    });

    it('should fail with invalid booking data', async () => {
      const response = await request(app)
        .post('/api/bookings')
        .set('Authorization', `Bearer ${userToken}`)
        .send(invalidBookingData.noLocationId)
        .expect(400);

      expect(response.body).toMatchObject({
        success: false,
        message: expect.any(String)
      });
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

      expect(response.body).toMatchObject({
        success: false,
        message: expect.any(String)
      });
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

      expect(response.body).toMatchObject({
        success: false,
        message: expect.any(String)
      });
    });
  });

  describe('PUT /api/bookings/:id/status', () => {
    it('should allow admin to update booking status', async () => {
      const response = await request(app)
        .put(`/api/bookings/${bookingId}/status`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ status: 'CONFIRMED' })
        .expect(200);

      expect(response.body).toMatchObject({
        success: true,
        message: 'Booking status updated successfully',
        data: {
          _id: bookingId,
          status: 'CONFIRMED'
        }
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

      expect(response.body).toMatchObject({
        success: true,
        data: {
          status: 'IN_PROGRESS'
        }
      });
    });

    it('should fail for regular user to update status', async () => {
      const response = await request(app)
        .put(`/api/bookings/${bookingId}/status`)
        .set('Authorization', `Bearer ${userToken}`)
        .send({ status: 'CONFIRMED' })
        .expect(403);

      expect(response.body).toMatchObject({
        success: false,
        message: expect.stringContaining('access denied')
      });
    });

    it('should fail with invalid status', async () => {
      const response = await request(app)
        .put(`/api/bookings/${bookingId}/status`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ status: 'INVALID_STATUS' })
        .expect(400);

      expect(response.body).toMatchObject({
        success: false,
        message: expect.any(String)
      });
    });
  });

  describe('DELETE /api/bookings/:id', () => {
    it('should allow user to cancel their own booking', async () => {
      const response = await request(app)
        .delete(`/api/bookings/${bookingId}`)
        .set('Authorization', `Bearer ${userToken}`)
        .expect(200);

      expect(response.body).toMatchObject({
        success: true,
        message: 'Booking cancelled successfully'
      });

      // Verify booking status was updated to CANCELLED
      const booking = await Booking.findById(bookingId);
      expect(booking?.status).toBe('CANCELLED');
    });

    it('should allow admin to cancel any booking', async () => {
      const response = await request(app)
        .delete(`/api/bookings/${bookingId}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      expect(response.body).toMatchObject({
        success: true,
        message: 'Booking cancelled successfully'
      });
    });

    it('should fail for non-owner user to cancel booking', async () => {
      // Create another user
      const otherUser = new User({
        ...validUser,
        email: 'other@example.com'
      });
      await otherUser.save();

      const loginResponse = await request(app)
        .post('/api/auth/login')
        .send({
          email: 'other@example.com',
          password: validUser.password
        });

      const response = await request(app)
        .delete(`/api/bookings/${bookingId}`)
        .set('Authorization', `Bearer ${loginResponse.body.data.token}`)
        .expect(403);

      expect(response.body).toMatchObject({
        success: false,
        message: expect.stringContaining('access denied')
      });
    });

    it('should fail to cancel non-existent booking', async () => {
      const nonExistentId = '507f1f77bcf86cd799439011';
      const response = await request(app)
        .delete(`/api/bookings/${nonExistentId}`)
        .set('Authorization', `Bearer ${userToken}`)
        .expect(404);

      expect(response.body).toMatchObject({
        success: false,
        message: expect.stringContaining('not found')
      });
    });

    it('should fail to cancel already completed booking', async () => {
      // Update booking status to COMPLETED
      await Booking.findByIdAndUpdate(bookingId, { status: 'COMPLETED' });

      const response = await request(app)
        .delete(`/api/bookings/${bookingId}`)
        .set('Authorization', `Bearer ${userToken}`)
        .expect(400);

      expect(response.body).toMatchObject({
        success: false,
        message: expect.stringContaining('cannot be cancelled')
      });
    });
  });
}); 