import Booking from '../models/Booking';
import { IBooking, IBookingDocument, IUpdateBookingRequest, BookingStatus, IBookingModel } from '../types';
import { AppError } from '../types';

export async function createBooking(bookingData: IBooking): Promise<IBookingDocument> {
  // Check for overlapping bookings
  const hasOverlap = await checkOverlappingBookings(
    bookingData.locationId,
    bookingData.startTime,
    bookingData.endTime
  );

  if (hasOverlap) {
    throw new AppError('Booking time slot is not available', 409);
  }

  const booking = new Booking(bookingData);
  return await booking.save();
}

export async function findById(bookingId: string): Promise<IBookingDocument | null> {
  return await Booking.findById(bookingId);
}

export async function getUserBookings(userId: string, page: number = 1, limit: number = 10): Promise<IBookingDocument[]> {
  const skip = (page - 1) * limit;
  return await Booking.find({ userId })
    .sort({ createdAt: -1 })
    .skip(skip)
    .limit(limit);
}

export async function getLocationBookings(locationId: string, startDate?: Date, endDate?: Date): Promise<IBookingDocument[]> {
  return await (Booking as unknown as IBookingModel).findByLocationId(locationId, startDate, endDate);
}

export async function updateBooking(bookingId: string, updateData: IUpdateBookingRequest): Promise<IBookingDocument | null> {
  const booking = await Booking.findById(bookingId);

  if (!booking) {
    throw new AppError('Booking not found', 404);
  }

  // If updating time, check for overlaps
  if (updateData.startTime || updateData.endTime) {
    const startTime = updateData.startTime ? new Date(updateData.startTime) : booking.startTime;
    const endTime = updateData.endTime ? new Date(updateData.endTime) : booking.endTime;

    const hasOverlap = await checkOverlappingBookings(
      booking.locationId.toString(),
      startTime,
      endTime,
      bookingId
    );

    if (hasOverlap) {
      throw new AppError('Updated booking time slot is not available', 409);
    }
  }

  return await Booking.findByIdAndUpdate(
    bookingId,
    { $set: updateData },
    { new: true, runValidators: true }
  );
}

export async function updateBookingStatus(bookingId: string, status: BookingStatus): Promise<IBookingDocument | null> {
  return await Booking.findByIdAndUpdate(
    bookingId,
    { status },
    { new: true }
  );
}

export async function cancelBooking(bookingId: string): Promise<IBookingDocument | null> {
  return await updateBookingStatus(bookingId, 'CANCELLED');
}

export async function deleteBooking(bookingId: string): Promise<void> {
  await Booking.findByIdAndDelete(bookingId);
}

export async function checkOverlappingBookings(
  locationId: string,
  startTime: Date,
  endTime: Date,
  excludeBookingId?: string
): Promise<boolean> {
  const overlappingBookings = await (Booking as unknown as IBookingModel).findOverlapping(
    locationId,
    startTime,
    endTime,
    excludeBookingId
  );

  return overlappingBookings.length > 0;
}

export async function getBookingsByStatus(status: BookingStatus): Promise<IBookingDocument[]> {
  return await Booking.find({ status })
    .populate('userId', 'profile.name email')
    .populate('locationId', 'name address')
    .sort({ startTime: 1 });
}

export async function getUpcomingBookings(userId?: string): Promise<IBookingDocument[]> {
  const now = new Date();
  const query: Record<string, unknown> = {
    startTime: { $gte: now },
    status: { $in: ['PENDING', 'CONFIRMED'] }
  };

  if (userId) {
    query.userId = userId;
  }

  return await Booking.find(query)
    .populate('userId', 'profile.name email')
    .populate('locationId', 'name address')
    .sort({ startTime: 1 });
} 