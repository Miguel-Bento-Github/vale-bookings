import Booking from '../models/Booking';
import { IBooking, IBookingDocument, IUpdateBookingRequest, BookingStatus, IBookingModel , AppError } from '../types';
import { standardUpdate, ensureDocumentExists, safeDelete } from '../utils/mongoHelpers';

import webSocketService from './WebSocketService';

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
  const savedBooking = await booking.save();

  // Emit WebSocket event for new booking
  webSocketService.emitBookingUpdate({
    bookingId: String(savedBooking._id),
    status: savedBooking.status,
    locationId: String(savedBooking.locationId),
    userId: String(savedBooking.userId),
    timestamp: new Date()
  });

  // Send notification to user
  webSocketService.sendUserNotification({
    userId: String(savedBooking.userId),
    type: 'booking_confirmed',
    title: 'Booking Confirmed',
    message: 'Your valet parking booking has been confirmed',
    data: {
      bookingId: String(savedBooking._id),
      locationId: String(savedBooking.locationId)
    },
    timestamp: new Date()
  });

  return savedBooking;
}

export async function findById(bookingId: string): Promise<IBookingDocument | null> {
  return await Booking.findById(bookingId);
}

export async function getUserBookings(
  userId: string,
  page: number = 1,
  limit: number = 10
): Promise<IBookingDocument[]> {
  const skip = (page - 1) * limit;
  return await Booking.find({ userId })
    .sort({ createdAt: -1 })
    .skip(skip)
    .limit(limit);
}

export async function getLocationBookings(
  locationId: string,
  startDate?: Date,
  endDate?: Date
): Promise<IBookingDocument[]> {
  return await (Booking as unknown as IBookingModel).findByLocationId(
    locationId,
    startDate,
    endDate
  );
}

export async function updateBooking(
  bookingId: string,
  updateData: IUpdateBookingRequest
): Promise<IBookingDocument | null> {
  const booking = await ensureDocumentExists(Booking, bookingId, 'Booking not found');

  // If updating time, check for overlaps
  if (updateData.startTime !== undefined || updateData.endTime !== undefined) {
    const startTime = updateData.startTime !== undefined ? new Date(updateData.startTime) : booking.startTime;
    const endTime = updateData.endTime !== undefined ? new Date(updateData.endTime) : booking.endTime;

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

  return await standardUpdate(Booking, bookingId, updateData as Partial<IBookingDocument>);
}

export async function updateBookingStatus(
  bookingId: string,
  status: BookingStatus
): Promise<IBookingDocument | null> {
  const updatedBooking = await standardUpdate(Booking, bookingId, { status } as Partial<IBookingDocument>);

  if (updatedBooking) {
    // Emit WebSocket event for status update
    webSocketService.emitBookingUpdate({
      bookingId: String(updatedBooking._id),
      status: updatedBooking.status,
      locationId: String(updatedBooking.locationId),
      userId: String(updatedBooking.userId),
      timestamp: new Date()
    });

    // Send notification for important status changes
    if (['COMPLETED', 'CANCELLED'].includes(status)) {
      const notificationType = status === 'COMPLETED' ? 'booking_completed' : 'booking_cancelled';
      const title = status === 'COMPLETED' ? 'Booking Completed' : 'Booking Cancelled';
      const message = status === 'COMPLETED'
        ? 'Your valet parking service has been completed'
        : 'Your valet parking booking has been cancelled';

      webSocketService.sendUserNotification({
        userId: String(updatedBooking.userId),
        type: notificationType,
        title,
        message,
        data: {
          bookingId: String(updatedBooking._id),
          locationId: String(updatedBooking.locationId)
        },
        timestamp: new Date()
      });
    }
  }

  return updatedBooking;
}

export async function cancelBooking(bookingId: string): Promise<IBookingDocument | null> {
  const booking = await ensureDocumentExists(Booking, bookingId, 'Booking not found');

  // Prevent cancellation of completed or already cancelled bookings
  if (booking.status === 'COMPLETED') {
    throw new AppError('Completed bookings cannot be cancelled', 400);
  }

  if (booking.status === 'CANCELLED') {
    throw new AppError('Booking is already cancelled', 400);
  }

  return await updateBookingStatus(bookingId, 'CANCELLED');
}

export async function deleteBooking(bookingId: string): Promise<void> {
  await safeDelete(Booking, bookingId, 'Booking not found');
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

  if (typeof userId === 'string') {
    query.userId = userId;
  }

  return await Booking.find(query)
    .populate('userId', 'profile.name email')
    .populate('locationId', 'name address')
    .sort({ startTime: 1 });
} 