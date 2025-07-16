import Booking from '../../../src/models/Booking';
import * as BookingService from '../../../src/services/BookingService';
import { AppError, BookingStatus } from '../../../src/types';

jest.mock('../../../src/models/Booking');

interface MockedBookingModel {
    findById: jest.Mock;
    find: jest.Mock;
    findByIdAndUpdate: jest.Mock;
    findByIdAndDelete: jest.Mock;
    findByLocationId: jest.Mock;
    findOverlapping: jest.Mock;
}

const MockedBooking = Booking as unknown as MockedBookingModel;

describe('BookingService', () => {
  const mockBookingData = {
    userId: '507f1f77bcf86cd799439011',
    locationId: '507f1f77bcf86cd799439012',
    startTime: new Date('2024-01-15T10:00:00Z'),
    endTime: new Date('2024-01-15T11:00:00Z'),
    status: 'PENDING' as BookingStatus,
    price: 50
  };

  const mockBookingDocument = {
    _id: '507f1f77bcf86cd799439015',
    ...mockBookingData,
    save: jest.fn()
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('createBooking', () => {
    it('should create booking when no overlap exists', async () => {
      MockedBooking.findOverlapping = jest.fn().mockResolvedValue([]);
      const mockSave = jest.fn().mockResolvedValue(mockBookingDocument);
      (Booking as unknown as jest.Mock).mockImplementation(() => ({
        save: mockSave
      }));

      const result = await BookingService.createBooking(mockBookingData);

      expect(MockedBooking.findOverlapping).toHaveBeenCalledWith(
        mockBookingData.locationId,
        mockBookingData.startTime,
        mockBookingData.endTime,
        undefined
      );
      expect(result).toEqual(mockBookingDocument);
    });

    it('should throw error when overlap exists', async () => {
      MockedBooking.findOverlapping = jest.fn().mockResolvedValue([{ _id: 'existing' }]);

      await expect(BookingService.createBooking(mockBookingData))
        .rejects
        .toThrow(new AppError('Booking time slot is not available', 409));
    });
  });

  describe('findById', () => {
    it('should find booking by id', async () => {
      const mockChain = {
        populate: jest.fn().mockReturnThis(),
      };
      // The second populate call should resolve with the document
      mockChain.populate.mockReturnValueOnce(mockChain).mockResolvedValueOnce(mockBookingDocument);
      
      MockedBooking.findById = jest.fn().mockReturnValue(mockChain);

      const result = await BookingService.findById('507f1f77bcf86cd799439015');

      expect(MockedBooking.findById).toHaveBeenCalledWith('507f1f77bcf86cd799439015');
      expect(result).toEqual(mockBookingDocument);
    });
  });

  describe('getUserBookings', () => {
    it('should get user bookings with pagination', async () => {
      const mockBookings = [mockBookingDocument];
      const mockSort = jest.fn().mockReturnValue({
        skip: jest.fn().mockReturnValue({
          limit: jest.fn().mockResolvedValue(mockBookings)
        })
      });
      const mockPopulate = jest.fn().mockReturnValue({
        populate: jest.fn().mockReturnValue({
          sort: mockSort
        })
      });
      MockedBooking.find = jest.fn().mockReturnValue({
        populate: mockPopulate
      });

      const result = await BookingService.getUserBookings('507f1f77bcf86cd799439011', 2, 5);

      expect(MockedBooking.find).toHaveBeenCalledWith({ userId: '507f1f77bcf86cd799439011' });
      expect(mockSort).toHaveBeenCalledWith({ createdAt: -1 });
      expect(result).toEqual(mockBookings);
    });
  });

  describe('getLocationBookings', () => {
    it('should get location bookings', async () => {
      const startDate = new Date('2024-01-01');
      const endDate = new Date('2024-01-31');
      MockedBooking.findByLocationId = jest.fn().mockResolvedValue([mockBookingDocument]);

      const result = await BookingService.getLocationBookings('507f1f77bcf86cd799439012', startDate, endDate);

      expect(MockedBooking.findByLocationId).toHaveBeenCalledWith('507f1f77bcf86cd799439012', startDate, endDate);
      expect(result).toEqual([mockBookingDocument]);
    });
  });

  describe('updateBooking', () => {
    it('should update booking without time changes', async () => {
      const updateData = { status: 'CONFIRMED' as BookingStatus };
      MockedBooking.findById = jest.fn().mockResolvedValue(mockBookingDocument);
      MockedBooking.findByIdAndUpdate = jest.fn().mockResolvedValue({ ...mockBookingDocument, ...updateData });

      const result = await BookingService.updateBooking('507f1f77bcf86cd799439015', updateData);

      expect(MockedBooking.findById).toHaveBeenCalledWith('507f1f77bcf86cd799439015');
      expect(MockedBooking.findByIdAndUpdate).toHaveBeenCalledWith(
        '507f1f77bcf86cd799439015',
        { $set: updateData },
        { new: true, runValidators: true }
      );
      expect(result?.status).toBe('CONFIRMED');
    });

    it('should throw error when booking not found', async () => {
      MockedBooking.findById = jest.fn().mockResolvedValue(null);

      await expect(BookingService.updateBooking('nonexistent', { status: 'CONFIRMED' as BookingStatus }))
        .rejects
        .toThrow(new AppError('Booking not found', 404));
    });

    it('should update booking with time changes when no overlap', async () => {
      const updateData = {
        startTime: '2024-01-15T14:00:00Z',
        endTime: '2024-01-15T15:00:00Z'
      };
      MockedBooking.findById = jest.fn().mockResolvedValue(mockBookingDocument);
      MockedBooking.findOverlapping = jest.fn().mockResolvedValue([]);
      MockedBooking.findByIdAndUpdate = jest.fn().mockResolvedValue({ ...mockBookingDocument, ...updateData });

      const result = await BookingService.updateBooking('507f1f77bcf86cd799439015', updateData);

      expect(MockedBooking.findOverlapping).toHaveBeenCalledWith(
        mockBookingDocument.locationId.toString(),
        new Date(updateData.startTime),
        new Date(updateData.endTime),
        '507f1f77bcf86cd799439015'
      );
      expect(result).toBeDefined();
    });

    it('should throw error when time update causes overlap', async () => {
      const updateData = {
        startTime: '2024-01-15T14:00:00Z',
        endTime: '2024-01-15T15:00:00Z'
      };
      MockedBooking.findById = jest.fn().mockResolvedValue(mockBookingDocument);
      MockedBooking.findOverlapping = jest.fn().mockResolvedValue([{ _id: 'conflicting' }]);

      await expect(BookingService.updateBooking('507f1f77bcf86cd799439015', updateData))
        .rejects
        .toThrow(new AppError('Updated booking time slot is not available', 409));
    });
  });

  describe('updateBookingStatus', () => {
    it('should update booking status', async () => {
      const updatedBooking = { ...mockBookingDocument, status: 'CONFIRMED' as BookingStatus };
      MockedBooking.findByIdAndUpdate = jest.fn().mockResolvedValue(updatedBooking);

      const result = await BookingService.updateBookingStatus('507f1f77bcf86cd799439015', 'CONFIRMED');

      expect(MockedBooking.findByIdAndUpdate).toHaveBeenCalledWith(
        '507f1f77bcf86cd799439015',
        { $set: { status: 'CONFIRMED' } },
        { new: true, runValidators: true }
      );
      expect(result).toEqual(updatedBooking);
    });
  });

  describe('cancelBooking', () => {
    it('should cancel pending booking', async () => {
      const pendingBooking = { ...mockBookingDocument, status: 'PENDING' as BookingStatus };
      MockedBooking.findById = jest.fn().mockResolvedValue(pendingBooking);
      MockedBooking.findByIdAndUpdate = jest.fn().mockResolvedValue({ ...pendingBooking, status: 'CANCELLED' });

      const result = await BookingService.cancelBooking('507f1f77bcf86cd799439015');

      expect(MockedBooking.findById).toHaveBeenCalledWith('507f1f77bcf86cd799439015');
      expect(result?.status).toBe('CANCELLED');
    });

    it('should throw error when booking not found', async () => {
      MockedBooking.findById = jest.fn().mockResolvedValue(null);

      await expect(BookingService.cancelBooking('nonexistent'))
        .rejects
        .toThrow(new AppError('Booking not found', 404));
    });

    it('should throw error when cancelling completed booking', async () => {
      const completedBooking = { ...mockBookingDocument, status: 'COMPLETED' as BookingStatus };
      MockedBooking.findById = jest.fn().mockResolvedValue(completedBooking);

      await expect(BookingService.cancelBooking('507f1f77bcf86cd799439015'))
        .rejects
        .toThrow(new AppError('Completed bookings cannot be cancelled', 400));
    });

    it('should throw error when booking already cancelled', async () => {
      const cancelledBooking = { ...mockBookingDocument, status: 'CANCELLED' as BookingStatus };
      MockedBooking.findById = jest.fn().mockResolvedValue(cancelledBooking);

      await expect(BookingService.cancelBooking('507f1f77bcf86cd799439015'))
        .rejects
        .toThrow(new AppError('Booking is already cancelled', 400));
    });
  });

  describe('deleteBooking', () => {
    it('should delete booking', async () => {
      MockedBooking.findByIdAndDelete = jest.fn().mockResolvedValue(mockBookingDocument);

      await BookingService.deleteBooking('507f1f77bcf86cd799439015');

      expect(MockedBooking.findByIdAndDelete).toHaveBeenCalledWith('507f1f77bcf86cd799439015');
    });
  });

  describe('checkOverlappingBookings', () => {
    it('should return true when overlapping bookings exist', async () => {
      MockedBooking.findOverlapping = jest.fn().mockResolvedValue([{ _id: 'overlap' }]);

      const result = await BookingService.checkOverlappingBookings(
        '507f1f77bcf86cd799439012',
        new Date('2024-01-15T10:00:00Z'),
        new Date('2024-01-15T11:00:00Z')
      );

      expect(result).toBe(true);
    });

    it('should return false when no overlapping bookings exist', async () => {
      MockedBooking.findOverlapping = jest.fn().mockResolvedValue([]);

      const result = await BookingService.checkOverlappingBookings(
        '507f1f77bcf86cd799439012',
        new Date('2024-01-15T10:00:00Z'),
        new Date('2024-01-15T11:00:00Z')
      );

      expect(result).toBe(false);
    });
  });

  describe('getBookingsByStatus', () => {
    it('should get bookings by status with populated fields', async () => {
      const mockPopulate = jest.fn().mockReturnValue({
        populate: jest.fn().mockReturnValue({
          sort: jest.fn().mockResolvedValue([mockBookingDocument])
        })
      });
      MockedBooking.find = jest.fn().mockReturnValue({
        populate: mockPopulate
      });

      const result = await BookingService.getBookingsByStatus('PENDING');

      expect(MockedBooking.find).toHaveBeenCalledWith({ status: 'PENDING' });
      expect(result).toEqual([mockBookingDocument]);
    });
  });

  describe('getUpcomingBookings', () => {
    it('should get upcoming bookings for specific user', async () => {
      const mockPopulate = jest.fn().mockReturnValue({
        populate: jest.fn().mockReturnValue({
          sort: jest.fn().mockResolvedValue([mockBookingDocument])
        })
      });
      MockedBooking.find = jest.fn().mockReturnValue({
        populate: mockPopulate
      });

      const result = await BookingService.getUpcomingBookings('507f1f77bcf86cd799439011');

      expect(MockedBooking.find).toHaveBeenCalledWith({
        startTime: { $gte: expect.any(Date) },
        status: { $in: ['PENDING', 'CONFIRMED'] },
        userId: '507f1f77bcf86cd799439011'
      });
      expect(result).toEqual([mockBookingDocument]);
    });

    it('should get all upcoming bookings when no user specified', async () => {
      const mockPopulate = jest.fn().mockReturnValue({
        populate: jest.fn().mockReturnValue({
          sort: jest.fn().mockResolvedValue([mockBookingDocument])
        })
      });
      MockedBooking.find = jest.fn().mockReturnValue({
        populate: mockPopulate
      });

      const result = await BookingService.getUpcomingBookings();

      expect(MockedBooking.find).toHaveBeenCalledWith({
        startTime: { $gte: expect.any(Date) },
        status: { $in: ['PENDING', 'CONFIRMED'] }
      });
      expect(result).toEqual([mockBookingDocument]);
    });
  });
}); 