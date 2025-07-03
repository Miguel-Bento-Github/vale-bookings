import request from 'supertest';

import { EmailWebhookService } from '../../../src/services/EmailWebhookService';
import createTestApp from '../testApp';

describe('Webhooks API', () => {
  let app: Express.Application;

  beforeEach(() => {
    app = createTestApp();
    jest.clearAllMocks();
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  describe('POST /api/webhooks/email', () => {
    const validWebhookEvent = {
      type: 'email.delivered',
      data: {
        email: 'test@example.com',
        messageId: 'test-message-id',
        timestamp: new Date().toISOString()
      }
    };

    it('should process valid webhook event successfully', async () => {
      const spy = jest.spyOn(EmailWebhookService, 'handleWebhookEvent').mockImplementation(() => ({
        success: true,
        action: 'remove_from_list',
        message: 'Email delivered successfully'
      }));

      const response = await request(app)
        .post('/api/webhooks/email')
        .send(validWebhookEvent)
        .expect(200);

      expect(response.body).toEqual({
        success: true,
        message: 'Email delivered successfully',
        action: 'remove_from_list'
      });

      expect(spy).toHaveBeenCalledWith(validWebhookEvent);
    });

    it('should handle webhook processing failure', async () => {
      jest.spyOn(EmailWebhookService, 'handleWebhookEvent').mockImplementation(() => ({
        success: false,
        message: 'Failed to process webhook'
      }));

      const response = await request(app)
        .post('/api/webhooks/email')
        .send(validWebhookEvent)
        .expect(500);

      expect(response.body).toEqual({
        success: false,
        error: 'Failed to process webhook'
      });
    });

    it('should return 400 for null body', async () => {
      const response = await request(app)
        .post('/api/webhooks/email')
        .send(undefined)
        .expect(400);

      expect(response.body).toEqual({
        success: false,
        error: 'Missing webhook event data'
      });
    });

    it('should return 400 for non-object body', async () => {
      const response = await request(app)
        .post('/api/webhooks/email')
        .send('invalid payload')
        .expect(400);

      expect(response.body).toEqual({
        success: false,
        error: 'Missing webhook event data'
      });
    });

    it('should return 400 for missing type field', async () => {
      const invalidEvent = {
        data: {
          email: 'test@example.com'
        }
      };

      const response = await request(app)
        .post('/api/webhooks/email')
        .send(invalidEvent)
        .expect(400);

      expect(response.body).toEqual({
        success: false,
        error: 'Missing webhook event data'
      });
    });

    it('should return 400 for missing data field', async () => {
      const invalidEvent = {
        type: 'email.delivered'
      };

      const response = await request(app)
        .post('/api/webhooks/email')
        .send(invalidEvent)
        .expect(400);

      expect(response.body).toEqual({
        success: false,
        error: 'Missing webhook event data'
      });
    });

    it('should handle service throwing error', async () => {
      jest.spyOn(EmailWebhookService, 'handleWebhookEvent').mockImplementation(() => {
        throw new Error('Service error');
      });

      const response = await request(app)
        .post('/api/webhooks/email')
        .send(validWebhookEvent)
        .expect(500);

      expect(response.body).toEqual({
        success: false,
        error: 'Internal server error'
      });
    });

    it('should handle non-Error exceptions', async () => {
      jest.spyOn(EmailWebhookService, 'handleWebhookEvent').mockImplementation(() => {
        throw new Error('String error');
      });

      const response = await request(app)
        .post('/api/webhooks/email')
        .send(validWebhookEvent)
        .expect(500);

      expect(response.body).toEqual({
        success: false,
        error: 'Internal server error'
      });
    });

    it('should handle empty object body', async () => {
      const response = await request(app)
        .post('/api/webhooks/email')
        .send({})
        .expect(400);

      expect(response.body).toEqual({
        success: false,
        error: 'Missing webhook event data'
      });
    });

    it('should handle webhook with null type', async () => {
      const invalidEvent = {
        type: null,
        data: { email: 'test@example.com' }
      };

      const response = await request(app)
        .post('/api/webhooks/email')
        .send(invalidEvent)
        .expect(400);

      expect(response.body).toEqual({
        success: false,
        error: 'Missing webhook event data'
      });
    });

    it('should handle webhook with null data', async () => {
      const invalidEvent = {
        type: 'email.delivered',
        data: null
      };

      const response = await request(app)
        .post('/api/webhooks/email')
        .send(invalidEvent)
        .expect(400);

      expect(response.body).toEqual({
        success: false,
        error: 'Missing webhook event data'
      });
    });
  });

  describe('GET /api/webhooks/email/health', () => {
    it('should return health check response', async () => {
      const spy = jest.spyOn(EmailWebhookService, 'getWebhookUrl').mockImplementation(() => 'http://localhost:3000/api/webhooks/email');

      const response = await request(app)
        .get('/api/webhooks/email/health')
        .expect(200);

      expect(response.body).toEqual({
        success: true,
        message: 'Email webhook endpoint is healthy',
        timestamp: expect.any(String),
        webhookUrl: 'http://localhost:3000/api/webhooks/email'
      });

      expect(spy).toHaveBeenCalled();
    });

    it('should return valid timestamp format', async () => {
      jest.spyOn(EmailWebhookService, 'getWebhookUrl').mockImplementation(() => 'http://localhost:3000/api/webhooks/email');

      const response = await request(app)
        .get('/api/webhooks/email/health')
        .expect(200);

      // Verify timestamp is a valid ISO string
      const timestamp = new Date(String(response.body.timestamp));
      expect(timestamp.toISOString()).toBe(response.body.timestamp);
    });

    it('should return webhook URL from service', async () => {
      const customUrl = 'https://api.vale.com/api/webhooks/email';
      jest.spyOn(EmailWebhookService, 'getWebhookUrl').mockImplementation(() => customUrl);

      const response = await request(app)
        .get('/api/webhooks/email/health')
        .expect(200);

      expect(response.body.webhookUrl).toBe(customUrl);
    });
  });
}); 