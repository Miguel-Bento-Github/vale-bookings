import { Application } from 'express';
import request from 'supertest';


import User from '../../../src/models/User';
import {
  validRegisterRequest,
  validLoginRequest,
  invalidUserData,
  validUser
} from '../../fixtures';
import createTestApp from '../testApp';

describe('Auth Integration Tests', () => {
  let app: Application;

  beforeAll(() => {
    app = createTestApp();
  });

  describe('POST /api/auth/register', () => {
    it('should register a new customer successfully', async () => {
      const response = await request(app)
        .post('/api/auth/register')
        .send(validRegisterRequest)
        .expect(201);

      expect(response.body).toMatchObject({
        success: true,
        message: 'User registered successfully',
        data: {
          user: {
            email: validRegisterRequest.email,
            role: 'CUSTOMER',
            profile: {
              name: validRegisterRequest.profile.name,
              phone: validRegisterRequest.profile.phone
            }
          },
          token: expect.any(String),
          refreshToken: expect.any(String)
        }
      });

      // Verify user was created in database
      const user = await User.findOne({ email: validRegisterRequest.email });
      expect(user).toBeTruthy();
      expect(user?.email).toBe(validRegisterRequest.email);
      expect(user?.role).toBe('CUSTOMER');
    });

    it('should fail to register with invalid email format', async () => {
      const response = await request(app)
        .post('/api/auth/register')
        .send(invalidUserData.invalidEmail)
        .expect(400);

      expect(response.body).toMatchObject({
        success: false,
        message: expect.stringContaining('email')
      });
    });

    it('should fail to register with short password', async () => {
      const response = await request(app)
        .post('/api/auth/register')
        .send(invalidUserData.shortPassword)
        .expect(400);

      expect(response.body).toMatchObject({
        success: false,
        message: expect.stringContaining('password')
      });
    });

    it('should fail to register with missing required fields', async () => {
      const response = await request(app)
        .post('/api/auth/register')
        .send(invalidUserData.noEmail)
        .expect(400);

      expect(response.body).toMatchObject({
        success: false,
        message: expect.any(String)
      });
    });

    it('should fail to register with duplicate email', async () => {
      // First registration
      await request(app)
        .post('/api/auth/register')
        .send(validRegisterRequest)
        .expect(201);

      // Second registration with same email
      const response = await request(app)
        .post('/api/auth/register')
        .send(validRegisterRequest)
        .expect(409);

      expect(response.body).toMatchObject({
        success: false,
        message: expect.stringContaining('already exists')
      });
    });

    it('should register admin user with proper role', async () => {
      const adminRegisterRequest = {
        ...validRegisterRequest,
        email: 'testadmin@example.com',
        role: 'ADMIN'
      };

      const response = await request(app)
        .post('/api/auth/register')
        .send(adminRegisterRequest)
        .expect(201);

      expect(response.body.data.user.role).toBe('ADMIN');
    });

    describe('Email Validation', () => {
      it('should reject registration with email exceeding length limits', async () => {
        const longEmail = 'a'.repeat(65) + '@example.com';
        const response = await request(app)
          .post('/api/auth/register')
          .send({
            email: longEmail,
            password: 'password123',
            profile: { name: 'Test User' }
          })
          .expect(400);

        expect(response.body).toMatchObject({
          success: false,
          message: 'Invalid email format'
        });
      });

      it('should reject registration with invalid email characters', async () => {
        const response = await request(app)
          .post('/api/auth/register')
          .send({
            email: 'user name@example.com',
            password: 'password123',
            profile: { name: 'Test User' }
          })
          .expect(400);

        expect(response.body).toMatchObject({
          success: false,
          message: 'Invalid email format'
        });
      });

      it('should reject registration with malformed email', async () => {
        const response = await request(app)
          .post('/api/auth/register')
          .send({
            email: 'user@',
            password: 'password123',
            profile: { name: 'Test User' }
          })
          .expect(400);

        expect(response.body).toMatchObject({
          success: false,
          message: 'Invalid email format'
        });
      });

      it('should accept registration with valid email format', async () => {
        const response = await request(app)
          .post('/api/auth/register')
          .send({
            email: 'valid.user+tag@example.com',
            password: 'password123',
            profile: { name: 'Test User' }
          })
          .expect(201);

        expect(response.body).toMatchObject({
          success: true,
          message: 'User registered successfully',
          data: {
            user: {
              email: 'valid.user+tag@example.com'
            },
            token: expect.any(String),
            refreshToken: expect.any(String)
          }
        });
      });
    });
  });

  describe('POST /api/auth/login', () => {
    beforeEach(async () => {
      // Create a test user for login tests
      const user = new User(validUser);
      await user.save();
    });

    it('should login successfully with valid credentials', async () => {
      const response = await request(app)
        .post('/api/auth/login')
        .send(validLoginRequest)
        .expect(200);

      expect(response.body).toMatchObject({
        success: true,
        message: 'Login successful',
        data: {
          user: {
            email: validLoginRequest.email,
            role: expect.any(String),
            profile: expect.any(Object)
          },
          token: expect.any(String),
          refreshToken: expect.any(String)
        }
      });
    });

    it('should fail to login with invalid email', async () => {
      const response = await request(app)
        .post('/api/auth/login')
        .send({
          email: 'nonexistent@example.com',
          password: 'password123'
        })
        .expect(401);

      expect(response.body).toMatchObject({
        success: false,
        message: expect.stringContaining('Invalid credentials')
      });
    });

    it('should fail to login with invalid password', async () => {
      const response = await request(app)
        .post('/api/auth/login')
        .send({
          email: validLoginRequest.email,
          password: 'wrongpassword'
        })
        .expect(401);

      expect(response.body).toMatchObject({
        success: false,
        message: expect.stringContaining('Invalid credentials')
      });
    });

    it('should fail to login with missing credentials', async () => {
      const response = await request(app)
        .post('/api/auth/login')
        .send({
          email: validLoginRequest.email
        })
        .expect(400);

      expect(response.body).toMatchObject({
        success: false,
        message: expect.any(String)
      });
    });

    it('should fail to login with invalid email format', async () => {
      const response = await request(app)
        .post('/api/auth/login')
        .send({
          email: 'invalid-email',
          password: 'password123'
        })
        .expect(400);

      expect(response.body).toMatchObject({
        success: false,
        message: expect.stringContaining('email')
      });
    });
  });

  describe('POST /api/auth/refresh', () => {
    let refreshToken: string;

    beforeEach(async () => {
      // Register user and get refresh token
      const user = new User(validUser);
      await user.save();

      const loginResponse = await request(app)
        .post('/api/auth/login')
        .send(validLoginRequest);

      refreshToken = loginResponse.body.data.refreshToken;
    });

    it('should refresh token successfully with valid refresh token', async () => {
      const response = await request(app)
        .post('/api/auth/refresh')
        .send({ refreshToken })
        .expect(200);

      expect(response.body).toMatchObject({
        success: true,
        message: 'Token refreshed successfully',
        data: {
          token: expect.any(String),
          refreshToken: expect.any(String)
        }
      });
    });

    it('should fail to refresh with invalid refresh token', async () => {
      const response = await request(app)
        .post('/api/auth/refresh')
        .send({ refreshToken: 'invalid-token' })
        .expect(401);

      expect(response.body).toMatchObject({
        success: false,
        message: expect.stringContaining('Invalid refresh token')
      });
    });

    it('should fail to refresh with missing refresh token', async () => {
      const response = await request(app)
        .post('/api/auth/refresh')
        .send({})
        .expect(400);

      expect(response.body).toMatchObject({
        success: false,
        message: expect.any(String)
      });
    });
  });

  describe('GET /api/auth/me', () => {
    let accessToken: string;
    let userId: string;

    beforeEach(async () => {
      // Register user and get access token
      const user = new User(validUser);
      await user.save();
      userId = user._id.toString();

      const loginResponse = await request(app)
        .post('/api/auth/login')
        .send(validLoginRequest);

      accessToken = loginResponse.body.data.token;
    });

    it('should get current user profile with valid token', async () => {
      const response = await request(app)
        .get('/api/auth/me')
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(200);

      expect(response.body).toMatchObject({
        success: true,
        data: {
          user: {
            _id: userId,
            email: validUser.email,
            role: validUser.role,
            profile: {
              name: validUser.profile.name
            }
          }
        }
      });

      // Should not include password
      expect(response.body.data.user.password).toBeUndefined();
    });

    it('should fail without authentication token', async () => {
      const response = await request(app)
        .get('/api/auth/me')
        .expect(401);

      expect(response.body).toMatchObject({
        success: false,
        message: expect.stringContaining('Authentication required')
      });
    });

    it('should fail with invalid token', async () => {
      const response = await request(app)
        .get('/api/auth/me')
        .set('Authorization', 'Bearer invalid-token')
        .expect(401);

      expect(response.body).toMatchObject({
        success: false,
        message: expect.stringContaining('Invalid token')
      });
    });

    it('should fail with malformed authorization header', async () => {
      const response = await request(app)
        .get('/api/auth/me')
        .set('Authorization', 'InvalidFormat token')
        .expect(401);

      expect(response.body).toMatchObject({
        success: false,
        message: expect.stringContaining('Authentication required')
      });
    });
  });
}); 