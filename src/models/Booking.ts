import mongoose, { Schema, Model } from 'mongoose';

import { IBookingDocument } from '../types';

interface IBookingModel extends Model<IBookingDocument> {
  findOverlapping(
    locationId: string,
    startTime: Date,
    endTime: Date,
    excludeBookingId?: string
  ): Promise<IBookingDocument[]>;

  findByUserId(
    userId: string,
    page?: number,
    limit?: number
  ): Promise<IBookingDocument[]>;

  findByLocationId(
    locationId: string,
    startDate?: Date,
    endDate?: Date
  ): Promise<IBookingDocument[]>;
}

const BookingSchema: Schema = new Schema(
  {
    userId: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: [true, 'User ID is required']
    },
    locationId: {
      type: Schema.Types.ObjectId,
      ref: 'Location',
      required: [true, 'Location ID is required']
    },
    startTime: {
      type: Date,
      required: [true, 'Start time is required']
    },
    endTime: {
      type: Date,
      required: [true, 'End time is required']
    },
    status: {
      type: String,
      enum: ['PENDING', 'CONFIRMED', 'IN_PROGRESS', 'COMPLETED', 'CANCELLED'],
      default: 'PENDING'
    },
    price: {
      type: Number,
      required: [true, 'Price is required'],
      min: [0, 'Price must be a positive number']
    },
    notes: {
      type: String,
      trim: true,
      maxlength: [500, 'Notes cannot exceed 500 characters']
    }
  },
  {
    timestamps: true
  }
);

// Custom validation to ensure end time is after start time
BookingSchema.pre('validate', function (next): void {
  if (this.startTime instanceof Date && this.endTime instanceof Date && this.endTime <= this.startTime) {
    next(new Error('End time must be after start time'));
  } else {
    next();
  }
});

// Custom validation to ensure booking is not in the past
BookingSchema.pre('validate', function (next): void {
  const now = new Date();
  if (this.startTime instanceof Date && this.startTime < now) {
    // Allow if it's an update and the booking was already in the past
    if (this.isNew) {
      next(new Error('Cannot create booking in the past'));
    }
  }
  next();
});

// Indexes for performance
BookingSchema.index({ userId: 1, createdAt: -1 });
BookingSchema.index({ locationId: 1, startTime: 1 });
BookingSchema.index({ status: 1, startTime: 1 });

// Compound index to prevent overlapping bookings for the same location
BookingSchema.index(
  {
    locationId: 1,
    startTime: 1,
    endTime: 1,
    status: 1
  },
  {
    partialFilterExpression: {
      status: { $in: ['PENDING', 'CONFIRMED', 'IN_PROGRESS'] }
    }
  }
);

// Static method to find overlapping bookings
BookingSchema.statics.findOverlapping = function (
  locationId: string,
  startTime: Date,
  endTime: Date,
  excludeBookingId?: string
): Promise<IBookingDocument[]> {
  const query: mongoose.FilterQuery<IBookingDocument> = {
    locationId,
    status: { $in: ['PENDING', 'CONFIRMED', 'IN_PROGRESS'] },
    $or: [
      // New booking starts during existing booking
      { startTime: { $lte: startTime }, endTime: { $gt: startTime } },
      // New booking ends during existing booking
      { startTime: { $lt: endTime }, endTime: { $gte: endTime } },
      // New booking encompasses existing booking
      { startTime: { $gte: startTime }, endTime: { $lte: endTime } }
    ]
  };

  if (typeof excludeBookingId === 'string') {
    query._id = { $ne: excludeBookingId };
  }

  // Use the model directly to avoid 'this' typing issues
  const BookingModel = mongoose.model<IBookingDocument>('Booking');
  return BookingModel.find(query);
};

// Static method to get user bookings with pagination
BookingSchema.statics.findByUserId = function (
  userId: string,
  page: number = 1,
  limit: number = 10
): Promise<IBookingDocument[]> {
  const skip = (page - 1) * limit;
  const BookingModel = mongoose.model<IBookingDocument>('Booking');
  return BookingModel.find({ userId })
    .populate('locationId', 'name address')
    .sort({ createdAt: -1 })
    .skip(skip)
    .limit(limit);
};

// Static method to get location bookings
BookingSchema.statics.findByLocationId = function (
  locationId: string,
  startDate?: Date,
  endDate?: Date
): Promise<IBookingDocument[]> {
  const query: mongoose.FilterQuery<IBookingDocument> = { locationId };

  if (startDate instanceof Date || endDate instanceof Date) {
    const timeQuery: Record<string, Date> = {};
    if (startDate instanceof Date) timeQuery.$gte = startDate;
    if (endDate instanceof Date) timeQuery.$lte = endDate;
    query.startTime = timeQuery;
  }

  const BookingModel = mongoose.model<IBookingDocument>('Booking');
  return BookingModel.find(query)
    .populate('userId', 'profile.name email')
    .sort({ startTime: 1 });
};

// Instance method to calculate duration in hours
BookingSchema.methods.getDurationHours = function (): number {
  if (!(this.endTime instanceof Date) || !(this.startTime instanceof Date)) {
    return 0;
  }
  const diffMs = this.endTime.getTime() - this.startTime.getTime();
  return diffMs / (1000 * 60 * 60);
};

export default mongoose.model<IBookingDocument, IBookingModel>('Booking', BookingSchema); 