import { Request } from 'express';
import { Document } from 'mongoose';

// Base interface for entities with timestamps
export interface ITimestamps {
  createdAt?: Date;
  updatedAt?: Date;
}

// User related types
export type UserRole = 'CUSTOMER' | 'VALET' | 'ADMIN';

export interface IUserProfile {
  name: string;
  phone?: string;
}

export interface IUser extends ITimestamps {
  email: string;
  password: string;
  role: UserRole;
  profile: IUserProfile;
}

export interface IUserDocument extends IUser, Document {
  comparePassword(candidatePassword: string): Promise<boolean>;
}

// Location related types
export interface ICoordinates {
  latitude: number;
  longitude: number;
}

export interface ILocation extends ITimestamps {
  name: string;
  address: string;
  coordinates: ICoordinates;
  isActive: boolean;
}

export interface ILocationDocument extends ILocation, Document {}

// Booking related types
export type BookingStatus = 'PENDING' | 'CONFIRMED' | 'IN_PROGRESS' | 'COMPLETED' | 'CANCELLED';

export interface IBooking extends ITimestamps {
  userId: string;
  locationId: string;
  startTime: Date;
  endTime: Date;
  status: BookingStatus;
  price: number;
  notes?: string;
}

export interface IBookingDocument extends IBooking, Document {}

// Schedule related types
export interface ISchedule extends ITimestamps {
  locationId: string;
  dayOfWeek: number; // 0-6 (Sunday to Saturday)
  startTime: string; // "09:00"
  endTime: string;   // "18:00"
  isActive: boolean;
}

export interface IScheduleDocument extends ISchedule, Document {
  isOpenAt(timeString: string): boolean;
  getOperatingHours(): number;
}

// Phase 3: Location Discovery Types
export interface ILocationAvailability {
  locationId: string;
  date: Date;
  availableSpots: number;
  totalSpots: number;
  occupancyRate: number;
}

export interface ILocationWithDistance extends ILocation {
  distance: number; // Distance in kilometers
}

export interface ITimeSlot {
  startTime: Date;
  endTime: Date;
  available: boolean;
  price?: number;
}

export interface ILocationTimeslots {
  locationId: string;
  date: Date;
  timeslots: ITimeSlot[];
}

// JWT related types
export interface IJWTPayload {
  userId: string;
  email: string;
  role: UserRole;
}

export interface IAuthTokens {
  accessToken: string;
  refreshToken: string;
}

// API Response types
export interface IApiResponse<T = unknown> {
  success: boolean;
  message?: string;
  data?: T;
  error?: string;
}

export interface IPaginationOptions {
  page?: number;
  limit?: number;
  sort?: string;
  order?: 'asc' | 'desc';
}

export interface IPaginatedResponse<T> extends IApiResponse<T[]> {
  pagination?: {
    currentPage: number;
    totalPages: number;
    totalItems: number;
    itemsPerPage: number;
  };
}

// Request types
export interface IRegisterRequest {
  email: string;
  password: string;
  profile: IUserProfile;
}

export interface ILoginRequest {
  email: string;
  password: string;
}

export interface ICreateBookingRequest {
  locationId: string;
  startTime: string;
  endTime: string;
  notes?: string;
}

export interface IUpdateBookingRequest {
  startTime?: string;
  endTime?: string;
  status?: BookingStatus;
  notes?: string;
}

export interface ICreateLocationRequest {
  name: string;
  address: string;
  coordinates: ICoordinates;
}

export interface IUpdateLocationRequest {
  name?: string;
  address?: string;
  coordinates?: ICoordinates;
  isActive?: boolean;
}

export interface ICreateScheduleRequest {
  locationId: string;
  dayOfWeek: number;
  startTime: string;
  endTime: string;
}

export interface IUpdateScheduleRequest {
  dayOfWeek?: number;
  startTime?: string;
  endTime?: string;
  isActive?: boolean;
}

// Error types
export class AppError extends Error {
  statusCode: number;
  isOperational: boolean;

  constructor(message: string, statusCode: number) {
    super(message);
    this.statusCode = statusCode;
    this.isOperational = true;

    Error.captureStackTrace(this, this.constructor);
  }
}

// Express types
export interface ICustomRequest extends Request {
  user?: IUser;
}

export interface AuthenticatedRequest extends Request {
  user?: {
    userId: string;
    email: string;
    role: UserRole;
  };
}

// MongoDB Query types
export interface IMongoQuery {
  [key: string]: unknown;
}

export interface IDateRangeQuery {
  $gte?: Date;
  $lte?: Date;
}

export interface IBookingQuery extends IMongoQuery {
  status?: BookingStatus;
  startTime?: IDateRangeQuery;
  userId?: string;
  locationId?: string;
}

export interface IRevenueMatchStage extends IMongoQuery {
  status: BookingStatus;
  startTime?: IDateRangeQuery;
}

// Model method types
export interface IBookingModel {
  findByLocationId(locationId: string, startDate?: Date, endDate?: Date): Promise<IBookingDocument[]>;
  findOverlapping(
    locationId: string,
    startTime: Date,
    endTime: Date,
    excludeBookingId?: string
  ): Promise<IBookingDocument[]>;
}

export interface ILocationModel {
  findNearby(latitude: number, longitude: number, radiusInKm: number): Promise<ILocationDocument[]>;
  search(query: string): Promise<ILocationDocument[]>;
}

export interface IScheduleModel {
  findByLocationAndDay(locationId: string, dayOfWeek: number): Promise<IScheduleDocument | null>;
  getWeeklySchedule(locationId: string): Promise<IScheduleDocument[]>;
  getDayName(dayOfWeek: number): string;
} 