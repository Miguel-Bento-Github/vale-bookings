// Test data fixtures for integration tests
export const testUsers = {
  validUser: {
    email: 'test@example.com',
    password: 'password123',
    role: 'CUSTOMER' as const,
    profile: {
      name: 'Test User',
      phone: '+1234567890'
    }
  }
};

export const testLocations = {
  validLocation: {
    name: 'Downtown Parking',
    address: '123 Main St, City, State 12345',
    coordinates: {
      latitude: 40.7128,
      longitude: -74.0060
    },
    isActive: true
  }
};

export const testBookings = {
  validBooking: {
    userId: '507f1f77bcf86cd799439011',
    locationId: '507f1f77bcf86cd799439012',
    startTime: new Date('2025-12-01T09:00:00Z'),
    endTime: new Date('2025-12-01T17:00:00Z'),
    status: 'PENDING' as const,
    price: 50.00,
    notes: 'Test booking'
  }
};

export const testSchedules = {
  validSchedule: {
    locationId: '507f1f77bcf86cd799439012',
    dayOfWeek: 1,
    startTime: '09:00',
    endTime: '18:00',
    isActive: true
  }
}; 