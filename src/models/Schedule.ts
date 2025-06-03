import mongoose, { Schema } from 'mongoose';
import { IScheduleDocument } from '../types';

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
ScheduleSchema.pre('validate', function (next) {
  if (this.startTime && this.endTime) {
    const [startHour, startMinute] = this.startTime.split(':').map(Number);
    const [endHour, endMinute] = this.endTime.split(':').map(Number);
    
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
ScheduleSchema.statics.findByLocationId = function (locationId: string, activeOnly: boolean = true) {
  const query: mongoose.FilterQuery<IScheduleDocument> = { locationId };
  
  if (activeOnly) {
    query.isActive = true;
  }

  return this.find(query)
    .populate('locationId', 'name address')
    .sort({ dayOfWeek: 1, startTime: 1 });
};

// Static method to find schedule for specific day
ScheduleSchema.statics.findByLocationAndDay = function (
  locationId: string,
  dayOfWeek: number,
  activeOnly: boolean = true
) {
  const query: mongoose.FilterQuery<IScheduleDocument> = { locationId, dayOfWeek };
  
  if (activeOnly) {
    query.isActive = true;
  }

  return this.findOne(query).populate('locationId', 'name address');
};

// Static method to get all schedules for the week
ScheduleSchema.statics.getWeeklySchedule = function (locationId: string) {
  return this.find({
    locationId,
    isActive: true
  })
  .sort({ dayOfWeek: 1 })
  .populate('locationId', 'name address');
};

// Instance method to check if location is open at specific time
ScheduleSchema.methods.isOpenAt = function (timeString: string): boolean {
  if (!this.isActive) return false;

  const timeParts = timeString.split(':');
  if (timeParts.length !== 2) return false;
  
  const hour = parseInt(timeParts[0] as string, 10);
  const minute = parseInt(timeParts[1] as string, 10);
  
  if (isNaN(hour) || isNaN(minute)) return false;
  
  const checkMinutes = hour * 60 + minute;

  const [startHour, startMinute] = this.startTime.split(':').map(Number);
  const [endHour, endMinute] = this.endTime.split(':').map(Number);

  const startMinutes = startHour * 60 + startMinute;
  const endMinutes = endHour * 60 + endMinute;

  return checkMinutes >= startMinutes && checkMinutes < endMinutes;
};

// Instance method to get operating hours duration
ScheduleSchema.methods.getOperatingHours = function (): number {
  const [startHour, startMinute] = this.startTime.split(':').map(Number);
  const [endHour, endMinute] = this.endTime.split(':').map(Number);

  const startMinutes = startHour * 60 + startMinute;
  const endMinutes = endHour * 60 + endMinute;

  return (endMinutes - startMinutes) / 60;
};

// Static method to get day name from day of week number
ScheduleSchema.statics.getDayName = function (dayOfWeek: number): string {
  const days = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
  return days[dayOfWeek] || 'Invalid Day';
};

export default mongoose.model<IScheduleDocument>('Schedule', ScheduleSchema); 