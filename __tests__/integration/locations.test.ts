import { Application } from 'express';
import request from 'supertest';


import Location from '../../src/models/Location';
import User from '../../src/models/User';
import {
  validUser,
  adminUser,
  validCreateLocationRequest,
  invalidLocationData
} from '../fixtures';

import createTestApp from './testApp';

describe('Locations Integration Tests', () => {
  let app: Application;
  let userToken: string;
  let adminToken: string;
  let userId: string;
  let adminId: string;
  let locationId: string;

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
  });

  describe('GET /api/locations', () => {
    it('should get all active locations without authentication', async () => {
      const response = await request(app)
        .get('/api/locations')
        .expect(200);

      expect(response.body).toMatchObject({
        success: true,
        data: expect.any(Array)
      });

      expect(response.body.data).toHaveLength(1);
      expect(response.body.data[0]).toMatchObject({
        _id: locationId,
        name: validCreateLocationRequest.name,
        address: validCreateLocationRequest.address,
        coordinates: validCreateLocationRequest.coordinates,
        isActive: true
      });
    });

    it('should filter out inactive locations', async () => {
      // Create an inactive location
      const inactiveLocation = new Location({
        ...validCreateLocationRequest,
        name: 'Inactive Location',
        isActive: false
      });
      await inactiveLocation.save();

      const response = await request(app)
        .get('/api/locations')
        .expect(200);

      expect(response.body.data).toHaveLength(1);
      expect(response.body.data[0].name).not.toBe('Inactive Location');
    });
  });

  describe('GET /api/locations/nearby', () => {
    it('should get nearby locations with valid coordinates', async () => {
      const response = await request(app)
        .get('/api/locations/nearby')
        .query({
          latitude: 40.7128,
          longitude: -74.0060,
          radius: 5000 // 5km
        })
        .expect(200);

      expect(response.body).toMatchObject({
        success: true,
        data: expect.any(Array)
      });
    });

    it('should fail with missing coordinates', async () => {
      const response = await request(app)
        .get('/api/locations/nearby')
        .query({ latitude: 40.7128 })
        .expect(400);

      expect(response.body).toMatchObject({
        success: false,
        message: expect.stringContaining('longitude')
      });
    });

    it('should fail with invalid coordinates', async () => {
      const response = await request(app)
        .get('/api/locations/nearby')
        .query({
          latitude: 91, // Invalid latitude
          longitude: -74.0060
        })
        .expect(400);

      expect(response.body).toMatchObject({
        success: false,
        message: expect.any(String)
      });
    });
  });

  describe('GET /api/locations/:id', () => {
    it('should get a specific location by ID', async () => {
      const response = await request(app)
        .get(`/api/locations/${locationId}`)
        .expect(200);

      expect(response.body).toMatchObject({
        success: true,
        data: {
          _id: locationId,
          name: validCreateLocationRequest.name,
          address: validCreateLocationRequest.address,
          coordinates: validCreateLocationRequest.coordinates
        }
      });
    });

    it('should return 404 for non-existent location', async () => {
      const nonExistentId = '507f1f77bcf86cd799439011';
      const response = await request(app)
        .get(`/api/locations/${nonExistentId}`)
        .expect(404);

      expect(response.body).toMatchObject({
        success: false,
        message: expect.stringContaining('not found')
      });
    });

    it('should return 400 for invalid location ID format', async () => {
      const response = await request(app)
        .get('/api/locations/invalid-id')
        .expect(400);

      expect(response.body).toMatchObject({
        success: false,
        message: expect.stringContaining('Invalid ID')
      });
    });
  });

  describe('POST /api/locations', () => {
    it('should create a new location as admin', async () => {
      const newLocationData = {
        name: 'New Test Location',
        address: '456 Test St, Test City, TS 67890',
        coordinates: {
          latitude: 41.8781,
          longitude: -87.6298
        }
      };

      const response = await request(app)
        .post('/api/locations')
        .set('Authorization', `Bearer ${adminToken}`)
        .send(newLocationData)
        .expect(201);

      expect(response.body).toMatchObject({
        success: true,
        message: 'Location created successfully',
        data: {
          name: newLocationData.name,
          address: newLocationData.address,
          coordinates: newLocationData.coordinates,
          isActive: true
        }
      });

      // Verify location was created in database
      const location = await Location.findById(response.body.data._id);
      expect(location).toBeTruthy();
      expect(location?.name).toBe(newLocationData.name);
    });

    it('should fail to create location as regular user', async () => {
      const response = await request(app)
        .post('/api/locations')
        .set('Authorization', `Bearer ${userToken}`)
        .send(validCreateLocationRequest)
        .expect(403);

      expect(response.body).toMatchObject({
        success: false,
        message: expect.stringContaining('access denied')
      });
    });

    it('should fail to create location without authentication', async () => {
      const response = await request(app)
        .post('/api/locations')
        .send(validCreateLocationRequest)
        .expect(401);

      expect(response.body).toMatchObject({
        success: false,
        message: expect.stringContaining('Authentication required')
      });
    });

    it('should fail with invalid location data', async () => {
      const response = await request(app)
        .post('/api/locations')
        .set('Authorization', `Bearer ${adminToken}`)
        .send(invalidLocationData.noName)
        .expect(400);

      expect(response.body).toMatchObject({
        success: false,
        message: expect.any(String)
      });
    });

    it('should fail with invalid coordinates', async () => {
      const response = await request(app)
        .post('/api/locations')
        .set('Authorization', `Bearer ${adminToken}`)
        .send(invalidLocationData.invalidCoordinates)
        .expect(400);

      expect(response.body).toMatchObject({
        success: false,
        message: expect.any(String)
      });
    });
  });

  describe('PUT /api/locations/:id', () => {
    it('should update a location as admin', async () => {
      const updateData = {
        name: 'Updated Location Name',
        address: '789 Updated St, Updated City, UC 12345'
      };

      const response = await request(app)
        .put(`/api/locations/${locationId}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send(updateData)
        .expect(200);

      expect(response.body).toMatchObject({
        success: true,
        message: 'Location updated successfully',
        data: {
          _id: locationId,
          name: updateData.name,
          address: updateData.address
        }
      });

      // Verify location was updated in database
      const location = await Location.findById(locationId);
      expect(location?.name).toBe(updateData.name);
      expect(location?.address).toBe(updateData.address);
    });

    it('should fail to update location as regular user', async () => {
      const response = await request(app)
        .put(`/api/locations/${locationId}`)
        .set('Authorization', `Bearer ${userToken}`)
        .send({ name: 'Updated Name' })
        .expect(403);

      expect(response.body).toMatchObject({
        success: false,
        message: expect.stringContaining('access denied')
      });
    });

    it('should fail to update non-existent location', async () => {
      const nonExistentId = '507f1f77bcf86cd799439011';
      const response = await request(app)
        .put(`/api/locations/${nonExistentId}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ name: 'Updated Name' })
        .expect(404);

      expect(response.body).toMatchObject({
        success: false,
        message: expect.stringContaining('not found')
      });
    });
  });

  describe('DELETE /api/locations/:id', () => {
    it('should delete a location as admin', async () => {
      const response = await request(app)
        .delete(`/api/locations/${locationId}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      expect(response.body).toMatchObject({
        success: true,
        message: 'Location deleted successfully'
      });

      // Verify location was deleted from database
      const location = await Location.findById(locationId);
      expect(location).toBeNull();
    });

    it('should fail to delete location as regular user', async () => {
      const response = await request(app)
        .delete(`/api/locations/${locationId}`)
        .set('Authorization', `Bearer ${userToken}`)
        .expect(403);

      expect(response.body).toMatchObject({
        success: false,
        message: expect.stringContaining('access denied')
      });
    });

    it('should fail to delete non-existent location', async () => {
      const nonExistentId = '507f1f77bcf86cd799439011';
      const response = await request(app)
        .delete(`/api/locations/${nonExistentId}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(404);

      expect(response.body).toMatchObject({
        success: false,
        message: expect.stringContaining('not found')
      });
    });
  });
}); 