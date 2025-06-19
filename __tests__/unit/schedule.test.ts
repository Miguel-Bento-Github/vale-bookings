import mongoose from 'mongoose';

import Schedule from '../../src/models/Schedule';

describe('Schedule Model Unit Tests', () => {
  describe('Pre-validation hooks', () => {
    it('should pass validation when startTime and endTime are valid strings', async () => {
      const scheduleData = {
        locationId: new mongoose.Types.ObjectId(),
        dayOfWeek: 1,
        startTime: '09:00',
        endTime: '17:00'
      };

      const schedule = new Schedule(scheduleData);

      // This should not throw an error
      await expect(schedule.validate()).resolves.not.toThrow();
    });

    it('should fail validation when endTime is before startTime', async () => {
      const scheduleData = {
        locationId: new mongoose.Types.ObjectId(),
        dayOfWeek: 1,
        startTime: '17:00',
        endTime: '09:00' // End before start
      };

      const schedule = new Schedule(scheduleData);

      await expect(schedule.validate()).rejects.toThrow('End time must be after start time');
    });

    it('should fail validation when endTime equals startTime', async () => {
      const scheduleData = {
        locationId: new mongoose.Types.ObjectId(),
        dayOfWeek: 1,
        startTime: '09:00',
        endTime: '09:00' // Same time
      };

      const schedule = new Schedule(scheduleData);

      await expect(schedule.validate()).rejects.toThrow('End time must be after start time');
    });

    it('should pass validation when startTime or endTime are not strings', async () => {
      const scheduleData = {
        locationId: new mongoose.Types.ObjectId(),
        dayOfWeek: 1,
        startTime: null, // Not a string
        endTime: '17:00'
      };

      const schedule = new Schedule(scheduleData);

      // Should not throw error in pre-validation, but will fail required validation
      try {
        await schedule.validate();
      } catch (error) {
        // Should be a required field error, not our custom validation error
        expect((error as Error).message).not.toContain('End time must be after start time');
      }
    });
  });

  describe('Static method getDayName', () => {
    it('should return correct day names for valid numbers', () => {
      expect(Schedule.getDayName(0)).toBe('Sunday');
      expect(Schedule.getDayName(1)).toBe('Monday');
      expect(Schedule.getDayName(2)).toBe('Tuesday');
      expect(Schedule.getDayName(3)).toBe('Wednesday');
      expect(Schedule.getDayName(4)).toBe('Thursday');
      expect(Schedule.getDayName(5)).toBe('Friday');
      expect(Schedule.getDayName(6)).toBe('Saturday');
    });

    it('should return "Invalid Day" for numbers outside range', () => {
      expect(Schedule.getDayName(-1)).toBe('Invalid Day');
      expect(Schedule.getDayName(7)).toBe('Invalid Day');
      expect(Schedule.getDayName(100)).toBe('Invalid Day');
    });

    it('should return "Invalid Day" for non-number inputs', () => {
      expect(Schedule.getDayName('invalid' as unknown as number)).toBe('Invalid Day');
      expect(Schedule.getDayName(null as unknown as number)).toBe('Invalid Day');
      expect(Schedule.getDayName(undefined as unknown as number)).toBe('Invalid Day');
      expect(Schedule.getDayName({} as unknown as number)).toBe('Invalid Day');
    });
  });

  describe('Static method findByLocationId', () => {
    it('should include isActive filter when activeOnly is true', async () => {
      const locationId = 'test-location-id';

      // Mock the model find method
      const mockFind = jest.fn().mockReturnValue({
        populate: jest.fn().mockReturnValue({
          sort: jest.fn().mockResolvedValue([])
        })
      });

      // Temporarily replace the find method
      const originalFind = Schedule.find;
      Schedule.find = mockFind;

      await Schedule.findByLocationId(locationId, true);

      expect(mockFind).toHaveBeenCalledWith({ locationId, isActive: true });

      // Restore original method
      Schedule.find = originalFind;
    });

    it('should not include isActive filter when activeOnly is false', async () => {
      const locationId = 'test-location-id';

      // Mock the model find method
      const mockFind = jest.fn().mockReturnValue({
        populate: jest.fn().mockReturnValue({
          sort: jest.fn().mockResolvedValue([])
        })
      });

      // Temporarily replace the find method
      const originalFind = Schedule.find;
      Schedule.find = mockFind;

      await Schedule.findByLocationId(locationId, false);

      expect(mockFind).toHaveBeenCalledWith({ locationId });

      // Restore original method
      Schedule.find = originalFind;
    });
  });

  describe('Static method findByLocationAndDay', () => {
    it('should include isActive filter when activeOnly is true', async () => {
      const locationId = 'test-location-id';
      const dayOfWeek = 1;

      // Mock the model findOne method
      const mockFindOne = jest.fn().mockReturnValue({
        populate: jest.fn().mockResolvedValue(null)
      });

      // Temporarily replace the findOne method
      const originalFindOne = Schedule.findOne;
      Schedule.findOne = mockFindOne;

      await Schedule.findByLocationAndDay(locationId, dayOfWeek, true);

      expect(mockFindOne).toHaveBeenCalledWith({ locationId, dayOfWeek, isActive: true });

      // Restore original method
      Schedule.findOne = originalFindOne;
    });

    it('should not include isActive filter when activeOnly is false', async () => {
      const locationId = 'test-location-id';
      const dayOfWeek = 1;

      // Mock the model findOne method
      const mockFindOne = jest.fn().mockReturnValue({
        populate: jest.fn().mockResolvedValue(null)
      });

      // Temporarily replace the findOne method
      const originalFindOne = Schedule.findOne;
      Schedule.findOne = mockFindOne;

      await Schedule.findByLocationAndDay(locationId, dayOfWeek, false);

      expect(mockFindOne).toHaveBeenCalledWith({ locationId, dayOfWeek });

      // Restore original method
      Schedule.findOne = originalFindOne;
    });
  });

  describe('Instance method isOpenAt', () => {
    let schedule: { isActive: boolean; startTime: string; endTime: string };

    beforeEach(() => {
      schedule = {
        isActive: true,
        startTime: '09:00',
        endTime: '17:00'
      };
    });

    it('should return false when schedule is not active', () => {
      schedule.isActive = false;
      const result = Schedule.schema.methods.isOpenAt.call(schedule, '12:00');
      expect(result).toBe(false);
    });

    it('should return false when time format is invalid', () => {
      let result = Schedule.schema.methods.isOpenAt.call(schedule, '12'); // Missing minutes
      expect(result).toBe(false);

      result = Schedule.schema.methods.isOpenAt.call(schedule, '12:00:00'); // Too many parts
      expect(result).toBe(false);
    });

    it('should return false when hour or minute is not a string', () => {
      // This tests the typeof checks in the method
      const result = Schedule.schema.methods.isOpenAt.call(schedule, 'invalid:format');
      expect(result).toBe(false);
    });

    it('should return false when hour or minute cannot be parsed', () => {
      let result = Schedule.schema.methods.isOpenAt.call(schedule, 'aa:bb');
      expect(result).toBe(false);

      result = Schedule.schema.methods.isOpenAt.call(schedule, '12:bb');
      expect(result).toBe(false);
    });

    it('should return true when time is within operating hours', () => {
      const result = Schedule.schema.methods.isOpenAt.call(schedule, '12:00');
      expect(result).toBe(true);
    });

    it('should return false when time is outside operating hours', () => {
      let result = Schedule.schema.methods.isOpenAt.call(schedule, '08:00'); // Before opening
      expect(result).toBe(false);

      result = Schedule.schema.methods.isOpenAt.call(schedule, '17:00'); // At closing (not inclusive)
      expect(result).toBe(false);

      result = Schedule.schema.methods.isOpenAt.call(schedule, '18:00'); // After closing
      expect(result).toBe(false);
    });

    it('should return true when time is exactly at opening time', () => {
      const result = Schedule.schema.methods.isOpenAt.call(schedule, '09:00');
      expect(result).toBe(true);
    });
  });
}); 