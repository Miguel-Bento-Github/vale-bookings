import mongoose from 'mongoose';

import Booking from '../../../src/models/Booking';

describe('Booking Model Unit Tests', () => {
    describe('Schema validation', () => {
        const validBookingData = {
            userId: new mongoose.Types.ObjectId(),
            locationId: new mongoose.Types.ObjectId(),
            startTime: new Date(Date.now() + 3600000), // 1 hour from now
            endTime: new Date(Date.now() + 7200000), // 2 hours from now
            status: 'PENDING' as const,
            price: 25.50
        };

        it('should validate required fields', async () => {
            const booking = new Booking({});

            await expect(booking.validate()).rejects.toThrow();
        });

        it('should require userId', async () => {
            const booking = new Booking({
                ...validBookingData,
                userId: undefined
            });

            await expect(booking.validate()).rejects.toThrow('User ID is required');
        });

        it('should require locationId', async () => {
            const booking = new Booking({
                ...validBookingData,
                locationId: undefined
            });

            await expect(booking.validate()).rejects.toThrow('Location ID is required');
        });

        it('should require startTime', async () => {
            const booking = new Booking({
                ...validBookingData,
                startTime: undefined
            });

            await expect(booking.validate()).rejects.toThrow('Start time is required');
        });

        it('should require endTime', async () => {
            const booking = new Booking({
                ...validBookingData,
                endTime: undefined
            });

            await expect(booking.validate()).rejects.toThrow('End time is required');
        });

        it('should default status to PENDING', async () => {
            const booking = new Booking({
                ...validBookingData,
                status: undefined
            });

            await booking.validate();
            expect(booking.status).toBe('PENDING');
        });

        it('should validate status enum', async () => {
            const booking = new Booking({
                ...validBookingData,
                status: 'INVALID_STATUS' as any
            });

            await expect(booking.validate()).rejects.toThrow();
        });

        it('should validate price is positive', async () => {
            const booking = new Booking({
                ...validBookingData,
                price: -10
            });

            await expect(booking.validate()).rejects.toThrow('Price must be positive');
        });

        it('should validate endTime is after startTime', async () => {
            const booking = new Booking({
                ...validBookingData,
                startTime: new Date(Date.now() + 7200000), // 2 hours from now
                endTime: new Date(Date.now() + 3600000) // 1 hour from now (before start)
            });

            await expect(booking.validate()).rejects.toThrow('End time must be after start time');
        });

        it('should prevent booking in the past for new bookings', async () => {
            const pastDate = new Date(Date.now() - 3600000); // 1 hour ago
            const booking = new Booking({
                ...validBookingData,
                startTime: pastDate,
                endTime: new Date(pastDate.getTime() + 3600000)
            });

            await expect(booking.validate()).rejects.toThrow('Cannot create booking in the past');
        });

        it('should accept valid booking data', async () => {
            const booking = new Booking(validBookingData);

            await expect(booking.validate()).resolves.not.toThrow();
        });

        it('should handle notes field', async () => {
            const booking = new Booking({
                ...validBookingData,
                notes: 'Special parking instructions'
            });

            await booking.validate();
            expect(booking.notes).toBe('Special parking instructions');
        });

        it('should validate notes length', async () => {
            const booking = new Booking({
                ...validBookingData,
                notes: 'A'.repeat(1001) // Too long
            });

            await expect(booking.validate()).rejects.toThrow('Notes cannot exceed 1000 characters');
        });
    });

    describe('Instance method getDurationHours', () => {
        it('should calculate duration correctly', () => {
            const startTime = new Date('2024-01-01T10:00:00Z');
            const endTime = new Date('2024-01-01T13:30:00Z'); // 3.5 hours later

            const booking = new Booking({
                userId: new mongoose.Types.ObjectId(),
                locationId: new mongoose.Types.ObjectId(),
                startTime,
                endTime,
                status: 'PENDING',
                price: 25
            });

            const duration = booking.getDurationHours();
            expect(duration).toBe(3.5);
        });

        it('should handle same start and end time', () => {
            const time = new Date('2024-01-01T10:00:00Z');

            const booking = new Booking({
                userId: new mongoose.Types.ObjectId(),
                locationId: new mongoose.Types.ObjectId(),
                startTime: time,
                endTime: time,
                status: 'PENDING',
                price: 0
            });

            const duration = booking.getDurationHours();
            expect(duration).toBe(0);
        });

        it('should handle fractional hours', () => {
            const startTime = new Date('2024-01-01T10:00:00Z');
            const endTime = new Date('2024-01-01T10:45:00Z'); // 45 minutes = 0.75 hours

            const booking = new Booking({
                userId: new mongoose.Types.ObjectId(),
                locationId: new mongoose.Types.ObjectId(),
                startTime,
                endTime,
                status: 'PENDING',
                price: 25
            });

            const duration = booking.getDurationHours();
            expect(duration).toBe(0.75);
        });
    });

    describe('Static method findOverlapping', () => {
        it('should call find with correct query', async () => {
            const mockFind = jest.fn().mockResolvedValue([]);
            jest.spyOn(Booking, 'find').mockImplementation(mockFind);

            const locationId = new mongoose.Types.ObjectId().toString();
            const startTime = new Date('2024-01-01T10:00:00Z');
            const endTime = new Date('2024-01-01T12:00:00Z');

            await Booking.findOverlapping(locationId, startTime, endTime);

            expect(mockFind).toHaveBeenCalledWith({
                locationId,
                status: { $nin: ['CANCELLED', 'COMPLETED'] },
                $or: [
                    {
                        startTime: { $lt: endTime },
                        endTime: { $gt: startTime }
                    }
                ]
            });

            jest.restoreAllMocks();
        });

        it('should exclude specific booking ID when provided', async () => {
            const mockFind = jest.fn().mockResolvedValue([]);
            jest.spyOn(Booking, 'find').mockImplementation(mockFind);

            const locationId = new mongoose.Types.ObjectId().toString();
            const excludeId = new mongoose.Types.ObjectId().toString();
            const startTime = new Date('2024-01-01T10:00:00Z');
            const endTime = new Date('2024-01-01T12:00:00Z');

            await Booking.findOverlapping(locationId, startTime, endTime, excludeId);

            expect(mockFind).toHaveBeenCalledWith({
                locationId,
                _id: { $ne: excludeId },
                status: { $nin: ['CANCELLED', 'COMPLETED'] },
                $or: [
                    {
                        startTime: { $lt: endTime },
                        endTime: { $gt: startTime }
                    }
                ]
            });

            jest.restoreAllMocks();
        });
    });

    describe('Static method findByUserId', () => {
        it('should call find with correct query and population', async () => {
            const mockFind = jest.fn().mockReturnValue({
                populate: jest.fn().mockReturnValue({
                    sort: jest.fn().mockResolvedValue([])
                })
            });
            jest.spyOn(Booking, 'find').mockImplementation(mockFind);

            const userId = new mongoose.Types.ObjectId().toString();

            await Booking.findByUserId(userId);

            expect(mockFind).toHaveBeenCalledWith({ userId });

            jest.restoreAllMocks();
        });
    });

    describe('Static method findByLocationId', () => {
        it('should call find with correct query and population', async () => {
            const mockFind = jest.fn().mockReturnValue({
                populate: jest.fn().mockReturnValue({
                    sort: jest.fn().mockResolvedValue([])
                })
            });
            jest.spyOn(Booking, 'find').mockImplementation(mockFind);

            const locationId = new mongoose.Types.ObjectId().toString();

            await Booking.findByLocationId(locationId);

            expect(mockFind).toHaveBeenCalledWith({ locationId });

            jest.restoreAllMocks();
        });

        it('should filter by date range when provided', async () => {
            const mockFind = jest.fn().mockReturnValue({
                populate: jest.fn().mockReturnValue({
                    sort: jest.fn().mockResolvedValue([])
                })
            });
            jest.spyOn(Booking, 'find').mockImplementation(mockFind);

            const locationId = new mongoose.Types.ObjectId().toString();
            const startDate = new Date('2024-01-01');
            const endDate = new Date('2024-01-31');

            await Booking.findByLocationId(locationId, startDate, endDate);

            expect(mockFind).toHaveBeenCalledWith({
                locationId,
                startTime: { $gte: startDate, $lte: endDate }
            });

            jest.restoreAllMocks();
        });
    });

    describe('Pre-save validation', () => {
        it('should not validate past dates for existing bookings', async () => {
            // Create a booking that would be valid
            const futureDate = new Date(Date.now() + 3600000);
            const booking = new Booking({
                userId: new mongoose.Types.ObjectId(),
                locationId: new mongoose.Types.ObjectId(),
                startTime: futureDate,
                endTime: new Date(futureDate.getTime() + 3600000),
                status: 'PENDING',
                price: 25
            });

            // Simulate that this is an existing booking by setting isNew to false
            booking.isNew = false;

            // Now set a past date - this should be allowed for existing bookings
            booking.startTime = new Date(Date.now() - 3600000);
            booking.endTime = new Date(Date.now() - 1800000);

            await expect(booking.validate()).resolves.not.toThrow();
        });
    });

    describe('Edge cases', () => {
        it('should handle very small price values', async () => {
            const booking = new Booking({
                userId: new mongoose.Types.ObjectId(),
                locationId: new mongoose.Types.ObjectId(),
                startTime: new Date(Date.now() + 3600000),
                endTime: new Date(Date.now() + 7200000),
                status: 'PENDING',
                price: 0.01
            });

            await expect(booking.validate()).resolves.not.toThrow();
        });

        it('should handle large price values', async () => {
            const booking = new Booking({
                userId: new mongoose.Types.ObjectId(),
                locationId: new mongoose.Types.ObjectId(),
                startTime: new Date(Date.now() + 3600000),
                endTime: new Date(Date.now() + 7200000),
                status: 'PENDING',
                price: 999999.99
            });

            await expect(booking.validate()).resolves.not.toThrow();
        });

        it('should handle all valid status values', async () => {
            const statuses = ['PENDING', 'CONFIRMED', 'IN_PROGRESS', 'COMPLETED', 'CANCELLED'];

            for (const status of statuses) {
                const booking = new Booking({
                    userId: new mongoose.Types.ObjectId(),
                    locationId: new mongoose.Types.ObjectId(),
                    startTime: new Date(Date.now() + 3600000),
                    endTime: new Date(Date.now() + 7200000),
                    status: status as any,
                    price: 25
                });

                await expect(booking.validate()).resolves.not.toThrow();
            }
        });
    });
}); 