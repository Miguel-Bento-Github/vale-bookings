import { 
  IUser, 
  ILocation, 
  IBooking, 
  ISchedule, 
  IRegisterRequest, 
  ILoginRequest,
  ICreateBookingRequest,
  ICreateLocationRequest,
  ICreateScheduleRequest
} from '../../src/types';

// User fixtures
export const validUser: IUser = {
  email: 'test@example.com',
  password: 'password123',
  role: 'CUSTOMER',
  profile: {
    name: 'Test User',
    phone: '+1234567890'
  }
};

export const adminUser: IUser = {
  email: 'admin@example.com',
  password: 'adminpass123',
  role: 'ADMIN',
  profile: {
    name: 'Admin User',
    phone: '+1987654321'
  }
};

export const valetUser: IUser = {
  email: 'valet@example.com',
  password: 'valetpass123',
  role: 'VALET',
  profile: {
    name: 'Valet User',
    phone: '+1122334455'
  }
};

// Location fixtures
export const validLocation: ILocation = {
  name: 'Downtown Parking',
  address: '123 Main St, City, State 12345',
  coordinates: {
    latitude: 40.7128,
    longitude: -74.0060
  },
  isActive: true
};

export const inactiveLocation: ILocation = {
  name: 'Closed Parking',
  address: '456 Side St, City, State 12345',
  coordinates: {
    latitude: 40.7589,
    longitude: -73.9851
  },
  isActive: false
};

// Booking fixtures
export const validBooking: IBooking = {
  userId: '507f1f77bcf86cd799439011',
  locationId: '507f1f77bcf86cd799439012',
  startTime: new Date('2025-12-01T09:00:00Z'),
  endTime: new Date('2025-12-01T17:00:00Z'),
  status: 'PENDING',
  price: 50.00,
  notes: 'Test booking'
};

// Schedule fixtures
export const validSchedule: ISchedule = {
  locationId: '507f1f77bcf86cd799439012',
  dayOfWeek: 1, // Monday
  startTime: '09:00',
  endTime: '18:00',
  isActive: true
};

// Request fixtures
export const validRegisterRequest: IRegisterRequest = {
  email: 'newuser@example.com',
  password: 'newpass123',
  profile: {
    name: 'New User',
    phone: '+1555666777'
  }
};

export const validLoginRequest: ILoginRequest = {
  email: 'test@example.com',
  password: 'password123'
};

export const validCreateBookingRequest: ICreateBookingRequest = {
  locationId: '507f1f77bcf86cd799439012',
  startTime: '2025-12-01T09:00:00Z',
  endTime: '2025-12-01T17:00:00Z',
  notes: 'Test booking request'
};

export const validCreateLocationRequest: ICreateLocationRequest = {
  name: 'New Parking Location',
  address: '789 New St, City, State 12345',
  coordinates: {
    latitude: 40.7505,
    longitude: -73.9934
  }
};

export const validCreateScheduleRequest: ICreateScheduleRequest = {
  locationId: '507f1f77bcf86cd799439012',
  dayOfWeek: 2, // Tuesday
  startTime: '08:00',
  endTime: '19:00'
};

// Invalid data fixtures for negative testing
export const invalidUserData = {
  noEmail: {
    password: 'password123',
    profile: { name: 'Test User' }
  },
  invalidEmail: {
    email: 'invalid-email',
    password: 'password123',
    profile: { name: 'Test User' }
  },
  shortPassword: {
    email: 'test@example.com',
    password: '123',
    profile: { name: 'Test User' }
  },
  noProfile: {
    email: 'test@example.com',
    password: 'password123'
  }
};

export const invalidLocationData = {
  noName: {
    address: '123 Main St',
    coordinates: { latitude: 40.7128, longitude: -74.0060 }
  },
  noAddress: {
    name: 'Test Location',
    coordinates: { latitude: 40.7128, longitude: -74.0060 }
  },
  invalidCoordinates: {
    name: 'Test Location',
    address: '123 Main St',
    coordinates: { latitude: 91, longitude: -181 }
  }
};

export const invalidBookingData = {
  noLocationId: {
    startTime: '2025-12-01T09:00:00Z',
    endTime: '2025-12-01T17:00:00Z'
  },
  invalidTimeRange: {
    locationId: '507f1f77bcf86cd799439012',
    startTime: '2025-12-01T17:00:00Z',
    endTime: '2025-12-01T09:00:00Z'
  },
  pastDate: {
    locationId: '507f1f77bcf86cd799439012',
    startTime: '2020-01-01T09:00:00Z',
    endTime: '2020-01-01T17:00:00Z'
  }
}; 