import Schedule from '../models/Schedule';
import { ISchedule, IScheduleDocument, IUpdateScheduleRequest } from '../types';
import { AppError } from '../types';

class ScheduleService {
  async createSchedule(scheduleData: ISchedule): Promise<IScheduleDocument> {
    const schedule = new Schedule(scheduleData);
    return await schedule.save();
  }

  async findById(scheduleId: string): Promise<IScheduleDocument | null> {
    return await Schedule.findById(scheduleId).populate('locationId', 'name address');
  }

  async getLocationSchedules(locationId: string, activeOnly: boolean = true): Promise<IScheduleDocument[]> {
    return await (Schedule as any).findByLocationId(locationId, activeOnly);
  }

  async getScheduleByLocationAndDay(locationId: string, dayOfWeek: number): Promise<IScheduleDocument | null> {
    return await (Schedule as any).findByLocationAndDay(locationId, dayOfWeek);
  }

  async getWeeklySchedule(locationId: string): Promise<IScheduleDocument[]> {
    return await (Schedule as any).getWeeklySchedule(locationId);
  }

  async updateSchedule(scheduleId: string, updateData: IUpdateScheduleRequest): Promise<IScheduleDocument | null> {
    return await Schedule.findByIdAndUpdate(
      scheduleId,
      { $set: updateData },
      { new: true, runValidators: true }
    );
  }

  async deleteSchedule(scheduleId: string): Promise<void> {
    await Schedule.findByIdAndDelete(scheduleId);
  }

  async deactivateSchedule(scheduleId: string): Promise<IScheduleDocument | null> {
    return await Schedule.findByIdAndUpdate(
      scheduleId,
      { isActive: false },
      { new: true }
    );
  }

  async isLocationOpen(locationId: string, dayOfWeek: number, timeString: string): Promise<boolean> {
    const schedule = await this.getScheduleByLocationAndDay(locationId, dayOfWeek);
    
    if (!schedule) {
      return false;
    }

    return schedule.isOpenAt(timeString);
  }

  async getOperatingHours(locationId: string, dayOfWeek: number): Promise<number | null> {
    const schedule = await this.getScheduleByLocationAndDay(locationId, dayOfWeek);
    
    if (!schedule) {
      return null;
    }

    return schedule.getOperatingHours();
  }

  async getAllSchedules(): Promise<IScheduleDocument[]> {
    return await Schedule.find({ isActive: true })
      .populate('locationId', 'name address')
      .sort({ locationId: 1, dayOfWeek: 1 });
  }

  async bulkCreateSchedules(schedulesData: ISchedule[]): Promise<IScheduleDocument[]> {
    const schedules = await Schedule.insertMany(schedulesData);
    return schedules;
  }

  async updateLocationSchedules(locationId: string, schedulesData: IUpdateScheduleRequest[]): Promise<IScheduleDocument[]> {
    const results: IScheduleDocument[] = [];
    
    for (const scheduleData of schedulesData) {
      if (scheduleData.dayOfWeek !== undefined) {
        const existingSchedule = await this.getScheduleByLocationAndDay(locationId, scheduleData.dayOfWeek);
        
        if (existingSchedule) {
          const updated = await this.updateSchedule(existingSchedule._id.toString(), scheduleData);
          if (updated) results.push(updated);
        } else {
          const newSchedule = await this.createSchedule({
            locationId,
            dayOfWeek: scheduleData.dayOfWeek,
            startTime: scheduleData.startTime || '09:00',
            endTime: scheduleData.endTime || '17:00',
            isActive: scheduleData.isActive !== undefined ? scheduleData.isActive : true
          });
          results.push(newSchedule);
        }
      }
    }
    
    return results;
  }

  getDayName(dayOfWeek: number): string {
    return (Schedule as any).getDayName(dayOfWeek);
  }
}

export default new ScheduleService(); 