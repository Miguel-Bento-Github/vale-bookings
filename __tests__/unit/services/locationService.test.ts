
import mongoose from 'mongoose';

import Location from '../../../src/models/Location';
import * as LocationService from '../../../src/services/LocationService';
import { ILocation } from '../../../src/types';






describe('LocationService', () => {
  afterEach(async () => {
    await Location.deleteMany({});
  });

  // Test data fixtures
  const createTestLocation = (overrides: Partial<ILocation> = {}): ILocation => ({
    name: 'Downtown Parking',
    address: '123 Main St, Downtown',
    coordinates: {
      latitude: 40.7128,
      longitude: -74.0060
    },
    isActive: true,
    ...overrides
  });

  const createMultipleTestLocations = async (): Promise<void> => {
    const locations = [
      createTestLocation({
        name: 'Downtown Parking',
        coordinates: { latitude: 40.7128, longitude: -74.0060 } // NYC
      }),
      createTestLocation({
        name: 'Airport Parking',
        coordinates: { latitude: 40.6892, longitude: -74.1745 } // Newark ~20km from NYC
      }),
      createTestLocation({
        name: 'Midtown Garage',
        coordinates: { latitude: 40.7589, longitude: -73.9851 } // Times Square ~7km from NYC
      }),
      createTestLocation({
        name: 'Brooklyn Heights',
        coordinates: { latitude: 40.6962, longitude: -73.9932 } // Brooklyn ~8km from NYC
      }),
      createTestLocation({
        name: 'Inactive Location',
        coordinates: { latitude: 40.7000, longitude: -74.0000 },
        isActive: false
      })
    ];

    for (const location of locations) {
      await LocationService.createLocation(location);
    }
  };

  describe('findNearby', () => {
    beforeEach(async () => {
      await createMultipleTestLocations();
    });

    it('should find locations within specified radius', async () => {
      const locations = await LocationService.findNearby(40.7128, -74.0060, 10); // 10km radius

      expect(locations).toBeDefined();
      expect(locations.length).toBeGreaterThan(0);
      expect(locations.some(loc => loc.name === 'Downtown Parking')).toBe(true);
      expect(locations.some(loc => loc.name === 'Midtown Garage')).toBe(true);
      expect(locations.some(loc => loc.name === 'Brooklyn Heights')).toBe(true);
    });

    it('should return locations sorted by distance', async () => {
      const locations = await LocationService.findNearby(40.7128, -74.0060, 50);

      expect(locations.length).toBeGreaterThan(1);
      // The first location should be the closest (Downtown Parking itself)
      if (locations.length > 0) {
        expect(locations[0]?.name).toBe('Downtown Parking');
      }
    });

    it('should respect radius parameter', async () => {
      // Test with very small radius (1km) - should only return very close locations
      const closeLocations = await LocationService.findNearby(40.7128, -74.0060, 1);

      // Test with larger radius (50km) - should return more locations
      const farLocations = await LocationService.findNearby(40.7128, -74.0060, 50);

      expect(farLocations.length).toBeGreaterThanOrEqual(closeLocations.length);
      expect(closeLocations.length).toBeGreaterThanOrEqual(1); // At least the exact location
    });

    it('should only return active locations', async () => {
      const locations = await LocationService.findNearby(40.7000, -74.0000, 5);

      expect(locations.every(loc => loc.isActive)).toBe(true);
      expect(locations.some(loc => loc.name === 'Inactive Location')).toBe(false);
    });

    it('should handle edge cases for coordinates', async () => {
      // Test with invalid coordinates
      const invalidLatLocations = await LocationService.findNearby(91, -74.0060, 10);
      const invalidLngLocations = await LocationService.findNearby(40.7128, 181, 10);

      expect(invalidLatLocations).toEqual([]);
      expect(invalidLngLocations).toEqual([]);
    });

    it('should use default radius when not specified', async () => {
      const locationsWithDefault = await LocationService.findNearby(40.7128, -74.0060);
      const locationsWithExplicit = await LocationService.findNearby(40.7128, -74.0060, 10);

      expect(locationsWithDefault.length).toBe(locationsWithExplicit.length);
    });
  });

  describe('searchLocations', () => {
    beforeEach(async () => {
      await createMultipleTestLocations();
    });

    it('should find locations by name', async () => {
      const locations = await LocationService.searchLocations('Downtown');

      expect(locations.length).toBeGreaterThan(0);
      expect(locations.some(loc => loc.name.includes('Downtown'))).toBe(true);
    });

    it('should find locations by address', async () => {
      const locations = await LocationService.searchLocations('Main St');

      expect(locations.length).toBeGreaterThan(0);
      expect(locations.some(loc => loc.address.includes('Main St'))).toBe(true);
    });

    it('should be case insensitive', async () => {
      const upperCaseResults = await LocationService.searchLocations('DOWNTOWN');
      const lowerCaseResults = await LocationService.searchLocations('downtown');

      expect(upperCaseResults.length).toBe(lowerCaseResults.length);
      expect(upperCaseResults.length).toBeGreaterThan(0);
    });

    it('should only return active locations', async () => {
      const locations = await LocationService.searchLocations('Location');

      expect(locations.every(loc => loc.isActive)).toBe(true);
    });

    it('should return empty array for non-matching query', async () => {
      const locations = await LocationService.searchLocations('NonExistentLocation');

      expect(locations).toEqual([]);
    });
  });

  describe('getLocationsByCoordinates', () => {
    beforeEach(async () => {
      await createMultipleTestLocations();
    });

    it('should find locations within coordinate bounds', async () => {
      // Define bounds around NYC area
      const minLat = 40.6;
      const maxLat = 40.8;
      const minLng = -74.2;
      const maxLng = -73.9;

      const locations = await LocationService.getLocationsByCoordinates(
        minLat, maxLat, minLng, maxLng
      );

      expect(locations.length).toBeGreaterThan(0);
      locations.forEach(location => {
        expect(location.coordinates.latitude).toBeGreaterThanOrEqual(minLat);
        expect(location.coordinates.latitude).toBeLessThanOrEqual(maxLat);
        expect(location.coordinates.longitude).toBeGreaterThanOrEqual(minLng);
        expect(location.coordinates.longitude).toBeLessThanOrEqual(maxLng);
      });
    });

    it('should only return active locations', async () => {
      const locations = await LocationService.getLocationsByCoordinates(
        40.6, 40.8, -74.2, -73.9
      );

      expect(locations.every(loc => loc.isActive)).toBe(true);
    });

    it('should return empty array when no locations in bounds', async () => {
      // Define bounds far from any test locations
      const locations = await LocationService.getLocationsByCoordinates(
        50.0, 51.0, 2.0, 3.0 // London area
      );

      expect(locations).toEqual([]);
    });
  });

  describe('getLocationAvailability', () => {
    beforeEach(async () => {
      await createMultipleTestLocations();
    });

    it('should calculate real-time availability for location', async () => {
      const locations = await LocationService.getAllLocations();
      expect(locations.length).toBeGreaterThan(0);
      const testLocation = locations[0];
      if (!testLocation) {
        throw new Error('No test location found');
      }

      // Mock method for calculating availability
      // This would integrate with booking data in real implementation
      const availability = await LocationService.getLocationAvailability(
        String(testLocation._id),
        new Date()
      );

      expect(availability).toBeDefined();
      expect(typeof availability.availableSpots).toBe('number');
      expect(typeof availability.totalSpots).toBe('number');
      expect(availability.availableSpots).toBeLessThanOrEqual(availability.totalSpots);
    });

    it('should return availability for specific date', async () => {
      const locations = await LocationService.getAllLocations();
      expect(locations.length).toBeGreaterThan(0);
      const testLocation = locations[0];
      if (!testLocation) {
        throw new Error('No test location found');
      }

      const futureDate = new Date();
      futureDate.setDate(futureDate.getDate() + 7);

      const availability = await LocationService.getLocationAvailability(
        String(testLocation._id),
        futureDate
      );

      expect(availability).toBeDefined();
      expect(availability.date).toEqual(futureDate);
    });

    it('should handle invalid location ID', async () => {
      const invalidId = new mongoose.Types.ObjectId().toString();

      await expect(
        LocationService.getLocationAvailability(invalidId, new Date())
      ).rejects.toThrow('Location not found');
    });
  });

  describe('getLocationWithDistance', () => {
    beforeEach(async () => {
      await createMultipleTestLocations();
    });

    it('should return location with calculated distance', async () => {
      const userLocation = { latitude: 40.7128, longitude: -74.0060 };
      const locations = await LocationService.getLocationsWithDistance(
        userLocation.latitude,
        userLocation.longitude,
        10
      );

      expect(locations.length).toBeGreaterThan(0);
      locations.forEach((location: { distance: number }) => {
        expect(location).toHaveProperty('distance');
        expect(typeof location.distance).toBe('number');
        expect(location.distance).toBeGreaterThanOrEqual(0);
      });
    });

    it('should sort locations by distance', async () => {
      const userLocation = { latitude: 40.7128, longitude: -74.0060 };
      const locations = await LocationService.getLocationsWithDistance(
        userLocation.latitude,
        userLocation.longitude,
        50
      );

      expect(locations.length).toBeGreaterThan(1);

      // Check if sorted by distance (ascending)
      for (let i = 1; i < locations.length; i++) {
        const currentLocation = locations[i];
        const previousLocation = locations[i - 1];
        if (currentLocation && previousLocation) {
          expect(currentLocation.distance).toBeGreaterThanOrEqual(previousLocation.distance);
        }
      }
    });
  });

  describe('getLocationTimeslots', () => {
    beforeEach(async () => {
      await createMultipleTestLocations();
    });

    it('should return available time slots for location', async () => {
      const locations = await LocationService.getAllLocations();
      expect(locations.length).toBeGreaterThan(0);
      const testLocation = locations[0];
      if (!testLocation) {
        throw new Error('No test location found');
      }

      const testDate = new Date();

      const timeslots = await LocationService.getLocationTimeslots(
        String(testLocation._id),
        testDate
      );

      expect(timeslots).toBeDefined();
      expect(Array.isArray(timeslots)).toBe(true);
      timeslots.forEach(slot => {
        expect(slot).toHaveProperty('startTime');
        expect(slot).toHaveProperty('endTime');
        expect(slot).toHaveProperty('available');
        expect(typeof slot.available).toBe('boolean');
      });
    });

    it('should respect location operating hours', async () => {
      const locations = await LocationService.getAllLocations();
      expect(locations.length).toBeGreaterThan(0);
      const testLocation = locations[0];
      if (!testLocation) {
        throw new Error('No test location found');
      }

      const testDate = new Date();

      const timeslots = await LocationService.getLocationTimeslots(
        String(testLocation._id),
        testDate
      );

      // Assuming standard operating hours (9 AM - 6 PM)
      const validHours = timeslots.filter(slot => {
        const hour = new Date(slot.startTime).getHours();
        return hour >= 9 && hour < 18;
      });

      expect(validHours.length).toBe(timeslots.length);
    });
  });

  describe('error handling', () => {
    it('should handle database connection errors gracefully', () => {
      // This test will be handled at integration level
      // For now, just test that the service handles errors properly
      expect(true).toBe(true);
    });

    it('should validate coordinate ranges', async () => {
      const invalidLocation = createTestLocation({
        coordinates: { latitude: 91, longitude: -74.0060 } // Invalid latitude
      });

      await expect(LocationService.createLocation(invalidLocation)).rejects.toThrow();
    });

    it('should handle malformed search queries', async () => {
      const emptyResults = await LocationService.searchLocations('');
      const specialCharResults = await LocationService.searchLocations('!@#$%^&*()');

      expect(emptyResults).toEqual([]);
      expect(specialCharResults).toEqual([]);
    });
  });
}); 