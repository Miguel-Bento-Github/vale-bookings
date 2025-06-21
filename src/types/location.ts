import { Document } from 'mongoose';

import { ITimestamps, ICoordinates } from './common';

/**
 * Location domain types
 */

export interface ILocation extends ITimestamps {
    name: string;
    address: string;
    coordinates: ICoordinates;
    isActive: boolean;
}

export interface ILocationDocument extends ILocation, Document { }

// Location discovery types
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

// Location request types
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

// Location model interface
export interface ILocationModel {
    findNearby(latitude: number, longitude: number, radiusInKm: number): Promise<ILocationDocument[]>;
    search(query: string): Promise<ILocationDocument[]>;
} 