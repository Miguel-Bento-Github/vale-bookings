import request from 'supertest';

import app from '../../src/app';

describe('App Unit Tests', () => {
  describe('Health check endpoint', () => {
    it('should return health status', async () => {
      const response = await request(app)
        .get('/health')
        .expect(200);

      expect(response.body).toEqual({
        status: 'OK',
        timestamp: expect.any(String),
        service: 'valet-backend'
      });
    });
  });

  describe('Error handling middleware', () => {
    it('should handle AppError correctly', async () => {
      const response = await request(app)
        .get('/api/test-error')
        .expect(400);

      expect(response.body).toEqual({
        success: false,
        message: 'Test error'
      });
    });

    it('should handle unknown errors correctly', async () => {
      const response = await request(app)
        .get('/api/test-unknown-error')
        .expect(500);

      expect(response.body).toEqual({
        success: false,
        message: 'Internal server error'
      });
    });
  });

  describe('Content type validation middleware', () => {
    it('should reject text/plain content type for POST requests', async () => {
      const response = await request(app)
        .post('/api/auth/register')
        .set('Content-Type', 'text/plain')
        .send('invalid data')
        .expect(400);

      expect(response.body).toEqual({
        success: false,
        error: 'Invalid content type',
        errorCode: 'BAD_REQUEST'
      });
    });

    it('should allow JSON content type for POST requests', async () => {
      // This will fail validation but should pass content-type check
      const response = await request(app)
        .post('/api/auth/register')
        .set('Content-Type', 'application/json')
        .send({})
        .expect(400);

      // Should not be the content-type error
      expect(response.body.message).not.toBe('Invalid JSON payload');
    });

    it('should not check content type for GET requests', async () => {
      const response = await request(app)
        .get('/health')
        .set('Content-Type', 'text/plain')
        .expect(200);

      expect(response.body.status).toBe('OK');
    });
  });

  describe('JSON parsing with error handling', () => {
    it('should handle invalid JSON gracefully', async () => {
      const response = await request(app)
        .post('/api/auth/register')
        .set('Content-Type', 'application/json')
        .send('invalid json')
        .expect(400);

      expect(response.body).toEqual({
        success: false,
        error: 'Invalid JSON payload',
        errorCode: 'BAD_REQUEST'
      });
    });
  });
}); 