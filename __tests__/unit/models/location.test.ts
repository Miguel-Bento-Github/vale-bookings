import Location from '../../../src/models/Location';

// Type definition for mocked Location model
interface MockedLocationModel {
  find: jest.Mock;
  findNearby: (latitude: number, longitude: number, radiusInKm?: number) => Promise<unknown[]>;
  search: (query: string) => Promise<unknown[]>;
}

describe('Location Model Unit Tests', () => {
  // Valid test data
  const validLocationData = {
    name: 'Test Location',
    address: '123 Test Street, Test City',
    coordinates: {
      latitude: 40.7128,
      longitude: -74.0060
    }
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('Schema validation', () => {
    it('should validate required fields', () => {
      const location = new Location(validLocationData);
      const validationError = location.validateSync();
      expect(validationError).toBeUndefined();
    });

    it('should require name field', () => {
      const locationData = { ...validLocationData } as Partial<typeof validLocationData>;
      delete locationData.name;

      const location = new Location(locationData);
      const validationError = location.validateSync();

      expect(validationError).toBeDefined();
      expect(validationError?.errors?.name).toBeDefined();
      expect(validationError?.errors?.name?.message).toBe('Location name is required');
    });

    it('should require address field', () => {
      const locationData = { ...validLocationData } as Partial<typeof validLocationData>;
      delete locationData.address;

      const location = new Location(locationData);
      const validationError = location.validateSync();

      expect(validationError).toBeDefined();
      expect(validationError?.errors?.address).toBeDefined();
      expect(validationError?.errors?.address?.message).toBe('Address is required');
    });

    it('should require coordinates field', () => {
      const locationData = { ...validLocationData } as Partial<typeof validLocationData>;
      delete locationData.coordinates;

      const location = new Location(locationData);
      const validationError = location.validateSync();

      expect(validationError).toBeDefined();
      expect(validationError?.errors?.coordinates).toBeDefined();
      expect(validationError?.errors?.coordinates?.message).toBe('Coordinates are required');
    });

    it('should require latitude in coordinates', () => {
      const locationData = {
        ...validLocationData,
        coordinates: {
          longitude: -74.0060
        }
      };

      const location = new Location(locationData);
      const validationError = location.validateSync();

      expect(validationError).toBeDefined();
      expect(validationError?.errors?.['coordinates.latitude']).toBeDefined();
      expect(validationError?.errors?.['coordinates.latitude']?.message).toBe('Latitude is required');
    });

    it('should require longitude in coordinates', () => {
      const locationData = {
        ...validLocationData,
        coordinates: {
          latitude: 40.7128
        }
      };

      const location = new Location(locationData);
      const validationError = location.validateSync();

      expect(validationError).toBeDefined();
      expect(validationError?.errors?.['coordinates.longitude']).toBeDefined();
      expect(validationError?.errors?.['coordinates.longitude']?.message).toBe('Longitude is required');
    });

    it('should validate latitude minimum bound', () => {
      const locationData = {
        ...validLocationData,
        coordinates: {
          latitude: -91,
          longitude: -74.0060
        }
      };

      const location = new Location(locationData);
      const validationError = location.validateSync();

      expect(validationError).toBeDefined();
      expect(validationError?.errors?.['coordinates.latitude']).toBeDefined();
      expect(validationError?.errors?.['coordinates.latitude']?.message).toBe('Latitude must be between -90 and 90');
    });

    it('should validate latitude maximum bound', () => {
      const locationData = {
        ...validLocationData,
        coordinates: {
          latitude: 91,
          longitude: -74.0060
        }
      };

      const location = new Location(locationData);
      const validationError = location.validateSync();

      expect(validationError).toBeDefined();
      expect(validationError?.errors?.['coordinates.latitude']).toBeDefined();
      expect(validationError?.errors?.['coordinates.latitude']?.message).toBe('Latitude must be between -90 and 90');
    });

    it('should validate longitude minimum bound', () => {
      const locationData = {
        ...validLocationData,
        coordinates: {
          latitude: 40.7128,
          longitude: -181
        }
      };

      const location = new Location(locationData);
      const validationError = location.validateSync();

      expect(validationError).toBeDefined();
      expect(validationError?.errors?.['coordinates.longitude']).toBeDefined();
      expect(validationError?.errors?.['coordinates.longitude']?.message).toBe(
        'Longitude must be between -180 and 180'
      );
    });

    it('should validate longitude maximum bound', () => {
      const locationData = {
        ...validLocationData,
        coordinates: {
          latitude: 40.7128,
          longitude: 181
        }
      };

      const location = new Location(locationData);
      const validationError = location.validateSync();

      expect(validationError).toBeDefined();
      expect(validationError?.errors?.['coordinates.longitude']).toBeDefined();
      expect(validationError?.errors?.['coordinates.longitude']?.message).toBe(
        'Longitude must be between -180 and 180'
      );
    });

    it('should accept latitude and longitude boundary values', () => {
      const testCases = [
        { latitude: -90, longitude: -180 },
        { latitude: 90, longitude: 180 },
        { latitude: 0, longitude: 0 }
      ];

      testCases.forEach(coordinates => {
        const locationData = {
          ...validLocationData,
          coordinates
        };

        const location = new Location(locationData);
        const validationError = location.validateSync();

        expect(validationError).toBeUndefined();
      });
    });

    it('should validate name maximum length', () => {
      const locationData = {
        ...validLocationData,
        name: 'a'.repeat(201) // 201 characters, exceeds limit of 200
      };

      const location = new Location(locationData);
      const validationError = location.validateSync();

      expect(validationError).toBeDefined();
      expect(validationError?.errors?.name).toBeDefined();
      expect(validationError?.errors?.name?.message).toBe(
        'Location name cannot exceed 200 characters'
      );
    });

    it('should validate address maximum length', () => {
      const locationData = {
        ...validLocationData,
        address: 'a'.repeat(501) // 501 characters, exceeds limit of 500
      };

      const location = new Location(locationData);
      const validationError = location.validateSync();

      expect(validationError).toBeDefined();
      expect(validationError?.errors?.address).toBeDefined();
      expect(validationError?.errors?.address?.message).toBe(
        'Address cannot exceed 500 characters'
      );
    });

    it('should trim name and address', () => {
      const locationData = {
        ...validLocationData,
        name: '  Test Location  ',
        address: '  123 Test Street, Test City  '
      };

      const location = new Location(locationData);

      expect(location.name).toBe('Test Location');
      expect(location.address).toBe('123 Test Street, Test City');
    });

    it('should default isActive to true', () => {
      const location = new Location(validLocationData);
      expect(location.isActive).toBe(true);
    });

    it('should accept explicit isActive value', () => {
      const inactiveLocationData = {
        ...validLocationData,
        isActive: false
      };

      const location = new Location(inactiveLocationData);
      expect(location.isActive).toBe(false);
    });

    it('should accept name at maximum length boundary', () => {
      const locationData = {
        ...validLocationData,
        name: 'a'.repeat(200) // Exactly 200 characters
      };

      const location = new Location(locationData);
      const validationError = location.validateSync();

      expect(validationError).toBeUndefined();
    });

    it('should accept address at maximum length boundary', () => {
      const locationData = {
        ...validLocationData,
        address: 'a'.repeat(500) // Exactly 500 characters
      };

      const location = new Location(locationData);
      const validationError = location.validateSync();

      expect(validationError).toBeUndefined();
    });
  });

  describe('Static method findNearby', () => {
    let mockFind: jest.Mock;

    beforeEach(() => {
      mockFind = jest.fn().mockReturnValue(Promise.resolve([]));
      (Location as unknown as MockedLocationModel).find = mockFind;
    });

    it('should call find with correct query parameters', async () => {
      const latitude = 40.7128;
      const longitude = -74.0060;
      const radiusInKm = 5;

      await (Location as unknown as MockedLocationModel).findNearby(latitude, longitude, radiusInKm);

      expect(mockFind).toHaveBeenCalledTimes(1);
      const query = mockFind.mock.calls[0]?.[0];

      expect(query).toHaveProperty('isActive', true);
      expect(query['coordinates.latitude']).toBeDefined();
      expect(query['coordinates.longitude']).toBeDefined();

      // Verify latitude range
      const latQuery = query['coordinates.latitude'];
      expect(latQuery).toHaveProperty('$gte');
      expect(latQuery).toHaveProperty('$lte');
      expect(latQuery.$gte).toBeLessThan(latitude);
      expect(latQuery.$lte).toBeGreaterThan(latitude);

      // Verify longitude range
      const lngQuery = query['coordinates.longitude'];
      expect(lngQuery).toHaveProperty('$gte');
      expect(lngQuery).toHaveProperty('$lte');
      expect(lngQuery.$gte).toBeLessThan(longitude);
      expect(lngQuery.$lte).toBeGreaterThan(longitude);
    });

    it('should use default radius of 10km when not provided', async () => {
      const latitude = 40.7128;
      const longitude = -74.0060;

      await (Location as unknown as MockedLocationModel).findNearby(latitude, longitude);

      expect(mockFind).toHaveBeenCalledTimes(1);
      const query = mockFind.mock.calls[0]?.[0];

      // Default radius should be 10km ≈ 0.0899 degrees
      const radiusInDegrees = 10 / 111.32;
      const latQuery = query['coordinates.latitude'];
      const lngQuery = query['coordinates.longitude'];

      expect(latQuery.$gte).toBeCloseTo(latitude - radiusInDegrees, 4);
      expect(latQuery.$lte).toBeCloseTo(latitude + radiusInDegrees, 4);
      expect(lngQuery.$gte).toBeCloseTo(longitude - radiusInDegrees, 4);
      expect(lngQuery.$lte).toBeCloseTo(longitude + radiusInDegrees, 4);
    });
  });

  describe('Static method search', () => {
    let mockFind: jest.Mock;

    beforeEach(() => {
      mockFind = jest.fn().mockReturnValue(Promise.resolve([]));
      (Location as unknown as MockedLocationModel).find = mockFind;
    });

    it('should call find with correct text search query', async () => {
      const searchQuery = 'test location';

      await (Location as unknown as MockedLocationModel).search(searchQuery);

      expect(mockFind).toHaveBeenCalledTimes(1);
      const query = mockFind.mock.calls[0]?.[0];

      expect(query).toHaveProperty('isActive', true);
      expect(query).toHaveProperty('$text');
      expect(query.$text).toHaveProperty('$search', searchQuery);
    });

    it('should handle empty search query', async () => {
      await (Location as unknown as MockedLocationModel).search('');

      expect(mockFind).toHaveBeenCalledTimes(1);
      const query = mockFind.mock.calls[0]?.[0];

      expect(query).toHaveProperty('isActive', true);
      expect(query).toHaveProperty('$text');
      expect(query.$text).toHaveProperty('$search', '');
    });
  });
});