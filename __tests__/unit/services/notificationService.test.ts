import { describe, expect, it } from '@jest/globals';

import {
  sendBookingConfirmation,
  scheduleReminder,
  sendBookingReminder,
  cancelReminder,
  sendCancellationConfirmation,
  trackDelivery,
  getDeliveryStats
} from '../../../src/services/NotificationService';
import type { BookingNotificationData, DeliveryStatsFilter } from '../../../src/types/notification';

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

  const extendedBooking: BookingNotificationData = {
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

  const confirmationBooking: BookingNotificationData = {
    id: 'bk1',
    referenceNumber: 'XYZ789',
    locationName: 'Main Garage',
    locationAddress: '2 Test Ave',
    bookingDate: '2100-05-01',
    bookingTime: '14:30',
    duration: 90,
    serviceName: 'Valet',
    guestName: 'Alice',
    guestEmail: 'alice@example.com',
    guestPhone: '+15556667777'
  };

  describe('Basic functionality', () => {
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

  describe('Extended functionality', () => {
    it('sendBookingReminder fails for past booking', async () => {
      const bookingPast: BookingNotificationData = { ...extendedBooking, hoursUntil: -2 };
      const res = await sendBookingReminder(bookingPast, ['email'], 'en');
      expect(res.success).toBe(false);
      expect(res.error).toContain('past booking');
    });

    it('sendBookingReminder succeeds for future booking via email', async () => {
      const bookingFuture: BookingNotificationData = { ...extendedBooking, hoursUntil: 5 };
      const res = await sendBookingReminder(bookingFuture, ['email'], 'en');
      expect(res.success).toBe(true);
      expect(res.channels.email.status).toBe('sent');
    });

    it('scheduleReminder schedules job in future', async () => {
      const futureDate = new Date();
      futureDate.setDate(futureDate.getDate() + 2);
      const booking: BookingNotificationData = {
        ...extendedBooking,
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
        ...extendedBooking,
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

  describe('Confirmation & analytics', () => {
    it('sendBookingConfirmation succeeds for email+sms', async () => {
      const res = await sendBookingConfirmation(confirmationBooking, ['email', 'sms'], 'en');
      expect(res.success).toBe(true);
      expect(res.channels.email.status).toBe('sent');
      expect(res.channels.sms.status).toBe('sent');
      expect(res.deliveryId).toMatch(/^delivery_/);
    });

    it('sendBookingConfirmation fails when recipient missing', async () => {
      const bookingNoEmail: BookingNotificationData = { ...confirmationBooking, guestEmail: undefined };
      const res = await sendBookingConfirmation(bookingNoEmail, ['email'], 'en');
      expect(res.success).toBe(false);
      expect(res.error).toContain('Email address required');
    });

    it('sendCancellationConfirmation succeeds via email', async () => {
      const res = await sendCancellationConfirmation(confirmationBooking, ['email'], 'en');
      expect(res.success).toBe(true);
      expect(res.channels.email.status).toBe('sent');
    });

    it('trackDelivery returns delivered status', async () => {
      const tracking = await trackDelivery('delivery_test');
      expect(tracking.deliveryId).toBe('delivery_test');
      if (tracking.channels.email) {
        expect(tracking.channels.email.status).toBe('delivered');
      }
    });

    it('getDeliveryStats returns numeric metrics', async () => {
      const filter: DeliveryStatsFilter = { startDate: '2100-01-01', endDate: '2100-12-31' };
      const stats = await getDeliveryStats(filter);
      expect(stats.totalSent).toBeGreaterThan(0);
      expect(stats.period.startDate).toEqual(filter.startDate);
      expect(stats.period.endDate).toEqual(filter.endDate);
    });
  });
}); 