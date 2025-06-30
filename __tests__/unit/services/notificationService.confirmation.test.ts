import { describe, it, expect } from '@jest/globals';

import {
  sendBookingConfirmation,
  sendCancellationConfirmation,
  trackDelivery,
  getDeliveryStats
} from '../../../src/services/NotificationService';
import type { BookingNotificationData, DeliveryStatsFilter } from '../../../src/types/notification';

const bookingBase: BookingNotificationData = {
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

describe('NotificationService – confirmation & analytics', () => {
  it('sendBookingConfirmation succeeds for email+sms', async () => {
    const res = await sendBookingConfirmation(bookingBase, ['email', 'sms'], 'en');
    expect(res.success).toBe(true);
    expect(res.channels.email.status).toBe('sent');
    expect(res.channels.sms.status).toBe('sent');
    expect(res.deliveryId).toMatch(/^delivery_/);
  });

  it('sendBookingConfirmation fails when recipient missing', async () => {
    const bookingNoEmail: BookingNotificationData = { ...bookingBase, guestEmail: undefined };
    const res = await sendBookingConfirmation(bookingNoEmail, ['email'], 'en');
    expect(res.success).toBe(false);
    expect(res.error).toContain('Email address required');
  });

  it('sendCancellationConfirmation succeeds via email', async () => {
    const res = await sendCancellationConfirmation(bookingBase, ['email'], 'en');
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