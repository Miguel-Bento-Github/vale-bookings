import { Application } from 'express';
import request from 'supertest';


import User from '../../src/models/User';
import {
  validUser,
  adminUser
} from '../fixtures';

import createTestApp from './testApp';

describe('Users Integration Tests', () => {
  let app: Application;
  let userToken: string;
  let adminToken: string;
  let userId: string;
  let adminId: string;

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
  });

  describe('GET /api/users/profile', () => {
    it('should get user profile with authentication', async () => {
      const response = await request(app)
        .get('/api/users/profile')
        .set('Authorization', `Bearer ${userToken}`)
        .expect(200);

      expect(response.body).toMatchObject({
        success: true,
        data: {
          _id: userId,
          email: validUser.email,
          role: validUser.role,
          profile: {
            name: validUser.profile.name,
            phone: validUser.profile.phone
          }
        }
      });

      // Should not include password
      expect(response.body.data.password).toBeUndefined();
    });

    it('should fail to get profile without authentication', async () => {
      const response = await request(app)
        .get('/api/users/profile')
        .expect(401);

      expect(response.body).toMatchObject({
        success: false,
        message: expect.stringContaining('Authentication required')
      });
    });

    it('should fail with invalid token', async () => {
      const response = await request(app)
        .get('/api/users/profile')
        .set('Authorization', 'Bearer invalid-token')
        .expect(401);

      expect(response.body).toMatchObject({
        success: false,
        message: expect.stringContaining('Invalid token')
      });
    });

    it('should get admin profile correctly', async () => {
      const response = await request(app)
        .get('/api/users/profile')
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      expect(response.body.data.role).toBe('ADMIN');
      expect(response.body.data.email).toBe(adminUser.email);
    });
  });

  describe('PUT /api/users/profile', () => {
    it('should update user profile successfully', async () => {
      const updateData = {
        profile: {
          name: 'Updated Name',
          phone: '+1999888777'
        }
      };

      const response = await request(app)
        .put('/api/users/profile')
        .set('Authorization', `Bearer ${userToken}`)
        .send(updateData)
        .expect(200);

      expect(response.body).toMatchObject({
        success: true,
        message: 'Profile updated successfully',
        data: {
          _id: userId,
          email: validUser.email,
          profile: {
            name: updateData.profile.name,
            phone: updateData.profile.phone
          }
        }
      });

      // Verify profile was updated in database
      const user = await User.findById(userId);
      expect(user?.profile.name).toBe(updateData.profile.name);
      expect(user?.profile.phone).toBe(updateData.profile.phone);
    });

    it('should update only provided fields', async () => {
      const updateData = {
        profile: {
          name: 'Only Name Updated'
        }
      };

      const response = await request(app)
        .put('/api/users/profile')
        .set('Authorization', `Bearer ${userToken}`)
        .send(updateData)
        .expect(200);

      expect(response.body.data.profile.name).toBe(updateData.profile.name);
      expect(response.body.data.profile.phone).toBe(validUser.profile.phone); // Should remain unchanged
    });

    it('should fail to update profile without authentication', async () => {
      const response = await request(app)
        .put('/api/users/profile')
        .send({ profile: { name: 'New Name' } })
        .expect(401);

      expect(response.body).toMatchObject({
        success: false,
        message: expect.stringContaining('Authentication required')
      });
    });

    it('should fail with invalid profile data', async () => {
      const invalidData = {
        profile: {
          name: '', // Empty name should fail validation
          phone: 'invalid-phone-format'
        }
      };

      const response = await request(app)
        .put('/api/users/profile')
        .set('Authorization', `Bearer ${userToken}`)
        .send(invalidData)
        .expect(400);

      expect(response.body).toMatchObject({
        success: false,
        message: expect.any(String)
      });
    });

    it('should fail when trying to update email or role', async () => {
      const invalidData = {
        email: 'newemail@example.com',
        role: 'ADMIN',
        profile: {
          name: 'Updated Name'
        }
      };

      const response = await request(app)
        .put('/api/users/profile')
        .set('Authorization', `Bearer ${userToken}`)
        .send(invalidData)
        .expect(400);

      expect(response.body).toMatchObject({
        success: false,
        message: expect.stringContaining('not allowed')
      });
    });

    it('should validate phone number format', async () => {
      const invalidPhoneData = {
        profile: {
          phone: 'not-a-phone-number'
        }
      };

      const response = await request(app)
        .put('/api/users/profile')
        .set('Authorization', `Bearer ${userToken}`)
        .send(invalidPhoneData)
        .expect(400);

      expect(response.body).toMatchObject({
        success: false,
        message: expect.stringContaining('phone')
      });
    });
  });

  describe('DELETE /api/users/profile', () => {
    it('should delete user account successfully', async () => {
      const response = await request(app)
        .delete('/api/users/profile')
        .set('Authorization', `Bearer ${userToken}`)
        .expect(200);

      expect(response.body).toMatchObject({
        success: true,
        message: 'Account deleted successfully'
      });

      // Verify user was deleted from database
      const user = await User.findById(userId);
      expect(user).toBeNull();
    });

    it('should fail to delete account without authentication', async () => {
      const response = await request(app)
        .delete('/api/users/profile')
        .expect(401);

      expect(response.body).toMatchObject({
        success: false,
        message: expect.stringContaining('Authentication required')
      });
    });

    it('should allow admin to delete their own account', async () => {
      const response = await request(app)
        .delete('/api/users/profile')
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      expect(response.body).toMatchObject({
        success: true,
        message: 'Account deleted successfully'
      });

      // Verify admin was deleted from database
      const admin = await User.findById(adminId);
      expect(admin).toBeNull();
    });

    it('should fail with invalid token', async () => {
      const response = await request(app)
        .delete('/api/users/profile')
        .set('Authorization', 'Bearer invalid-token')
        .expect(401);

      expect(response.body).toMatchObject({
        success: false,
        message: expect.stringContaining('Invalid token')
      });
    });

    it('should handle deletion of already deleted user gracefully', async () => {
      // First deletion
      await request(app)
        .delete('/api/users/profile')
        .set('Authorization', `Bearer ${userToken}`)
        .expect(200);

      // Second deletion attempt should fail
      const response = await request(app)
        .delete('/api/users/profile')
        .set('Authorization', `Bearer ${userToken}`)
        .expect(401); // Token should be invalid after user deletion

      expect(response.body).toMatchObject({
        success: false,
        message: expect.any(String)
      });
    });
  });

  describe('Authentication Edge Cases', () => {
    it('should handle malformed Authorization header', async () => {
      const response = await request(app)
        .get('/api/users/profile')
        .set('Authorization', 'InvalidFormat')
        .expect(401);

      expect(response.body).toMatchObject({
        success: false,
        message: expect.any(String)
      });
    });

    it('should handle missing Bearer prefix', async () => {
      const response = await request(app)
        .get('/api/users/profile')
        .set('Authorization', userToken)
        .expect(401);

      expect(response.body).toMatchObject({
        success: false,
        message: expect.any(String)
      });
    });

    it('should handle expired token gracefully', async () => {
      // This would require mocking JWT expiration or using a pre-expired token
      // For now, we'll test with an obviously invalid token
      const expiredToken = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxMjM0NTY3ODkwIiwibmFtZSI6IkpvaG4gRG9lIiwiaWF0IjoxNTE2MjM5MDIyfQ.SflKxwRJSMeKKF2QT4fwpMeJf36POk6yJV_adQssw5c';
      
      const response = await request(app)
        .get('/api/users/profile')
        .set('Authorization', `Bearer ${expiredToken}`)
        .expect(401);

      expect(response.body).toMatchObject({
        success: false,
        message: expect.any(String)
      });
    });
  });
}); 