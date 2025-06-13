import { Application } from 'express';
import request from 'supertest';


import Location from '../../src/models/Location';
import Schedule from '../../src/models/Schedule';
import User from '../../src/models/User';
import {
  validUser,
  adminUser,
  validCreateLocationRequest,
  validCreateScheduleRequest
} from '../fixtures';

import createTestApp from './testApp';

describe('Schedules Integration Tests', () => {
  let app: Application;
  let userToken: string;
  let adminToken: string;
  let locationId: string;
  let scheduleId: string;

  beforeAll(() => {
    app = createTestApp();
  });

  beforeEach(async () => {
    // Create test users and get tokens
    const user = new User(validUser);
    await user.save();

    const admin = new User(adminUser);
    await admin.save();

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

    // Create a test location
    const location = new Location(validCreateLocationRequest);
    const savedLocation = await location.save();
    locationId = savedLocation._id.toString();

    // Create a test schedule
    const schedule = new Schedule({
      ...validCreateScheduleRequest,
      locationId: locationId
    });
    const savedSchedule = await schedule.save();
    scheduleId = savedSchedule._id.toString();
  });

  describe('GET /api/schedules/location/:locationId', () => {
    it('should get schedules for a specific location', async () => {
      const response = await request(app)
        .get(`/api/schedules/location/${locationId}`)
        .expect(200);

      expect(response.body).toMatchObject({
        success: true,
        data: expect.any(Array)
      });

      expect(response.body.data).toHaveLength(1);
      expect(response.body.data[0]).toMatchObject({
        _id: scheduleId,
        locationId: locationId,
        dayOfWeek: validCreateScheduleRequest.dayOfWeek,
        startTime: validCreateScheduleRequest.startTime,
        endTime: validCreateScheduleRequest.endTime,
        isActive: true
      });
    });

    it('should return empty array for location with no schedules', async () => {
      // Create another location with no schedules
      const newLocation = new Location({
        ...validCreateLocationRequest,
        name: 'No Schedule Location'
      });
      const savedNewLocation = await newLocation.save();

      const response = await request(app)
        .get(`/api/schedules/location/${savedNewLocation._id}`)
        .expect(200);

      expect(response.body.data).toHaveLength(0);
    });

    it('should filter out inactive schedules', async () => {
      // Create an inactive schedule
      const inactiveSchedule = new Schedule({
        locationId: locationId,
        dayOfWeek: 3, // Wednesday
        startTime: '10:00',
        endTime: '16:00',
        isActive: false
      });
      await inactiveSchedule.save();

      const response = await request(app)
        .get(`/api/schedules/location/${locationId}`)
        .expect(200);

      expect(response.body.data).toHaveLength(1);
      expect(response.body.data[0].dayOfWeek).toBe(validCreateScheduleRequest.dayOfWeek);
    });

    it('should return 400 for invalid location ID format', async () => {
      const response = await request(app)
        .get('/api/schedules/location/invalid-id')
        .expect(400);

      expect(response.body).toMatchObject({
        success: false,
        message: expect.stringContaining('Invalid ID')
      });
    });

    it('should return 404 for non-existent location', async () => {
      const nonExistentId = '507f1f77bcf86cd799439011';
      const response = await request(app)
        .get(`/api/schedules/location/${nonExistentId}`)
        .expect(404);

      expect(response.body).toMatchObject({
        success: false,
        message: expect.stringContaining('Location not found')
      });
    });
  });

  describe('POST /api/schedules', () => {
    it('should create a new schedule as admin', async () => {
      const newScheduleData = {
        locationId: locationId,
        dayOfWeek: 3, // Wednesday
        startTime: '10:00',
        endTime: '16:00'
      };

      const response = await request(app)
        .post('/api/schedules')
        .set('Authorization', `Bearer ${adminToken}`)
        .send(newScheduleData)
        .expect(201);

      expect(response.body).toMatchObject({
        success: true,
        message: 'Schedule created successfully',
        data: {
          locationId: locationId,
          dayOfWeek: newScheduleData.dayOfWeek,
          startTime: newScheduleData.startTime,
          endTime: newScheduleData.endTime,
          isActive: true
        }
      });

      // Verify schedule was created in database
      const schedule = await Schedule.findById(response.body.data._id);
      expect(schedule).toBeTruthy();
      expect(schedule?.locationId.toString()).toBe(locationId);
    });

    it('should fail to create schedule as regular user', async () => {
      const response = await request(app)
        .post('/api/schedules')
        .set('Authorization', `Bearer ${userToken}`)
        .send(validCreateScheduleRequest)
        .expect(403);

      expect(response.body).toMatchObject({
        success: false,
        message: expect.stringContaining('access denied')
      });
    });

    it('should fail to create schedule without authentication', async () => {
      const response = await request(app)
        .post('/api/schedules')
        .send(validCreateScheduleRequest)
        .expect(401);

      expect(response.body).toMatchObject({
        success: false,
        message: expect.stringContaining('Authentication required')
      });
    });

    it('should fail with invalid schedule data', async () => {
      const invalidScheduleData = {
        locationId: locationId,
        dayOfWeek: 8, // Invalid day (should be 0-6)
        startTime: '10:00',
        endTime: '16:00'
      };

      const response = await request(app)
        .post('/api/schedules')
        .set('Authorization', `Bearer ${adminToken}`)
        .send(invalidScheduleData)
        .expect(400);

      expect(response.body).toMatchObject({
        success: false,
        message: expect.any(String)
      });
    });

    it('should fail with invalid time format', async () => {
      const invalidTimeData = {
        locationId: locationId,
        dayOfWeek: 1,
        startTime: '25:00', // Invalid time
        endTime: '16:00'
      };

      const response = await request(app)
        .post('/api/schedules')
        .set('Authorization', `Bearer ${adminToken}`)
        .send(invalidTimeData)
        .expect(400);

      expect(response.body).toMatchObject({
        success: false,
        message: expect.any(String)
      });
    });

    it('should fail when end time is before start time', async () => {
      const invalidTimeRangeData = {
        locationId: locationId,
        dayOfWeek: 1,
        startTime: '16:00',
        endTime: '10:00' // End before start
      };

      const response = await request(app)
        .post('/api/schedules')
        .set('Authorization', `Bearer ${adminToken}`)
        .send(invalidTimeRangeData)
        .expect(400);

      expect(response.body).toMatchObject({
        success: false,
        message: expect.any(String)
      });
    });

    it('should fail for non-existent location', async () => {
      const nonExistentLocationData = {
        locationId: '507f1f77bcf86cd799439011',
        dayOfWeek: 1,
        startTime: '10:00',
        endTime: '16:00'
      };

      const response = await request(app)
        .post('/api/schedules')
        .set('Authorization', `Bearer ${adminToken}`)
        .send(nonExistentLocationData)
        .expect(404);

      expect(response.body).toMatchObject({
        success: false,
        message: expect.stringContaining('Location not found')
      });
    });
  });

  describe('PUT /api/schedules/:id', () => {
    it('should update a schedule as admin', async () => {
      const updateData = {
        startTime: '09:00',
        endTime: '18:00'
      };

      const response = await request(app)
        .put(`/api/schedules/${scheduleId}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send(updateData)
        .expect(200);

      expect(response.body).toMatchObject({
        success: true,
        message: 'Schedule updated successfully',
        data: {
          _id: scheduleId,
          startTime: updateData.startTime,
          endTime: updateData.endTime
        }
      });

      // Verify schedule was updated in database
      const schedule = await Schedule.findById(scheduleId);
      expect(schedule?.startTime).toBe(updateData.startTime);
      expect(schedule?.endTime).toBe(updateData.endTime);
    });

    it('should fail to update schedule as regular user', async () => {
      const response = await request(app)
        .put(`/api/schedules/${scheduleId}`)
        .set('Authorization', `Bearer ${userToken}`)
        .send({ startTime: '09:00' })
        .expect(403);

      expect(response.body).toMatchObject({
        success: false,
        message: expect.stringContaining('access denied')
      });
    });

    it('should fail to update non-existent schedule', async () => {
      const nonExistentId = '507f1f77bcf86cd799439011';
      const response = await request(app)
        .put(`/api/schedules/${nonExistentId}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ startTime: '09:00' })
        .expect(404);

      expect(response.body).toMatchObject({
        success: false,
        message: expect.stringContaining('not found')
      });
    });

    it('should fail with invalid update data', async () => {
      const response = await request(app)
        .put(`/api/schedules/${scheduleId}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ dayOfWeek: 8 }) // Invalid day
        .expect(400);

      expect(response.body).toMatchObject({
        success: false,
        message: expect.any(String)
      });
    });
  });

  describe('DELETE /api/schedules/:id', () => {
    it('should delete a schedule as admin', async () => {
      const response = await request(app)
        .delete(`/api/schedules/${scheduleId}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      expect(response.body).toMatchObject({
        success: true,
        message: 'Schedule deleted successfully'
      });

      // Verify schedule was deleted from database
      const schedule = await Schedule.findById(scheduleId);
      expect(schedule).toBeNull();
    });

    it('should fail to delete schedule as regular user', async () => {
      const response = await request(app)
        .delete(`/api/schedules/${scheduleId}`)
        .set('Authorization', `Bearer ${userToken}`)
        .expect(403);

      expect(response.body).toMatchObject({
        success: false,
        message: expect.stringContaining('access denied')
      });
    });

    it('should fail to delete non-existent schedule', async () => {
      const nonExistentId = '507f1f77bcf86cd799439011';
      const response = await request(app)
        .delete(`/api/schedules/${nonExistentId}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(404);

      expect(response.body).toMatchObject({
        success: false,
        message: expect.stringContaining('not found')
      });
    });

    it('should fail to delete schedule without authentication', async () => {
      const response = await request(app)
        .delete(`/api/schedules/${scheduleId}`)
        .expect(401);

      expect(response.body).toMatchObject({
        success: false,
        message: expect.stringContaining('Authentication required')
      });
    });
  });
}); 