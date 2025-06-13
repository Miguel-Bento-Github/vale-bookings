import mongoose, { Schema, Model } from 'mongoose';

import { IScheduleDocument } from '../types';

interface IScheduleModel extends Model<IScheduleDocument> {
  findByLocationId(
    locationId: string,
    activeOnly?: boolean
  ): Promise<IScheduleDocument[]>;

  findByLocationAndDay(
    locationId: string,
    dayOfWeek: number,
    activeOnly?: boolean
  ): Promise<IScheduleDocument | null>;

  getWeeklySchedule(locationId: string): Promise<IScheduleDocument[]>;

  getDayName(dayOfWeek: number): string;
}

const ScheduleSchema: Schema = new Schema(
  {
    locationId: {
      type: Schema.Types.ObjectId,
      ref: 'Location',
      required: [true, 'Location ID is required']
    },
    dayOfWeek: {
      type: Number,
      required: [true, 'Day of week is required'],
      min: [0, 'Day of week must be between 0 (Sunday) and 6 (Saturday)'],
      max: [6, 'Day of week must be between 0 (Sunday) and 6 (Saturday)']
    },
    startTime: {
      type: String,
      required: [true, 'Start time is required'],
      match: [/^([01]?[0-9]|2[0-3]):[0-5][0-9]$/, 'Start time must be in HH:MM format']
    },
    endTime: {
      type: String,
      required: [true, 'End time is required'],
      match: [/^([01]?[0-9]|2[0-3]):[0-5][0-9]$/, 'End time must be in HH:MM format']
    },
    isActive: {
      type: Boolean,
      default: true
    }
  },
  {
    timestamps: true
  }
);

// Custom validation to ensure end time is after start time
ScheduleSchema.pre('validate', function (next): void {
  if (typeof this.startTime === 'string' && typeof this.endTime === 'string') {
    const startTimeParts = String(this.startTime).split(':');
    const endTimeParts = String(this.endTime).split(':');

    const startHour = parseInt(startTimeParts[0] ?? '0', 10);
    const startMinute = parseInt(startTimeParts[1] ?? '0', 10);
    const endHour = parseInt(endTimeParts[0] ?? '0', 10);
    const endMinute = parseInt(endTimeParts[1] ?? '0', 10);
    
    const startMinutes = startHour * 60 + startMinute;
    const endMinutes = endHour * 60 + endMinute;
    
    if (endMinutes <= startMinutes) {
      next(new Error('End time must be after start time'));
    } else {
      next();
    }
  } else {
    next();
  }
});

// Compound unique index to prevent duplicate schedules for same location and day
ScheduleSchema.index(
  { locationId: 1, dayOfWeek: 1 },
  { unique: true }
);

// Index for performance
ScheduleSchema.index({ locationId: 1, isActive: 1 });

// Static method to find schedules by location
ScheduleSchema.statics.findByLocationId = function (
  locationId: string,
  activeOnly: boolean = true
): Promise<IScheduleDocument[]> {
  const query: mongoose.FilterQuery<IScheduleDocument> = { locationId };
  
  if (activeOnly) {
    query.isActive = true;
  }

  const ScheduleModel = mongoose.model<IScheduleDocument>('Schedule');
  return ScheduleModel.find(query)
    .populate('locationId', 'name address')
    .sort({ dayOfWeek: 1, startTime: 1 });
};

// Static method to find schedule for specific day
ScheduleSchema.statics.findByLocationAndDay = function (
  locationId: string,
  dayOfWeek: number,
  activeOnly: boolean = true
): Promise<IScheduleDocument | null> {
  const query: mongoose.FilterQuery<IScheduleDocument> = { locationId, dayOfWeek };
  
  if (activeOnly) {
    query.isActive = true;
  }

  const ScheduleModel = mongoose.model<IScheduleDocument>('Schedule');
  return ScheduleModel.findOne(query).populate('locationId', 'name address');
};

// Static method to get all schedules for the week
ScheduleSchema.statics.getWeeklySchedule = function (locationId: string): Promise<IScheduleDocument[]> {
  const ScheduleModel = mongoose.model<IScheduleDocument>('Schedule');
  return ScheduleModel.find({
    locationId,
    isActive: true
  })
    .sort({ dayOfWeek: 1 })
    .populate('locationId', 'name address');
};

// Instance method to check if location is open at specific time
ScheduleSchema.methods.isOpenAt = function (timeString: string): boolean {
  if (this.isActive !== true) return false;

  const timeParts = timeString.split(':');
  if (timeParts.length !== 2) return false;
  
  const hourStr = timeParts[0];
  const minuteStr = timeParts[1];

  if (typeof hourStr !== 'string' || typeof minuteStr !== 'string') return false;

  const hour = parseInt(hourStr, 10);
  const minute = parseInt(minuteStr, 10);
  
  if (isNaN(hour) || isNaN(minute)) return false;
  
  const checkMinutes = hour * 60 + minute;

  const startTimeParts = String(this.startTime).split(':');
  const endTimeParts = String(this.endTime).split(':');

  const startHour = parseInt(startTimeParts[0] ?? '0', 10);
  const startMinute = parseInt(startTimeParts[1] ?? '0', 10);
  const endHour = parseInt(endTimeParts[0] ?? '0', 10);
  const endMinute = parseInt(endTimeParts[1] ?? '0', 10);

  const startMinutes = startHour * 60 + startMinute;
  const endMinutes = endHour * 60 + endMinute;

  return checkMinutes >= startMinutes && checkMinutes < endMinutes;
};

// Instance method to get operating hours duration
ScheduleSchema.methods.getOperatingHours = function (): number {
  const startTimeParts = String(this.startTime).split(':');
  const endTimeParts = String(this.endTime).split(':');

  const startHour = parseInt(startTimeParts[0] ?? '0', 10);
  const startMinute = parseInt(startTimeParts[1] ?? '0', 10);
  const endHour = parseInt(endTimeParts[0] ?? '0', 10);
  const endMinute = parseInt(endTimeParts[1] ?? '0', 10);

  const startMinutes = startHour * 60 + startMinute;
  const endMinutes = endHour * 60 + endMinute;

  return (endMinutes - startMinutes) / 60;
};

// Static method to get day name from day of week number
ScheduleSchema.statics.getDayName = function (dayOfWeek: number): string {
  // Validate dayOfWeek is within bounds
  if (typeof dayOfWeek !== 'number' || dayOfWeek < 0 || dayOfWeek > 6) {
    return 'Invalid Day';
  }

  // Use switch statement to avoid object injection warning
  switch (dayOfWeek) {
  case 0: return 'Sunday';
  case 1: return 'Monday';
  case 2: return 'Tuesday';
  case 3: return 'Wednesday';
  case 4: return 'Thursday';
  case 5: return 'Friday';
  case 6: return 'Saturday';
  default: return 'Invalid Day';
  }
};

export default mongoose.model<IScheduleDocument, IScheduleModel>('Schedule', ScheduleSchema); 