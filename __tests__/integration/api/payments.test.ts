import { Application } from 'express';
import request from 'supertest';

import {
  setupTestContext,
  expectSuccess,
  expectError
} from '../../utils/testHelpers';
import createTestApp from '../testApp';

/**
 * Payments Integration Tests
 * Endpoints:
 *   POST /api/payments/calculate
 *   POST /api/payments/intent
 */

describe('Payments Integration Tests', () => {
  let app: Application;
  let userToken: string;
  // Note: userId not used directly in tests, so omitted to satisfy lint
  let locationId: string;
  let bookingId: string;

  beforeAll(() => {
    app = createTestApp();
  });

  beforeEach(async () => {
    const context = await setupTestContext(app);
    userToken = context.userToken;
    locationId = context.locationId;
    bookingId = context.bookingId;
  });

  describe('POST /api/payments/calculate', () => {
    it('should calculate price successfully', async () => {
      const priceData = {
        locationId,
        startTime: '2025-01-01T10:00:00Z',
        endTime: '2025-01-01T12:00:00Z'
      };

      const response = await request(app)
        .post('/api/payments/calculate')
        .send(priceData)
        .expect(200);

      expectSuccess(response);
      expect(response.body.data).toHaveProperty('totalAmount');
      expect(response.body.data.totalAmount).toBeGreaterThan(0);
    });

    it('should return 400 for missing required fields', async () => {
      const response = await request(app)
        .post('/api/payments/calculate')
        .send({ locationId })
        .expect(400);

      expectError(response, 400);
    });
  });

  describe('POST /api/payments/intent', () => {
    it('should create payment intent successfully', async () => {
      const intentData = {
        bookingId,
        amount: 5000,
        currency: 'EUR',
        paymentMethod: 'CARD'
      };

      const response = await request(app)
        .post('/api/payments/intent')
        .set('Authorization', `Bearer ${userToken}`)
        .send(intentData)
        .expect(200);

      expectSuccess(response);
      expect(response.body.data).toMatchObject({
        amount: intentData.amount,
        currency: intentData.currency.toLowerCase()
      });
    });

    it('should return 400 for missing amount', async () => {
      const response = await request(app)
        .post('/api/payments/intent')
        .set('Authorization', `Bearer ${userToken}`)
        .send({ bookingId, currency: 'EUR' })
        .expect(400);

      expectError(response, 400);
    });
  });
}); 