import request from 'supertest';
import app from '../../src/index';
import { validRegisterRequest } from '../fixtures/index';

describe('API Integration Tests', () => {
  let authToken: string;
  let userId: string;

  describe('Authentication Endpoints', () => {
    it('should register a new user', async () => {
      const response = await request(app)
        .post('/api/auth/register')
        .send(validRegisterRequest)
        .expect(201);

      expect(response.body.success).toBe(true);
      expect(response.body.data.user.email).toBe(validRegisterRequest.email);
      expect(response.body.data.tokens.accessToken).toBeDefined();
      
      authToken = response.body.data.tokens.accessToken;
      userId = response.body.data.user._id;
    });

    it('should login with valid credentials', async () => {
      const response = await request(app)
        .post('/api/auth/login')
        .send({
          email: validRegisterRequest.email,
          password: validRegisterRequest.password
        })
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.user.email).toBe(validRegisterRequest.email);
      expect(response.body.data.tokens.accessToken).toBeDefined();
    });

    it('should reject invalid credentials', async () => {
      const response = await request(app)
        .post('/api/auth/login')
        .send({
          email: validRegisterRequest.email,
          password: 'wrongpassword'
        })
        .expect(401);

      expect(response.body.success).toBe(false);
    });
  });

  describe('User Profile Endpoints', () => {
    it('should get user profile with valid token', async () => {
      const response = await request(app)
        .get('/api/users/profile')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.user.email).toBe(validRegisterRequest.email);
    });

    it('should reject request without token', async () => {
      await request(app)
        .get('/api/users/profile')
        .expect(401);
    });

    it('should update user profile', async () => {
      const response = await request(app)
        .put('/api/users/profile')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          profile: {
            name: 'Updated Name',
            phone: '+1999888777'
          }
        })
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.user.profile.name).toBe('Updated Name');
    });
  });

  describe('Location Endpoints', () => {
    it('should get all locations without authentication', async () => {
      const response = await request(app)
        .get('/api/locations')
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(Array.isArray(response.body.data.locations)).toBe(true);
    });

    it('should get nearby locations', async () => {
      const response = await request(app)
        .get('/api/locations/nearby')
        .query({
          latitude: 40.7128,
          longitude: -74.0060,
          radius: 5000
        })
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(Array.isArray(response.body.data.locations)).toBe(true);
    });

    it('should reject nearby locations without coordinates', async () => {
      await request(app)
        .get('/api/locations/nearby')
        .expect(400);
    });
  });

  describe('Health Check', () => {
    it('should return health status', async () => {
      const response = await request(app)
        .get('/health')
        .expect(200);

      expect(response.body.status).toBe('OK');
      expect(response.body.timestamp).toBeDefined();
    });
  });

  describe('Error Handling', () => {
    it('should return 404 for non-existent routes', async () => {
      const response = await request(app)
        .get('/api/nonexistent')
        .expect(404);

      expect(response.body.success).toBe(false);
      expect(response.body.message).toBe('Route not found');
    });
  });
}); 