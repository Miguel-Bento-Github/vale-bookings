import { Request } from 'express';

/**
 * Common types shared across all domains
 */

// Base interface for entities with timestamps
export interface ITimestamps {
    createdAt?: Date;
    updatedAt?: Date;
}

// Coordinates used across multiple domains
export interface ICoordinates {
    latitude: number;
    longitude: number;
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
export interface ICustomRequest extends Request {
    user?: import('./user').IUser;
}

export interface AuthenticatedRequest extends Request {
    user?: {
        userId: string;
        email: string;
        role: import('./user').UserRole;
    };
}

// MongoDB query types
export interface IMongoQuery {
    [key: string]: unknown;
}

export interface IDateRangeQuery {
    $gte?: Date;
    $lte?: Date;
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