import Booking from '../models/Booking';
import { IBooking, IBookingDocument, IUpdateBookingRequest, BookingStatus, IBookingModel } from '../types';
import { AppError } from '../types';

class BookingService {
  async createBooking(bookingData: IBooking): Promise<IBookingDocument> {
    // Check for overlapping bookings
    const hasOverlap = await this.checkOverlappingBookings(
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

  async findById(bookingId: string): Promise<IBookingDocument | null> {
    return await Booking.findById(bookingId);
  }

  async getUserBookings(userId: string, page: number = 1, limit: number = 10): Promise<IBookingDocument[]> {
    const skip = (page - 1) * limit;
    return await Booking.find({ userId })
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit);
  }

  async getLocationBookings(locationId: string, startDate?: Date, endDate?: Date): Promise<IBookingDocument[]> {
    return await (Booking as unknown as IBookingModel).findByLocationId(locationId, startDate, endDate);
  }

  async updateBooking(bookingId: string, updateData: IUpdateBookingRequest): Promise<IBookingDocument | null> {
    const booking = await Booking.findById(bookingId);
    
    if (!booking) {
      throw new AppError('Booking not found', 404);
    }

    // If updating time, check for overlaps
    if (updateData.startTime || updateData.endTime) {
      const startTime = updateData.startTime ? new Date(updateData.startTime) : booking.startTime;
      const endTime = updateData.endTime ? new Date(updateData.endTime) : booking.endTime;
      
      const hasOverlap = await this.checkOverlappingBookings(
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

  async updateBookingStatus(bookingId: string, status: BookingStatus): Promise<IBookingDocument | null> {
    return await Booking.findByIdAndUpdate(
      bookingId,
      { status },
      { new: true }
    );
  }

  async cancelBooking(bookingId: string): Promise<IBookingDocument | null> {
    return await this.updateBookingStatus(bookingId, 'CANCELLED');
  }

  async deleteBooking(bookingId: string): Promise<void> {
    await Booking.findByIdAndDelete(bookingId);
  }

  async checkOverlappingBookings(
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

  async getBookingsByStatus(status: BookingStatus): Promise<IBookingDocument[]> {
    return await Booking.find({ status })
      .populate('userId', 'profile.name email')
      .populate('locationId', 'name address')
      .sort({ startTime: 1 });
  }

  async getUpcomingBookings(userId?: string): Promise<IBookingDocument[]> {
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
}

export default new BookingService(); 