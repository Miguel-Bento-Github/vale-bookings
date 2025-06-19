import Booking from '../../../src/models/Booking';
import Location from '../../../src/models/Location';
import User from '../../../src/models/User';
import * as BookingService from '../../../src/services/BookingService';
import * as LocationService from '../../../src/services/LocationService';
import * as UserService from '../../../src/services/UserService';

// Suppress console output during tests
beforeAll(() => {
  jest.spyOn(console, 'log').mockImplementation(() => { });
});

afterAll(() => {
  jest.restoreAllMocks();
});

describe('Simple Coverage Boost Tests', () => {
  afterEach(async () => {
    await User.deleteMany({});
    await Location.deleteMany({});
    await Booking.deleteMany({});
  });

  describe('Utility Functions Coverage', () => {
    it('should calculate distance correctly', async () => {
      // Create multiple test locations at known distances
      await LocationService.createLocation({
        name: 'NYC Location',
        address: '123 NYC St',
        coordinates: { latitude: 40.7128, longitude: -74.0060 },
        isActive: true
      });
      await LocationService.createLocation({
        name: 'Nearby Location',
        address: '456 Nearby St',
        coordinates: { latitude: 40.7589, longitude: -73.9851 }, // ~7km away
        isActive: true
      });

      const locationsWithDistance = await LocationService.getLocationsWithDistance(
        40.7128, -74.0060, 50
      );

      expect(locationsWithDistance.length).toBeGreaterThan(0);
      expect(locationsWithDistance[0]).toHaveProperty('distance');
      expect(typeof locationsWithDistance[0]?.distance).toBe('number');
    });

    it('should handle edge cases in coordinate calculations', async () => {
      // Test with extreme coordinates
      const locations = await LocationService.findNearby(0, 0, 10);
      expect(Array.isArray(locations)).toBe(true);

      // Test with very small radius
      const smallRadius = await LocationService.findNearby(40.7128, -74.0060, 0.1);
      expect(Array.isArray(smallRadius)).toBe(true);
    });

    it('should handle coordinate boundary cases', async () => {
      // Test with coordinate bounds
      const boundaryLocations = await LocationService.getLocationsByCoordinates(
        -90, 90, -180, 180
      );
      expect(Array.isArray(boundaryLocations)).toBe(true);

      // Test with inverted bounds (should return empty)
      const invertedBounds = await LocationService.getLocationsByCoordinates(
        90, -90, 180, -180
      );
      expect(invertedBounds).toEqual([]);
    });
  });

  describe('Service Method Edge Cases', () => {
    it('should handle location update with partial data', async () => {
      const location = await LocationService.createLocation({
        name: 'Test Location',
        address: '123 Test St',
        coordinates: { latitude: 40.7128, longitude: -74.0060 },
        isActive: true
      });

      // Update only the name
      const updated = await LocationService.updateLocation(
        String(location._id),
        { name: 'Updated Location' }
      );

      expect(updated?.name).toBe('Updated Location');
      expect(updated?.address).toBe('123 Test St'); // Should remain unchanged
    });

    it('should handle location deactivation', async () => {
      const location = await LocationService.createLocation({
        name: 'Test Location',
        address: '123 Test St',
        coordinates: { latitude: 40.7128, longitude: -74.0060 },
        isActive: true
      });

      const deactivated = await LocationService.deactivateLocation(String(location._id));
      expect(deactivated?.isActive).toBe(false);
    });

    it('should handle user role updates', async () => {
      const user = await UserService.createUser({
        email: 'test@example.com',
        password: 'password123',
        role: 'CUSTOMER',
        profile: {
          name: 'Test User',
          phone: '+1234567890'
        }
      });

      const updated = await UserService.updateUserRole(String(user._id), 'VALET');
      expect(updated?.role).toBe('VALET');
    });

    it('should handle user profile updates', async () => {
      const user = await UserService.createUser({
        email: 'test@example.com',
        password: 'password123',
        role: 'CUSTOMER',
        profile: {
          name: 'Test User',
          phone: '+1234567890'
        }
      });

      const updated = await UserService.updateProfile(String(user._id), {
        profile: {
          name: 'Updated User',
          phone: '+9876543210'
        }
      });

      expect(updated?.profile.name).toBe('Updated User');
      expect(updated?.profile.phone).toBe('+9876543210');
    });

    it('should handle booking status updates', async () => {
      const user = await UserService.createUser({
        email: 'test@example.com',
        password: 'password123',
        role: 'CUSTOMER',
        profile: {
          name: 'Test User',
          phone: '+1234567890'
        }
      });

      const location = await LocationService.createLocation({
        name: 'Test Location',
        address: '123 Test St',
        coordinates: { latitude: 40.7128, longitude: -74.0060 },
        isActive: true
      });

      const booking = await BookingService.createBooking({
        userId: String(user._id),
        locationId: String(location._id),
        startTime: new Date(Date.now() + 3600000),
        endTime: new Date(Date.now() + 7200000),
        status: 'PENDING',
        price: 25
      });

      const updated = await BookingService.updateBookingStatus(
        String(booking._id),
        'CONFIRMED'
      );

      expect(updated?.status).toBe('CONFIRMED');
    });
  });

  describe('Query Methods Coverage', () => {
    it('should handle users by role query', async () => {
      await UserService.createUser({
        email: 'admin@example.com',
        password: 'password123',
        role: 'ADMIN',
        profile: {
          name: 'Admin User',
          phone: '+1234567890'
        }
      });

      await UserService.createUser({
        email: 'customer@example.com',
        password: 'password123',
        role: 'CUSTOMER',
        profile: {
          name: 'Customer User',
          phone: '+1234567890'
        }
      });

      const admins = await UserService.getUsersByRole('ADMIN');
      const customers = await UserService.getUsersByRole('CUSTOMER');

      expect(admins.length).toBe(1);
      expect(customers.length).toBe(1);
      expect(admins[0]?.role).toBe('ADMIN');
      expect(customers[0]?.role).toBe('CUSTOMER');
    });

    it('should handle bookings by status query', async () => {
      const user = await UserService.createUser({
        email: 'test@example.com',
        password: 'password123',
        role: 'CUSTOMER',
        profile: {
          name: 'Test User',
          phone: '+1234567890'
        }
      });

      const location = await LocationService.createLocation({
        name: 'Test Location',
        address: '123 Test St',
        coordinates: { latitude: 40.7128, longitude: -74.0060 },
        isActive: true
      });

      await BookingService.createBooking({
        userId: String(user._id),
        locationId: String(location._id),
        startTime: new Date(Date.now() + 3600000),
        endTime: new Date(Date.now() + 7200000),
        status: 'PENDING',
        price: 25
      });

      await BookingService.createBooking({
        userId: String(user._id),
        locationId: String(location._id),
        startTime: new Date(Date.now() + 10800000), // 3 hours from now
        endTime: new Date(Date.now() + 14400000), // 4 hours from now
        status: 'CONFIRMED',
        price: 30
      });

      const pendingBookings = await BookingService.getBookingsByStatus('PENDING');
      const confirmedBookings = await BookingService.getBookingsByStatus('CONFIRMED');

      expect(pendingBookings.length).toBe(1);
      expect(confirmedBookings.length).toBe(1);
      expect(pendingBookings[0]?.status).toBe('PENDING');
      expect(confirmedBookings[0]?.status).toBe('CONFIRMED');
    });

    it('should handle upcoming bookings query', async () => {
      const user = await UserService.createUser({
        email: 'test@example.com',
        password: 'password123',
        role: 'CUSTOMER',
        profile: {
          name: 'Test User',
          phone: '+1234567890'
        }
      });

      const location = await LocationService.createLocation({
        name: 'Test Location',
        address: '123 Test St',
        coordinates: { latitude: 40.7128, longitude: -74.0060 },
        isActive: true
      });

      await BookingService.createBooking({
        userId: String(user._id),
        locationId: String(location._id),
        startTime: new Date(Date.now() + 3600000), // 1 hour from now
        endTime: new Date(Date.now() + 7200000), // 2 hours from now
        status: 'CONFIRMED',
        price: 25
      });

      const upcomingBookings = await BookingService.getUpcomingBookings();
      const userUpcomingBookings = await BookingService.getUpcomingBookings(String(user._id));

      expect(upcomingBookings.length).toBeGreaterThanOrEqual(1);
      expect(userUpcomingBookings.length).toBe(1);
      expect(userUpcomingBookings[0]?.status).toMatch(/PENDING|CONFIRMED/);
    });

    it('should handle user bookings pagination', async () => {
      const user = await UserService.createUser({
        email: 'test@example.com',
        password: 'password123',
        role: 'CUSTOMER',
        profile: {
          name: 'Test User',
          phone: '+1234567890'
        }
      });

      const location = await LocationService.createLocation({
        name: 'Test Location',
        address: '123 Test St',
        coordinates: { latitude: 40.7128, longitude: -74.0060 },
        isActive: true
      });

      // Create multiple bookings
      for (let i = 0; i < 5; i++) {
        await BookingService.createBooking({
          userId: String(user._id),
          locationId: String(location._id),
          startTime: new Date(Date.now() + (i + 1) * 3600000),
          endTime: new Date(Date.now() + (i + 1) * 3600000 + 1800000),
          status: 'PENDING',
          price: 25
        });
      }

      const page1 = await BookingService.getUserBookings(String(user._id), 1, 3);
      const page2 = await BookingService.getUserBookings(String(user._id), 2, 3);

      expect(page1.length).toBe(3);
      expect(page2.length).toBe(2);
    });

    it('should handle all users pagination', async () => {
      // Create multiple users
      for (let i = 0; i < 5; i++) {
        await UserService.createUser({
          email: `user${i}@example.com`,
          password: 'password123',
          role: 'CUSTOMER',
          profile: {
            name: `User ${i}`,
            phone: '+1234567890'
          }
        });
      }

      const page1 = await UserService.getAllUsers(1, 3);
      const page2 = await UserService.getAllUsers(2, 3);

      expect(page1.length).toBe(3);
      expect(page2.length).toBe(2);
    });
  });

  describe('Simple Error Cases', () => {
    it('should handle invalid IDs by throwing errors', async () => {
      const invalidId = 'invalid-id-format';

      // These should throw CastError for invalid ObjectId format
      await expect(LocationService.getLocationById(invalidId)).rejects.toThrow();
      await expect(UserService.findById(invalidId)).rejects.toThrow();
      await expect(BookingService.findById(invalidId)).rejects.toThrow();
    });

    it('should handle non-existent updates', async () => {
      const nonExistentId = '507f1f77bcf86cd799439011';

      const locationUpdate = await LocationService.updateLocation(nonExistentId, {
        name: 'Updated'
      });
      const userUpdate = await UserService.updateProfile(nonExistentId, {
        profile: { name: 'Updated', phone: '+1111111111' }
      });

      expect(locationUpdate).toBeNull();
      expect(userUpdate).toBeNull();
    });

    it('should handle empty search results', async () => {
      const searchResults = await LocationService.searchLocations('nonexistent');
      expect(searchResults).toEqual([]);

      const nearbyResults = await LocationService.findNearby(90, 180, 1);
      expect(nearbyResults).toEqual([]);
    });
  });
}); 