import { describe, it, expect } from '@jest/globals';

import {
  sendBookingReminder,
  scheduleReminder,
  cancelReminder
} from '../../../src/services/NotificationService';
import type { BookingNotificationData } from '../../../src/types/notification';

const baseBooking: BookingNotificationData = {
  referenceNumber: 'ABC123',
  locationName: 'Garage',
  locationAddress: '1 Test St',
  bookingDate: '2100-01-02',
  bookingTime: '10:00',
  duration: 60,
  serviceName: 'Valet',
  guestName: 'Bob',
  guestEmail: 'bob@example.com',
  guestPhone: '+15555555555',
  id: 'booking1'
};

describe('NotificationService – extended tests', () => {
  it('sendBookingReminder fails for past booking', async () => {
    const bookingPast: BookingNotificationData = { ...baseBooking, hoursUntil: -2 };
    const res = await sendBookingReminder(bookingPast, ['email'], 'en');
    expect(res.success).toBe(false);
    expect(res.error).toContain('past booking');
  });

  it('sendBookingReminder succeeds for future booking via email', async () => {
    const bookingFuture: BookingNotificationData = { ...baseBooking, hoursUntil: 5 };
    const res = await sendBookingReminder(bookingFuture, ['email'], 'en');
    expect(res.success).toBe(true);
    expect(res.channels.email.status).toBe('sent');
  });

  it('scheduleReminder schedules job in future', async () => {
    const futureDate = new Date();
    futureDate.setDate(futureDate.getDate() + 2);
    const booking: BookingNotificationData = {
      ...baseBooking,
      bookingDate: futureDate.toISOString().substring(0, 10),
      bookingTime: '12:00'
    };
    const result = await scheduleReminder(booking, 24, 'en');
    expect(result.success).toBe(true);
    expect(result.jobId).toMatch(/^job_/);
    if (result.scheduledFor) {
      expect(result.scheduledFor.getTime()).toBeLessThan(new Date(`${booking.bookingDate}T${booking.bookingTime}`).getTime());
    }
  });

  it('scheduleReminder fails when reminder time is past', async () => {
    const now = new Date();
    const booking: BookingNotificationData = {
      ...baseBooking,
      bookingDate: now.toISOString().substring(0, 10),
      bookingTime: '00:00'
    };
    const result = await scheduleReminder(booking, 1, 'en');
    expect(result.success).toBe(false);
    expect(result.error).toContain('past');
  });

  it('cancelReminder returns success true', async () => {
    const res = await cancelReminder('job_test');
    expect(res.success).toBe(true);
  });
}); 