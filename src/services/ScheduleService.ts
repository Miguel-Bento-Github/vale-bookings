import { ERROR_MESSAGES } from '../constants';
import Schedule from '../models/Schedule';
import {
  ISchedule,
  IScheduleDocument,
  IUpdateScheduleRequest,
  IScheduleModel,
  AppError
} from '../types';
import {
  createWithDuplicateHandling,
  standardUpdate,
  safeDelete,
  deactivateDocument
} from '../utils/mongoHelpers';

export async function createSchedule(scheduleData: ISchedule): Promise<IScheduleDocument> {
  return await createWithDuplicateHandling(
    Schedule,
    scheduleData,
    ERROR_MESSAGES.SCHEDULE_ALREADY_EXISTS
  );
}

export async function getScheduleById(scheduleId: string): Promise<IScheduleDocument | null> {
  return await Schedule.findById(scheduleId).populate('locationId', 'name address');
}

export async function getLocationSchedules(locationId: string): Promise<IScheduleDocument[]> {
  return await Schedule.find({ locationId, isActive: true }).sort({ dayOfWeek: 1 });
}

export async function updateSchedule(
  scheduleId: string,
  updateData: Partial<ISchedule>
): Promise<IScheduleDocument | null> {
  return await standardUpdate(Schedule, scheduleId, updateData as Partial<IScheduleDocument>);
}

export async function deleteSchedule(scheduleId: string): Promise<void> {
  await safeDelete(Schedule, scheduleId, 'Schedule not found');
}

export async function getAllSchedules(): Promise<IScheduleDocument[]> {
  return await Schedule.find({})
    .populate('locationId', 'name address')
    .sort({ locationId: 1, dayOfWeek: 1 });
}

export async function createBulkSchedules(
  schedulesData: ISchedule[]
): Promise<{ created: IScheduleDocument[]; errors: string[] }> {
  const created: IScheduleDocument[] = [];
  const errors: string[] = [];

  for (const scheduleData of schedulesData) {
    try {
      const schedule = await createSchedule(scheduleData);
      created.push(schedule);
    } catch (error) {
      if (error instanceof AppError) {
        errors.push(`${scheduleData.locationId} - ${scheduleData.dayOfWeek}: ${error.message}`);
      } else {
        errors.push(`${scheduleData.locationId} - ${scheduleData.dayOfWeek}: Unknown error`);
      }
    }
  }

  return { created, errors };
}

export async function getScheduleByLocationAndDay(
  locationId: string,
  dayOfWeek: number
): Promise<IScheduleDocument | null> {
  return await (Schedule as unknown as IScheduleModel).findByLocationAndDay(
    locationId,
    dayOfWeek
  );
}

export async function getWeeklySchedule(locationId: string): Promise<IScheduleDocument[]> {
  return await (Schedule as unknown as IScheduleModel).getWeeklySchedule(locationId);
}

export async function deactivateSchedule(scheduleId: string): Promise<IScheduleDocument | null> {
  return await deactivateDocument(Schedule, scheduleId);
}

export async function isLocationOpen(
  locationId: string,
  dayOfWeek: number,
  timeString: string
): Promise<boolean> {
  const schedule = await getScheduleByLocationAndDay(locationId, dayOfWeek);

  if (!schedule) {
    return false;
  }

  return schedule.isOpenAt(timeString);
}

export async function getOperatingHours(
  locationId: string,
  dayOfWeek: number
): Promise<number | null> {
  const schedule = await getScheduleByLocationAndDay(locationId, dayOfWeek);

  if (!schedule) {
    return null;
  }

  return schedule.getOperatingHours();
}

export async function updateLocationSchedules(
  locationId: string,
  schedulesData: IUpdateScheduleRequest[]
): Promise<IScheduleDocument[]> {
  const results: IScheduleDocument[] = [];

  for (const scheduleData of schedulesData) {
    if (typeof scheduleData.dayOfWeek === 'number') {
      const existingSchedule = await getScheduleByLocationAndDay(
        locationId,
        scheduleData.dayOfWeek
      );

      if (existingSchedule) {
        const updated = await updateSchedule(String(existingSchedule._id), scheduleData);
        if (updated) results.push(updated);
      } else {
        const newSchedule = await createSchedule({
          locationId,
          dayOfWeek: scheduleData.dayOfWeek,
          startTime: scheduleData.startTime ?? '09:00',
          endTime: scheduleData.endTime ?? '17:00',
          isActive: scheduleData.isActive ?? true
        });
        results.push(newSchedule);
      }
    }
  }

  return results;
}

export function getDayName(dayOfWeek: number): string {
  return (Schedule as unknown as IScheduleModel).getDayName(dayOfWeek);
} 