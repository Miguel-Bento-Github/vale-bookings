import { describe, expect, it } from '@jest/globals';

import {
  sendBookingConfirmation,
  scheduleReminder
} from '../../../src/services/NotificationService';

import type { BookingNotificationData } from '../../../src/types/notification';

describe('NotificationService', () => {
  const baseBooking = {
    id: 'booking-1',
    referenceNumber: 'ABC12345',
    locationName: 'Central Salon',
    bookingDate: '2099-01-01',
    bookingTime: '10:00',
    guestEmail: 'guest@example.com',
    guestPhone: '+15555551234'
  } as const;

  it('sends booking confirmation successfully via email & sms', async () => {
    const bookingData = { ...baseBooking } as BookingNotificationData;
    const result = await sendBookingConfirmation(
      bookingData,
      ['email', 'sms']
    );

    expect(result.success).toBe(true);
    expect(result.deliveryId).toMatch(/^delivery_/);
    expect(result.channels.email.status).toBe('sent');
    expect(result.channels.sms.status).toBe('sent');
  });

  it('returns error for missing booking fields', async () => {
    const badBooking = { ...baseBooking, bookingDate: '' } as BookingNotificationData;
    const result = await sendBookingConfirmation(badBooking, ['email']);
    expect(result.success).toBe(false);
    expect(result.error).toMatch(/booking date is required/i);
  });

  it('schedules reminder for future time and fails for past', async () => {
    // Future reminder (24h before)
    const future = await scheduleReminder({
      ...baseBooking,
      hoursUntil: 48,
      channels: ['email']
    } as unknown as BookingNotificationData, 24);

    expect(future.success).toBe(true);
    expect(future.jobId).toMatch(/^job_/);

    // Past reminder should fail
    const pastBooking = { ...baseBooking, bookingDate: '2000-01-01' } as BookingNotificationData;
    const past = await scheduleReminder(pastBooking, 24);
    expect(past.success).toBe(false);
    expect(past.error).toMatch(/past/);
  });
}); 