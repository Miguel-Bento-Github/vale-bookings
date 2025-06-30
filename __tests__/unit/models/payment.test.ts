import { describe, it, expect, beforeAll } from '@jest/globals';
import mongoose from 'mongoose';

import Payment from '../../../src/models/Payment';

// Use the same in-memory MongoDB setup provided by the repo-wide Jest config.

let bookingId: mongoose.Types.ObjectId;
let userId: mongoose.Types.ObjectId;

beforeAll(() => {
  // Use fresh ObjectIds; Payment does not validate existence of referenced docs.
  bookingId = new mongoose.Types.ObjectId();
  userId = new mongoose.Types.ObjectId();
});

describe('Payment Model', () => {
  it('saves with required fields and defaults to PENDING status', async () => {
    const payment = await Payment.create({
      bookingId,
      userId,
      stripePaymentIntentId: 'pi_123',
      amount: 5000,
      currency: 'USD',
      paymentMethod: 'CARD'
    });

    expect(payment.status).toBe('PENDING');
    expect(payment.amount).toBe(5000);
    expect(payment.currency).toBe('USD');
  });

  it('rejects negative amount', async () => {
    await expect(Payment.create({
      bookingId,
      userId,
      stripePaymentIntentId: 'pi_456',
      amount: -10,
      currency: 'USD',
      paymentMethod: 'CARD'
    })).rejects.toThrow();
  });

  it('enforces currency code length of 3', async () => {
    await expect(Payment.create({
      bookingId,
      userId,
      stripePaymentIntentId: 'pi_789',
      amount: 100,
      currency: 'US', // invalid length
      paymentMethod: 'CARD'
    })).rejects.toThrow();
  });
}); 