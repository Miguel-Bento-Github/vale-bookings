import Schedule from '../../../src/models/Schedule';
import * as ScheduleService from '../../../src/services/ScheduleService';
import { AppError } from '../../../src/types';

// Mock the Schedule model
jest.mock('../../../src/models/Schedule');

// Type definitions for mocked Schedule
interface MockedScheduleModel {
    new: jest.Mock;
    findById: jest.Mock;
    find: jest.Mock;
    findByIdAndUpdate: jest.Mock;
    findByIdAndDelete: jest.Mock;
    findByLocationAndDay: jest.Mock;
    getWeeklySchedule: jest.Mock;
    getDayName: jest.Mock;
}

const MockedSchedule = Schedule as unknown as MockedScheduleModel;

describe('ScheduleService', () => {
  const mockScheduleData = {
    locationId: '507f1f77bcf86cd799439011',
    dayOfWeek: 1,
    startTime: '09:00',
    endTime: '17:00',
    isActive: true
  };

  const mockScheduleDocument = {
    _id: '507f1f77bcf86cd799439015',
    ...mockScheduleData,
    save: jest.fn(),
    isOpenAt: jest.fn(),
    getOperatingHours: jest.fn()
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('createSchedule', () => {
    it('should create a schedule successfully', async () => {
      const mockSave = jest.fn().mockResolvedValue(mockScheduleDocument);

      // Mock the Schedule constructor
      (Schedule as unknown as jest.Mock).mockImplementation(() => ({
        save: mockSave
      }));

      const result = await ScheduleService.createSchedule(mockScheduleData);

      expect(Schedule).toHaveBeenCalledWith(mockScheduleData);
      expect(mockSave).toHaveBeenCalled();
      expect(result).toEqual(mockScheduleDocument);
    });

    it('should throw AppError for duplicate schedule', async () => {
      const duplicateError = new Error('Duplicate key error') as Error & { code: number };
      duplicateError.code = 11000;

      const mockSave = jest.fn().mockRejectedValue(duplicateError);
      (Schedule as unknown as jest.Mock).mockImplementation(() => ({
        save: mockSave
      }));

      await expect(ScheduleService.createSchedule(mockScheduleData))
        .rejects
        .toThrow(new AppError('Schedule already exists for this location and day', 409));
    });

    it('should rethrow other errors', async () => {
      const otherError = new Error('Database connection failed');
      const mockSave = jest.fn().mockRejectedValue(otherError);
      (Schedule as unknown as jest.Mock).mockImplementation(() => ({
        save: mockSave
      }));

      await expect(ScheduleService.createSchedule(mockScheduleData))
        .rejects
        .toThrow('Database connection failed');
    });
  });

  describe('getScheduleById', () => {
    it('should get schedule by id successfully', async () => {
      const mockPopulate = jest.fn().mockResolvedValue(mockScheduleDocument);
      MockedSchedule.findById = jest.fn().mockReturnValue({
        populate: mockPopulate
      });

      const result = await ScheduleService.getScheduleById('507f1f77bcf86cd799439015');

      expect(MockedSchedule.findById).toHaveBeenCalledWith('507f1f77bcf86cd799439015');
      expect(mockPopulate).toHaveBeenCalledWith('locationId', 'name address');
      expect(result).toEqual(mockScheduleDocument);
    });

    it('should return null for non-existent schedule', async () => {
      const mockPopulate = jest.fn().mockResolvedValue(null);
      MockedSchedule.findById = jest.fn().mockReturnValue({
        populate: mockPopulate
      });

      const result = await ScheduleService.getScheduleById('nonexistent');

      expect(result).toBeNull();
    });
  });

  describe('getLocationSchedules', () => {
    it('should get location schedules successfully', async () => {
      const mockSchedules = [mockScheduleDocument];
      const mockSort = jest.fn().mockResolvedValue(mockSchedules);
      MockedSchedule.find = jest.fn().mockReturnValue({
        sort: mockSort
      });

      const result = await ScheduleService.getLocationSchedules('507f1f77bcf86cd799439011');

      expect(MockedSchedule.find).toHaveBeenCalledWith({
        locationId: '507f1f77bcf86cd799439011',
        isActive: true
      });
      expect(mockSort).toHaveBeenCalledWith({ dayOfWeek: 1 });
      expect(result).toEqual(mockSchedules);
    });
  });

  describe('updateSchedule', () => {
    it('should update schedule successfully', async () => {
      const updateData = { startTime: '08:00', endTime: '18:00' };
      MockedSchedule.findByIdAndUpdate = jest.fn().mockResolvedValue(mockScheduleDocument);

      const result = await ScheduleService.updateSchedule('507f1f77bcf86cd799439015', updateData);

      expect(MockedSchedule.findByIdAndUpdate).toHaveBeenCalledWith(
        '507f1f77bcf86cd799439015',
        { $set: updateData },
        { new: true, runValidators: true }
      );
      expect(result).toEqual(mockScheduleDocument);
    });

    it('should return null for non-existent schedule', async () => {
      MockedSchedule.findByIdAndUpdate = jest.fn().mockResolvedValue(null);

      const result = await ScheduleService.updateSchedule('nonexistent', { startTime: '08:00' });

      expect(result).toBeNull();
    });
  });

  describe('deleteSchedule', () => {
    it('should delete schedule successfully', async () => {
      MockedSchedule.findByIdAndDelete = jest.fn().mockResolvedValue(mockScheduleDocument);

      await ScheduleService.deleteSchedule('507f1f77bcf86cd799439015');

      expect(MockedSchedule.findByIdAndDelete).toHaveBeenCalledWith('507f1f77bcf86cd799439015');
    });
  });

  describe('getAllSchedules', () => {
    it('should get all schedules successfully', async () => {
      const mockSchedules = [mockScheduleDocument];
      const mockSort = jest.fn().mockResolvedValue(mockSchedules);
      const mockPopulate = jest.fn().mockReturnValue({
        sort: mockSort
      });
      MockedSchedule.find = jest.fn().mockReturnValue({
        populate: mockPopulate
      });

      const result = await ScheduleService.getAllSchedules();

      expect(MockedSchedule.find).toHaveBeenCalledWith({});
      expect(mockPopulate).toHaveBeenCalledWith('locationId', 'name address');
      expect(mockSort).toHaveBeenCalledWith({ locationId: 1, dayOfWeek: 1 });
      expect(result).toEqual(mockSchedules);
    });
  });

  describe('createBulkSchedules', () => {
    it('should create multiple schedules successfully', async () => {
      const schedulesData = [
        { ...mockScheduleData, dayOfWeek: 1 },
        { ...mockScheduleData, dayOfWeek: 2 }
      ];

      const mockSave = jest.fn().mockResolvedValue(mockScheduleDocument);
      (Schedule as unknown as jest.Mock).mockImplementation(() => ({
        save: mockSave
      }));

      const result = await ScheduleService.createBulkSchedules(schedulesData);

      expect(result.created).toHaveLength(2);
      expect(result.errors).toHaveLength(0);
    });

    it('should handle errors during bulk creation', async () => {
      const schedulesData = [
        { ...mockScheduleData, dayOfWeek: 1 },
        { ...mockScheduleData, dayOfWeek: 2 }
      ];

      const duplicateError = new AppError('Schedule already exists', 409);
      const mockSave = jest.fn()
        .mockResolvedValueOnce(mockScheduleDocument)
        .mockRejectedValueOnce(duplicateError);

      (Schedule as unknown as jest.Mock).mockImplementation(() => ({
        save: mockSave
      }));

      const result = await ScheduleService.createBulkSchedules(schedulesData);

      expect(result.created).toHaveLength(1);
      expect(result.errors).toHaveLength(1);
      expect(result.errors[0]).toContain('Schedule already exists');
    });

    it('should handle unknown errors during bulk creation', async () => {
      const schedulesData = [{ ...mockScheduleData, dayOfWeek: 1 }];

      const unknownError = new Error('Unknown error');
      const mockSave = jest.fn().mockRejectedValue(unknownError);
      (Schedule as unknown as jest.Mock).mockImplementation(() => ({
        save: mockSave
      }));

      const result = await ScheduleService.createBulkSchedules(schedulesData);

      expect(result.created).toHaveLength(0);
      expect(result.errors).toHaveLength(1);
      expect(result.errors[0]).toContain('Unknown error');
    });
  });

  describe('getScheduleByLocationAndDay', () => {
    it('should get schedule by location and day', async () => {
      MockedSchedule.findByLocationAndDay = jest.fn().mockResolvedValue(mockScheduleDocument);

      const result = await ScheduleService.getScheduleByLocationAndDay('507f1f77bcf86cd799439011', 1);

      expect(MockedSchedule.findByLocationAndDay).toHaveBeenCalledWith('507f1f77bcf86cd799439011', 1);
      expect(result).toEqual(mockScheduleDocument);
    });
  });

  describe('getWeeklySchedule', () => {
    it('should get weekly schedule for location', async () => {
      const mockWeeklySchedule = [mockScheduleDocument];
      MockedSchedule.getWeeklySchedule = jest.fn().mockResolvedValue(mockWeeklySchedule);

      const result = await ScheduleService.getWeeklySchedule('507f1f77bcf86cd799439011');

      expect(MockedSchedule.getWeeklySchedule).toHaveBeenCalledWith('507f1f77bcf86cd799439011');
      expect(result).toEqual(mockWeeklySchedule);
    });
  });

  describe('deactivateSchedule', () => {
    it('should deactivate schedule successfully', async () => {
      const deactivatedSchedule = { ...mockScheduleDocument, isActive: false };
      MockedSchedule.findByIdAndUpdate = jest.fn().mockResolvedValue(deactivatedSchedule);

      const result = await ScheduleService.deactivateSchedule('507f1f77bcf86cd799439015');

      expect(MockedSchedule.findByIdAndUpdate).toHaveBeenCalledWith(
        '507f1f77bcf86cd799439015',
        { $set: { isActive: false } },
        { new: true, runValidators: true }
      );
      expect(result).toEqual(deactivatedSchedule);
    });
  });

  describe('isLocationOpen', () => {
    it('should return true when location is open', async () => {
      const mockSchedule = {
        ...mockScheduleDocument,
        isOpenAt: jest.fn().mockReturnValue(true)
      };
      MockedSchedule.findByLocationAndDay = jest.fn().mockResolvedValue(mockSchedule);

      const result = await ScheduleService.isLocationOpen('507f1f77bcf86cd799439011', 1, '10:00');

      expect(MockedSchedule.findByLocationAndDay).toHaveBeenCalledWith('507f1f77bcf86cd799439011', 1);
      expect(mockSchedule.isOpenAt).toHaveBeenCalledWith('10:00');
      expect(result).toBe(true);
    });

    it('should return false when no schedule exists', async () => {
      MockedSchedule.findByLocationAndDay = jest.fn().mockResolvedValue(null);

      const result = await ScheduleService.isLocationOpen('507f1f77bcf86cd799439011', 1, '10:00');

      expect(result).toBe(false);
    });

    it('should return false when location is closed', async () => {
      const mockSchedule = {
        ...mockScheduleDocument,
        isOpenAt: jest.fn().mockReturnValue(false)
      };
      MockedSchedule.findByLocationAndDay = jest.fn().mockResolvedValue(mockSchedule);

      const result = await ScheduleService.isLocationOpen('507f1f77bcf86cd799439011', 1, '22:00');

      expect(result).toBe(false);
    });
  });

  describe('getOperatingHours', () => {
    it('should return operating hours when schedule exists', async () => {
      const mockSchedule = {
        ...mockScheduleDocument,
        getOperatingHours: jest.fn().mockReturnValue(8)
      };
      MockedSchedule.findByLocationAndDay = jest.fn().mockResolvedValue(mockSchedule);

      const result = await ScheduleService.getOperatingHours('507f1f77bcf86cd799439011', 1);

      expect(MockedSchedule.findByLocationAndDay).toHaveBeenCalledWith('507f1f77bcf86cd799439011', 1);
      expect(mockSchedule.getOperatingHours).toHaveBeenCalled();
      expect(result).toBe(8);
    });

    it('should return null when no schedule exists', async () => {
      MockedSchedule.findByLocationAndDay = jest.fn().mockResolvedValue(null);

      const result = await ScheduleService.getOperatingHours('507f1f77bcf86cd799439011', 1);

      expect(result).toBeNull();
    });
  });

  describe('updateLocationSchedules', () => {
    it('should update existing schedules', async () => {
      const schedulesData = [
        { dayOfWeek: 1, startTime: '08:00', endTime: '18:00' }
      ];

      const existingSchedule = { ...mockScheduleDocument, _id: '507f1f77bcf86cd799439015' };
      const updatedSchedule = { ...existingSchedule, startTime: '08:00' };

      MockedSchedule.findByLocationAndDay = jest.fn().mockResolvedValue(existingSchedule);
      MockedSchedule.findByIdAndUpdate = jest.fn().mockResolvedValue(updatedSchedule);

      const result = await ScheduleService.updateLocationSchedules('507f1f77bcf86cd799439011', schedulesData);

      expect(MockedSchedule.findByLocationAndDay).toHaveBeenCalledWith('507f1f77bcf86cd799439011', 1);
      expect(MockedSchedule.findByIdAndUpdate).toHaveBeenCalled();
      expect(result).toHaveLength(1);
      expect(result[0]).toEqual(updatedSchedule);
    });

    it('should create new schedules when they do not exist', async () => {
      const schedulesData = [
        { dayOfWeek: 2, startTime: '09:00', endTime: '17:00' }
      ];

      MockedSchedule.findByLocationAndDay = jest.fn().mockResolvedValue(null);
      const mockSave = jest.fn().mockResolvedValue(mockScheduleDocument);
      (Schedule as unknown as jest.Mock).mockImplementation(() => ({
        save: mockSave
      }));

      const result = await ScheduleService.updateLocationSchedules('507f1f77bcf86cd799439011', schedulesData);

      expect(MockedSchedule.findByLocationAndDay).toHaveBeenCalledWith('507f1f77bcf86cd799439011', 2);
      expect(Schedule).toHaveBeenCalledWith({
        locationId: '507f1f77bcf86cd799439011',
        dayOfWeek: 2,
        startTime: '09:00',
        endTime: '17:00',
        isActive: true
      });
      expect(result).toHaveLength(1);
    });

    it('should skip invalid schedule data', async () => {
      const schedulesData = [
        { dayOfWeek: 'invalid' as unknown as number, startTime: '09:00' }
      ];

      const result = await ScheduleService.updateLocationSchedules('507f1f77bcf86cd799439011', schedulesData);

      expect(result).toHaveLength(0);
    });
  });

  describe('getDayName', () => {
    it('should get day name', () => {
      MockedSchedule.getDayName = jest.fn().mockReturnValue('Monday');

      const result = ScheduleService.getDayName(1);

      expect(MockedSchedule.getDayName).toHaveBeenCalledWith(1);
      expect(result).toBe('Monday');
    });
  });
}); 