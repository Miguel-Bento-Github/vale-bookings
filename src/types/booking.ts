import { Document } from 'mongoose';

import { ITimestamps, IMongoQuery, IDateRangeQuery } from './common';

/**
 * Booking domain types
 */

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

export interface IBookingDocument extends IBooking, Document { }

// Booking request types
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

// Booking query types
export interface IBookingQuery extends IMongoQuery {
    status?: BookingStatus;
    startTime?: IDateRangeQuery;
    userId?: string | { $in: string[] };
    locationId?: string;
}

export interface IRevenueMatchStage extends IMongoQuery {
    status: BookingStatus;
    startTime?: IDateRangeQuery;
}

// Booking model interface
export interface IBookingModel {
    findByLocationId(locationId: string, startDate?: Date, endDate?: Date): Promise<IBookingDocument[]>;
    findOverlapping(
        locationId: string,
        startTime: Date,
        endTime: Date,
        excludeBookingId?: string
    ): Promise<IBookingDocument[]>;
} 