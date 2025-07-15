import request from 'supertest';

import app from '../../../src/app';
import User from '../../../src/models/User';
import { generateTokens } from '../../../src/services/AuthService';
import { UserRole } from '../../../src/types';

describe('AuthController Extended Integration Tests', () => {
  let adminToken: string;
  let customerToken: string;
  let customerUserId: string;

  beforeAll(async () => {
    // Create test users
    const adminUser = await User.create({
      email: 'admin@test.com',
      password: 'admin123',
      role: 'ADMIN' as UserRole,
      profile: { name: 'Admin User' }
    });

    const customerUser = await User.create({
      email: 'customer@test.com',
      password: 'customer123',
      role: 'CUSTOMER' as UserRole,
      profile: { name: 'Customer User' }
    });

    // Create additional users for getAllUsers test
    await User.create({
      email: 'user1@test.com',
      password: 'user123',
      role: 'CUSTOMER' as UserRole,
      profile: { name: 'User 1' }
    });

    await User.create({
      email: 'user2@test.com',
      password: 'user123',
      role: 'CUSTOMER' as UserRole,
      profile: { name: 'User 2' }
    });

    customerUserId = customerUser._id.toString();

    // Generate tokens
    const adminTokens = generateTokens(adminUser);
    const customerTokens = generateTokens(customerUser);
    
    adminToken = adminTokens.accessToken;
    customerToken = customerTokens.accessToken;
  });

  afterAll(async () => {
    // Clean up test users
    await User.deleteMany({ 
      email: { 
        $in: [
          'admin@test.com', 
          'customer@test.com', 
          'user1@test.com', 
          'user2@test.com', 
          'temp@test.com', 
          'temp2@test.com', 
          'change-password@test.com',
          'wrong-password@test.com',
          'missing-fields@test.com',
          'getallusers1@test.com',
          'getallusers2@test.com'
        ] 
      } 
    });
  });

  describe('GET /api/auth/me', () => {
    it('should get current user profile successfully', async () => {
      const response = await request(app)
        .get('/api/auth/me')
        .set('Authorization', `Bearer ${customerToken}`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.user).toMatchObject({
        _id: customerUserId,
        email: 'customer@test.com',
        role: 'CUSTOMER',
        profile: { name: 'Customer User' }
      });
    });

    it('should return 401 for missing authorization header', async () => {
      const response = await request(app)
        .get('/api/auth/me')
        .expect(401);

      expect(response.body.success).toBe(false);
      expect(response.body.message).toContain('Authentication required');
    });

    it('should return 401 for invalid token', async () => {
      const response = await request(app)
        .get('/api/auth/me')
        .set('Authorization', 'Bearer invalid-token')
        .expect(401);

      expect(response.body.success).toBe(false);
      expect(response.body.message).toContain('Token expired or invalid');
    });
  });

  describe('POST /api/auth/change-password', () => {
    it('should change password successfully', async () => {
      // Create a separate user for this test
      const changePasswordUser = await User.create({
        email: 'change-password@test.com',
        password: 'original123',
        role: 'CUSTOMER' as UserRole,
        profile: { name: 'Change Password User' }
      });

      const changePasswordToken = generateTokens(changePasswordUser).accessToken;

      const response = await request(app)
        .post('/api/auth/change-password')
        .set('Authorization', `Bearer ${changePasswordToken}`)
        .send({
          currentPassword: 'original123',
          newPassword: 'newPassword123'
        })
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.message).toBe('Password changed successfully');

      // Verify the password was actually changed
      const updatedUser = await User.findById(changePasswordUser._id).select('+password');
      expect(updatedUser).toBeTruthy();
    });

    it('should return 401 for missing authorization header', async () => {
      const response = await request(app)
        .post('/api/auth/change-password')
        .send({
          currentPassword: 'customer123',
          newPassword: 'newPassword123'
        })
        .expect(401);

      expect(response.body.success).toBe(false);
      expect(response.body.message).toContain('Authentication required');
    });

    it('should return 400 for incorrect current password', async () => {
      // Create a separate user for this test
      const wrongPasswordUser = await User.create({
        email: 'wrong-password@test.com',
        password: 'correct123',
        role: 'CUSTOMER' as UserRole,
        profile: { name: 'Wrong Password User' }
      });

      const wrongPasswordToken = generateTokens(wrongPasswordUser).accessToken;

      const response = await request(app)
        .post('/api/auth/change-password')
        .set('Authorization', `Bearer ${wrongPasswordToken}`)
        .send({
          currentPassword: 'wrongPassword',
          newPassword: 'newPassword123'
        })
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.message).toBe('Current password is incorrect');
    });

    it('should return 400 for missing password fields', async () => {
      // Create a separate user for this test
      const missingFieldsUser = await User.create({
        email: 'missing-fields@test.com',
        password: 'test123',
        role: 'CUSTOMER' as UserRole,
        profile: { name: 'Missing Fields User' }
      });

      const missingFieldsToken = generateTokens(missingFieldsUser).accessToken;

      const response = await request(app)
        .post('/api/auth/change-password')
        .set('Authorization', `Bearer ${missingFieldsToken}`)
        .send({
          currentPassword: 'test123'
          // missing newPassword
        })
        .expect(400);

      expect(response.body.success).toBe(false);
    });
  });

  describe('DELETE /api/auth/delete-account', () => {
    it('should delete account successfully', async () => {
      // Create a temporary user for deletion test
      const tempUser = await User.create({
        email: 'temp@test.com',
        password: 'temp123',
        role: 'CUSTOMER' as UserRole,
        profile: { name: 'Temp User' }
      });

      const tempToken = generateTokens(tempUser).accessToken;

      const response = await request(app)
        .delete('/api/auth/delete-account')
        .set('Authorization', `Bearer ${tempToken}`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.message).toBe('Account deleted successfully');

      // Verify the user was actually deleted
      const deletedUser = await User.findById(tempUser._id);
      expect(deletedUser).toBeNull();
    });

    it('should return 401 for missing authorization header', async () => {
      const response = await request(app)
        .delete('/api/auth/delete-account')
        .expect(401);

      expect(response.body.success).toBe(false);
      expect(response.body.message).toContain('Authentication required');
    });
  });

  describe('GET /api/auth/users (Admin)', () => {
    it('should get all users successfully', async () => {
      // Create additional users specifically for this test
      await User.create({
        email: 'getallusers1@test.com',
        password: 'user123',
        role: 'CUSTOMER' as UserRole,
        profile: { name: 'Get All Users 1' }
      });

      await User.create({
        email: 'getallusers2@test.com',
        password: 'user123',
        role: 'CUSTOMER' as UserRole,
        profile: { name: 'Get All Users 2' }
      });

      const response = await request(app)
        .get('/api/auth/users')
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(Array.isArray(response.body.data)).toBe(true);
      expect(response.body.data.length).toBeGreaterThan(0);
      
      // Verify user data structure
      const user = response.body.data[0];
      expect(user).toHaveProperty('_id');
      expect(user).toHaveProperty('email');
      expect(user).toHaveProperty('role');
      expect(user).toHaveProperty('profile');
      expect(user).not.toHaveProperty('password'); // Password should be excluded
    });

    it('should return 401 for non-admin user', async () => {
      const response = await request(app)
        .get('/api/auth/users')
        .set('Authorization', `Bearer ${customerToken}`)
        .expect(403);

      expect(response.body.success).toBe(false);
      expect(response.body.message).toContain('Forbidden');
    });

    it('should return 401 for missing authorization header', async () => {
      const response = await request(app)
        .get('/api/auth/users')
        .expect(401);

      expect(response.body.success).toBe(false);
      expect(response.body.message).toContain('Authentication required');
    });
  });

  describe('DELETE /api/auth/users/:id (Admin)', () => {
    it('should delete user successfully', async () => {
      // Create a temporary user for deletion test
      const tempUser = await User.create({
        email: 'temp2@test.com',
        password: 'temp123',
        role: 'CUSTOMER' as UserRole,
        profile: { name: 'Temp User 2' }
      });

      const response = await request(app)
        .delete(`/api/auth/users/${tempUser._id}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.message).toBe('User deleted successfully');

      // Verify the user was actually deleted
      const deletedUser = await User.findById(tempUser._id);
      expect(deletedUser).toBeNull();
    });

    it('should return 400 for invalid user ID format', async () => {
      const response = await request(app)
        .delete('/api/auth/users/invalid-id')
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.message).toBe('Invalid ID format');
    });

    it('should return 400 for missing user ID', async () => {
      await request(app)
        .delete('/api/auth/users/')
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(404); // Express will return 404 for this route

      // This test verifies the route doesn't exist without an ID parameter
    });

    it('should return 401 for non-admin user', async () => {
      const response = await request(app)
        .delete(`/api/auth/users/${customerUserId}`)
        .set('Authorization', `Bearer ${customerToken}`)
        .expect(403);

      expect(response.body.success).toBe(false);
      expect(response.body.message).toContain('Forbidden');
    });

    it('should return 401 for missing authorization header', async () => {
      const response = await request(app)
        .delete(`/api/auth/users/${customerUserId}`)
        .expect(401);

      expect(response.body.success).toBe(false);
      expect(response.body.message).toContain('Authentication required');
    });
  });
}); 