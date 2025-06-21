import { Document } from 'mongoose';

import { ITimestamps } from './common';

/**
 * Schedule domain types
 */

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

// Schedule request types
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

// Schedule model interface
export interface IScheduleModel {
    findByLocationAndDay(locationId: string, dayOfWeek: number): Promise<IScheduleDocument | null>;
    getWeeklySchedule(locationId: string): Promise<IScheduleDocument[]>;
    getDayName(dayOfWeek: number): string;
} 