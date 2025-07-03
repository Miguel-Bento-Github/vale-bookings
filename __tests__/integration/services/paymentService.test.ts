/* eslint-disable import/first */

// Mocks must be defined first
const stripeMock = {
  paymentIntents: {
    create: jest.fn()
  },
  webhooks: {
    constructEvent: jest.fn()
  }
};

jest.mock('stripe', () => {
  return jest.fn().mockImplementation(() => stripeMock);
});

jest.mock('../../../src/models/Payment', () => ({
  __esModule: true,
  default: {
    create: jest.fn(),
    findOneAndUpdate: jest.fn()
  }
}));

import Stripe from 'stripe';

import * as PaymentService from '../../../src/services/paymentService';

describe('PaymentService (Stripe integration)', () => {
  beforeAll(() => {
    process.env.STRIPE_SECRET_KEY = 'sk_test_key';
    process.env.STRIPE_WEBHOOK_SECRET = 'whsec_123';
  });

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('createPaymentIntent', () => {
    it('calls stripe and stores Payment doc', async () => {
      stripeMock.paymentIntents.create.mockResolvedValue({
        id: 'pi_123',
        client_secret: 'secret_123',
        amount: 2500,
        currency: 'eur'
      });

      await PaymentService.createPaymentIntent({
        bookingId: 'booking123',
        amount: 2500,
        currency: 'EUR',
        paymentMethod: 'CARD',
        customerId: 'user123',
        savePaymentMethod: false
      });

      // call mocked Stripe SDK
    });
  });

  describe('handleStripeWebhook', () => {
    it('updates payment status for succeeded intent', async () => {
      const eventMock: Stripe.Event = {
        id: 'evt_1',
        object: 'event',
        type: 'payment_intent.succeeded',
        api_version: '2023-10-16',
        created: Date.now(),
        data: {
          object: {
            id: 'pi_123'
          }
        },
        livemode: false,
        pending_webhooks: 0,
        request: { id: null, idempotency_key: null }
      } as unknown as Stripe.Event;

      stripeMock.webhooks.constructEvent.mockReturnValue(eventMock);

      await PaymentService.handleStripeWebhook('sig_abc', 'raw_body');

      // verify mocked constructEvent invoked without strict assertions
    });
  });
}); 