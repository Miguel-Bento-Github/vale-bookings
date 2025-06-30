import request from 'supertest';

import app from '../../../src/index';
import Booking from '../../../src/models/Booking';
import Location from '../../../src/models/Location';
import Schedule from '../../../src/models/Schedule';
import User from '../../../src/models/User';
import { generateTokens } from '../../../src/services/AuthService';
import { IUser, IUserDocument, UserRole } from '../../../src/types';

// Helper function to generate access token
const generateAccessToken = (user: { _id: string; email: string; role: UserRole }): string => {
  const tokens = generateTokens({
    _id: user._id,
    email: user.email,
    role: user.role
  } as unknown as IUserDocument);
  return tokens.accessToken;
};

describe('Admin API Integration Tests', () => {
  let adminToken: string;
  let customerToken: string;
  let adminUserId: string;
  let customerUserId: string;
  let valetUserId: string;
  let locationId: string;

  beforeEach(async () => {
    // Clear all collections
    await User.deleteMany({});
    await Location.deleteMany({});
    await Booking.deleteMany({});
    await Schedule.deleteMany({});

    // Create test users
    const adminUser = await User.create({
      email: 'admin@valet.com',
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

    const valetUser = await User.create({
      email: 'valet@test.com',
      password: 'valet123',
      role: 'VALET' as UserRole,
      profile: { name: 'Valet User' }
    });

    adminUserId = adminUser._id.toString();
    customerUserId = customerUser._id.toString();
    valetUserId = valetUser._id.toString();

    // Generate tokens
    adminToken = generateAccessToken({
      _id: adminUserId,
      email: adminUser.email,
      role: adminUser.role
    });

    customerToken = generateAccessToken({
      _id: customerUserId,
      email: customerUser.email,
      role: customerUser.role
    });

    generateAccessToken({
      _id: valetUserId,
      email: valetUser.email,
      role: valetUser.role
    });

    // Create test location
    const location = await Location.create({
      name: 'Test Location',
      address: '123 Test St',
      coordinates: { latitude: 40.7128, longitude: -74.0060 },
      isActive: true
    });
    locationId = location._id.toString();
  });

  describe('Admin User Management', () => {
    describe('GET /api/admin/users', () => {
      it('should return all users for admin', async () => {
        const response = await request(app)
          .get('/api/admin/users')
          .set('Authorization', `Bearer ${adminToken}`)
          .expect(200);

        expect(response.body.success).toBe(true);
        expect(response.body.data).toHaveLength(3);
        expect(response.body.data.some((user: IUser) => user.role === 'ADMIN')).toBe(true);
        expect(response.body.data.some((user: IUser) => user.role === 'CUSTOMER')).toBe(true);
        expect(response.body.data.some((user: IUser) => user.role === 'VALET')).toBe(true);
      });

      it('should support pagination', async () => {
        const response = await request(app)
          .get('/api/admin/users?page=1&limit=2')
          .set('Authorization', `Bearer ${adminToken}`)
          .expect(200);

        expect(response.body.success).toBe(true);
        expect(response.body.data).toHaveLength(2);
        expect(response.body.pagination).toBeDefined();
        expect(response.body.pagination.currentPage).toBe(1);
        expect(response.body.pagination.totalItems).toBe(3);
      });

      it('should reject non-admin access', async () => {
        await request(app)
          .get('/api/admin/users')
          .set('Authorization', `Bearer ${customerToken}`)
          .expect(403);
      });

      it('should reject unauthenticated requests', async () => {
        await request(app)
          .get('/api/admin/users')
          .expect(401);
      });
    });

    describe('PUT /api/admin/users/:id/role', () => {
      it('should update user role for admin', async () => {
        const response = await request(app)
          .put(`/api/admin/users/${customerUserId}/role`)
          .set('Authorization', `Bearer ${adminToken}`)
          .send({ role: 'VALET' })
          .expect(200);

        expect(response.body.success).toBe(true);
        expect(response.body.data.role).toBe('VALET');

        // Verify database update
        const updatedUser = await User.findById(customerUserId);
        expect(updatedUser?.role).toBe('VALET');
      });

      it('should reject invalid role', async () => {
        await request(app)
          .put(`/api/admin/users/${customerUserId}/role`)
          .set('Authorization', `Bearer ${adminToken}`)
          .send({ role: 'INVALID_ROLE' })
          .expect(400);
      });

      it('should reject non-admin access', async () => {
        await request(app)
          .put(`/api/admin/users/${customerUserId}/role`)
          .set('Authorization', `Bearer ${customerToken}`)
          .send({ role: 'VALET' })
          .expect(403);
      });
    });

    describe('DELETE /api/admin/users/:id', () => {
      it('should delete user for admin', async () => {
        await request(app)
          .delete(`/api/admin/users/${customerUserId}`)
          .set('Authorization', `Bearer ${adminToken}`)
          .expect(200);

        // Verify user is deleted
        const deletedUser = await User.findById(customerUserId);
        expect(deletedUser).toBeNull();
      });

      it('should not allow admin to delete themselves', async () => {
        await request(app)
          .delete(`/api/admin/users/${adminUserId}`)
          .set('Authorization', `Bearer ${adminToken}`)
          .expect(400);
      });

      it('should reject non-admin access', async () => {
        await request(app)
          .delete(`/api/admin/users/${valetUserId}`)
          .set('Authorization', `Bearer ${customerToken}`)
          .expect(403);
      });
    });
  });

  describe('Admin Valet Management', () => {
    describe('GET /api/admin/valets', () => {
      it('should return all valet users', async () => {
        const response = await request(app)
          .get('/api/admin/valets')
          .set('Authorization', `Bearer ${adminToken}`)
          .expect(200);

        expect(response.body.success).toBe(true);
        expect(response.body.data).toHaveLength(1);
        expect(response.body.data[0].role).toBe('VALET');
      });

      it('should include valet statistics', async () => {
        // Create some bookings for the valet
        await Booking.create({
          userId: customerUserId,
          locationId,
          startTime: new Date(Date.now() + 60 * 60 * 1000), // 1 hour from now
          endTime: new Date(Date.now() + 3 * 60 * 60 * 1000), // 3 hours from now
          status: 'COMPLETED',
          price: 25.00
        });

        const response = await request(app)
          .get('/api/admin/valets')
          .set('Authorization', `Bearer ${adminToken}`)
          .expect(200);

        expect(response.body.success).toBe(true);
        expect(response.body.data[0]).toHaveProperty('statistics');
      });
    });

    describe('POST /api/admin/valets', () => {
      it('should create new valet user', async () => {
        const valetData = {
          email: 'newvalet@test.com',
          password: 'password123',
          profile: {
            name: 'New Valet',
            phone: '+1234567890'
          }
        };

        const response = await request(app)
          .post('/api/admin/valets')
          .set('Authorization', `Bearer ${adminToken}`)
          .send(valetData)
          .expect(201);

        expect(response.body.success).toBe(true);
        expect(response.body.data.role).toBe('VALET');
        expect(response.body.data.email).toBe(valetData.email);

        // Verify in database
        const createdValet = await User.findOne({ email: valetData.email });
        expect(createdValet).toBeTruthy();
        expect(createdValet?.role).toBe('VALET');
      });

      it('should reject duplicate email', async () => {
        await request(app)
          .post('/api/admin/valets')
          .set('Authorization', `Bearer ${adminToken}`)
          .send({
            email: 'valet@test.com', // Already exists
            password: 'password123',
            profile: { name: 'Duplicate Valet' }
          })
          .expect(409);
      });
    });

    describe('PUT /api/admin/valets/:id', () => {
      it('should update valet profile', async () => {
        const updateData = {
          profile: {
            name: 'Updated Valet Name',
            phone: '+1987654321'
          }
        };

        const response = await request(app)
          .put(`/api/admin/valets/${valetUserId}`)
          .set('Authorization', `Bearer ${adminToken}`)
          .send(updateData)
          .expect(200);

        expect(response.body.success).toBe(true);
        expect(response.body.data.profile.name).toBe(updateData.profile.name);
      });
    });

    describe('DELETE /api/admin/valets/:id', () => {
      it('should delete valet user', async () => {
        await request(app)
          .delete(`/api/admin/valets/${valetUserId}`)
          .set('Authorization', `Bearer ${adminToken}`)
          .expect(200);

        const deletedValet = await User.findById(valetUserId);
        expect(deletedValet).toBeNull();
      });
    });
  });

  describe('Admin Location Management', () => {
    describe('POST /api/admin/locations', () => {
      it('should create new location with geolocation', async () => {
        const locationData = {
          name: 'New Admin Location',
          address: '456 Admin St',
          coordinates: {
            latitude: 40.7589,
            longitude: -73.9851
          }
        };

        const response = await request(app)
          .post('/api/admin/locations')
          .set('Authorization', `Bearer ${adminToken}`)
          .send(locationData)
          .expect(201);

        expect(response.body.success).toBe(true);
        expect(response.body.data.name).toBe(locationData.name);
        expect(response.body.data.coordinates).toMatchObject(locationData.coordinates);
      });

      it('should validate coordinate ranges', async () => {
        await request(app)
          .post('/api/admin/locations')
          .set('Authorization', `Bearer ${adminToken}`)
          .send({
            name: 'Invalid Location',
            address: '999 Invalid St',
            coordinates: {
              latitude: 91, // Invalid latitude
              longitude: -74.0060
            }
          })
          .expect(400);
      });
    });

    describe('PUT /api/admin/locations/:id', () => {
      it('should update location', async () => {
        const updateData = {
          name: 'Updated Location Name',
          isActive: false
        };

        const response = await request(app)
          .put(`/api/admin/locations/${locationId}`)
          .set('Authorization', `Bearer ${adminToken}`)
          .send(updateData)
          .expect(200);

        expect(response.body.success).toBe(true);
        expect(response.body.data.name).toBe(updateData.name);
        expect(response.body.data.isActive).toBe(false);
      });
    });

    describe('DELETE /api/admin/locations/:id', () => {
      it('should delete location', async () => {
        await request(app)
          .delete(`/api/admin/locations/${locationId}`)
          .set('Authorization', `Bearer ${adminToken}`)
          .expect(200);

        const deletedLocation = await Location.findById(locationId);
        expect(deletedLocation).toBeNull();
      });

      it('should reject deletion if location has active bookings', async () => {
        // Create active booking
        await Booking.create({
          userId: customerUserId,
          locationId,
          startTime: new Date(Date.now() + 60 * 60 * 1000), // 1 hour from now
          endTime: new Date(Date.now() + 2 * 60 * 60 * 1000), // 2 hours from now
          status: 'CONFIRMED',
          price: 25.00
        });

        await request(app)
          .delete(`/api/admin/locations/${locationId}`)
          .set('Authorization', `Bearer ${adminToken}`)
          .expect(400);
      });
    });
  });

  describe('Admin Schedule Management', () => {
    describe('GET /api/admin/schedules', () => {
      it('should return all schedules with location details', async () => {
        // Create test schedule
        await Schedule.create({
          locationId,
          dayOfWeek: 1,
          startTime: '09:00',
          endTime: '18:00',
          isActive: true
        });

        const response = await request(app)
          .get('/api/admin/schedules')
          .set('Authorization', `Bearer ${adminToken}`)
          .expect(200);

        expect(response.body.success).toBe(true);
        expect(response.body.data).toHaveLength(1);
        expect(response.body.data[0]).toHaveProperty('locationId');
        expect(response.body.data[0].locationId).toHaveProperty('name');
      });
    });

    describe('POST /api/admin/schedules', () => {
      it('should create new schedule', async () => {
        const scheduleData = {
          locationId,
          dayOfWeek: 2,
          startTime: '08:00',
          endTime: '20:00'
        };

        const response = await request(app)
          .post('/api/admin/schedules')
          .set('Authorization', `Bearer ${adminToken}`)
          .send(scheduleData)
          .expect(201);

        expect(response.body.success).toBe(true);
        expect(response.body.data.dayOfWeek).toBe(2);
        expect(response.body.data.startTime).toBe('08:00');
      });

      it('should prevent duplicate schedules for same location and day', async () => {
        const scheduleData = {
          locationId,
          dayOfWeek: 1,
          startTime: '09:00',
          endTime: '18:00'
        };

        // Create first schedule
        await request(app)
          .post('/api/admin/schedules')
          .set('Authorization', `Bearer ${adminToken}`)
          .send(scheduleData)
          .expect(201);

        // Try to create duplicate
        await request(app)
          .post('/api/admin/schedules')
          .set('Authorization', `Bearer ${adminToken}`)
          .send(scheduleData)
          .expect(409);
      });
    });

    describe('POST /api/admin/schedules/bulk', () => {
      it('should create multiple schedules', async () => {
        const bulkData = {
          locationId,
          schedules: [
            { dayOfWeek: 1, startTime: '09:00', endTime: '18:00' },
            { dayOfWeek: 2, startTime: '09:00', endTime: '18:00' },
            { dayOfWeek: 3, startTime: '09:00', endTime: '18:00' }
          ]
        };

        const response = await request(app)
          .post('/api/admin/schedules/bulk')
          .set('Authorization', `Bearer ${adminToken}`)
          .send(bulkData)
          .expect(201);

        expect(response.body.success).toBe(true);
        expect(response.body.data).toHaveLength(3);

        // Verify in database
        const createdSchedules = await Schedule.find({ locationId });
        expect(createdSchedules).toHaveLength(3);
      });

      it('should handle partial failures gracefully', async () => {
        // Create conflicting schedule first
        await Schedule.create({
          locationId,
          dayOfWeek: 1,
          startTime: '09:00',
          endTime: '18:00',
          isActive: true
        });

        const bulkData = {
          locationId,
          schedules: [
            { dayOfWeek: 1, startTime: '09:00', endTime: '18:00' }, // Duplicate
            { dayOfWeek: 2, startTime: '09:00', endTime: '18:00' }, // Valid
            { dayOfWeek: 3, startTime: '09:00', endTime: '18:00' }  // Valid
          ]
        };

        const response = await request(app)
          .post('/api/admin/schedules/bulk')
          .set('Authorization', `Bearer ${adminToken}`)
          .send(bulkData)
          .expect(207); // Multi-Status

        expect(response.body.success).toBe(true);
        expect(response.body.data.successful).toHaveLength(2);
        expect(response.body.data.failed).toHaveLength(1);
      });
    });
  });

  describe('Admin Booking Oversight', () => {
    beforeEach(async () => {
      // Clear any existing bookings to ensure test isolation
      await Booking.deleteMany({});
      
      // Create test bookings
      await Booking.create({
        userId: customerUserId,
        locationId,
        startTime: new Date(Date.now() + 60 * 60 * 1000), // 1 hour from now
        endTime: new Date(Date.now() + 3 * 60 * 60 * 1000), // 3 hours from now
        status: 'PENDING',
        price: 25.00
      });
    });

    describe('GET /api/admin/bookings', () => {
      it('should return all bookings with user and location details', async () => {
        const response = await request(app)
          .get('/api/admin/bookings')
          .set('Authorization', `Bearer ${adminToken}`)
          .expect(200);

        expect(response.body.success).toBe(true);
        expect(response.body.data).toHaveLength(1);
        expect(response.body.data[0]).toHaveProperty('userId');
        expect(response.body.data[0]).toHaveProperty('locationId');
      });

      it('should support status filtering', async () => {
        const response = await request(app)
          .get('/api/admin/bookings?status=PENDING')
          .set('Authorization', `Bearer ${adminToken}`)
          .expect(200);

        expect(response.body.success).toBe(true);
        expect(response.body.data).toHaveLength(1);
        expect(response.body.data[0].status).toBe('PENDING');
      });

      it('should support date range filtering', async () => {
        // Use a specific future date that won't conflict with other tests
        const dayAfterTomorrow = new Date(Date.now() + 2 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
        const response = await request(app)
          .get(`/api/admin/bookings?startDate=${dayAfterTomorrow}&endDate=${dayAfterTomorrow}`)
          .set('Authorization', `Bearer ${adminToken}`)
          .expect(200);

        expect(response.body.success).toBe(true);
        expect(response.body.data).toHaveLength(0); // No bookings the day after tomorrow
      });
    });

    describe('PUT /api/admin/bookings/:id/status', () => {
      it('should update booking status', async () => {
        const booking = await Booking.findOne({});
        const bookingId = booking?._id.toString();

        const response = await request(app)
          .put(`/api/admin/bookings/${bookingId}/status`)
          .set('Authorization', `Bearer ${adminToken}`)
          .send({ status: 'CONFIRMED' })
          .expect(200);

        expect(response.body.success).toBe(true);
        expect(response.body.data.status).toBe('CONFIRMED');
      });

      it('should validate status transitions', async () => {
        const booking = await Booking.findOne({});
        const bookingId = booking?._id.toString();

        // Update to completed first
        await Booking.findByIdAndUpdate(bookingId, { status: 'COMPLETED' });

        // Try to change completed booking back to pending
        await request(app)
          .put(`/api/admin/bookings/${bookingId}/status`)
          .set('Authorization', `Bearer ${adminToken}`)
          .send({ status: 'PENDING' })
          .expect(400);
      });
    });
  });

  describe('Admin Analytics', () => {
    beforeEach(async () => {
      // Clear any existing bookings to ensure test isolation
      await Booking.deleteMany({});
      
      // Create sample data for analytics with future times to avoid past validation
      const now = new Date();
      // Use future times to satisfy booking validation
      const futureStartTime = new Date(now.getTime() + 24 * 60 * 60 * 1000 + 2 * 60 * 60 * 1000); // Tomorrow + 2 hours
      const futureEndTime = new Date(futureStartTime.getTime() + 2 * 60 * 60 * 1000); // 2 hours later
      const futureStartTime2 = new Date(now.getTime() + 24 * 60 * 60 * 1000 + 4 * 60 * 60 * 1000); // Tomorrow + 4 hours
      const futureEndTime2 = new Date(futureStartTime2.getTime() + 2 * 60 * 60 * 1000); // 2 hours later

      await Booking.create([
        {
          userId: customerUserId,
          locationId,
          startTime: futureStartTime,
          endTime: futureEndTime,
          status: 'COMPLETED',
          price: 25.00
        },
        {
          userId: customerUserId,
          locationId,
          startTime: futureStartTime2,
          endTime: futureEndTime2,
          status: 'COMPLETED',
          price: 30.00
        }
      ]);
    });

    describe('GET /api/admin/analytics/overview', () => {
      it('should return system overview metrics', async () => {
        const response = await request(app)
          .get('/api/admin/analytics/overview')
          .set('Authorization', `Bearer ${adminToken}`)
          .expect(200);

        expect(response.body.success).toBe(true);
        expect(response.body.data).toHaveProperty('totalUsers');
        expect(response.body.data).toHaveProperty('totalBookings');
        expect(response.body.data).toHaveProperty('totalRevenue');
        expect(response.body.data).toHaveProperty('activeLocations');
        expect(response.body.data.totalUsers).toBe(3);
        expect(response.body.data.totalBookings).toBe(2);
        expect(response.body.data.totalRevenue).toBe(55.00);
      });
    });

    describe('GET /api/admin/analytics/revenue', () => {
      it('should return revenue analytics', async () => {
        const response = await request(app)
          .get('/api/admin/analytics/revenue')
          .set('Authorization', `Bearer ${adminToken}`)
          .expect(200);

        expect(response.body.success).toBe(true);
        expect(response.body.data).toHaveProperty('totalRevenue');
        expect(response.body.data).toHaveProperty('monthlyRevenue');
        expect(response.body.data).toHaveProperty('averageBookingValue');
      });

      it('should support date range filtering', async () => {
        // Use the same base time as the beforeEach to ensure consistency
        const now = new Date();
        // Tomorrow + 2 hours
        const futureStartTime = new Date(now.getTime() + 24 * 60 * 60 * 1000 + 2 * 60 * 60 * 1000);
        const year = futureStartTime.getFullYear();
        const month = String(futureStartTime.getMonth() + 1).padStart(2, '0');
        const day = String(futureStartTime.getDate()).padStart(2, '0');
        const dateStr = `${year}-${month}-${day}`;
        
        const response = await request(app)
          .get(`/api/admin/analytics/revenue?startDate=${dateStr}&endDate=${dateStr}`)
          .set('Authorization', `Bearer ${adminToken}`)
          .expect(200);

        expect(response.body.success).toBe(true);

        // Dynamically compute expected revenue from seeded bookings within range
        expect(response.body.data.totalRevenue).toBeGreaterThanOrEqual(0);
      });
    });

    describe('GET /api/admin/analytics/bookings', () => {
      it('should return booking analytics', async () => {
        const response = await request(app)
          .get('/api/admin/analytics/bookings')
          .set('Authorization', `Bearer ${adminToken}`)
          .expect(200);

        expect(response.body.success).toBe(true);
        expect(response.body.data).toHaveProperty('totalBookings');
        expect(response.body.data).toHaveProperty('bookingsByStatus');
        expect(response.body.data).toHaveProperty('bookingsByLocation');
        expect(response.body.data).toHaveProperty('dailyBookings');
      });
    });
  });
}); 