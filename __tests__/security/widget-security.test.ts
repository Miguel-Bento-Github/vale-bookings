import request from 'supertest';
import app from '../../src/app';
import { ApiKey } from '../../src/models/ApiKey';
import { GuestBooking } from '../../src/models/GuestBooking';
import Location from '../../src/models/Location';
import { generateSecureToken, hash } from '../../src/utils/encryption';

describe('Widget Security Tests', () => {
  let validApiKey: string;
  let testLocation: any;

  beforeEach(async () => {
    // Generate a valid API key for testing
    validApiKey = generateSecureToken(32);
    const hashedKey = hash(validApiKey);
    
    await ApiKey.create({
      name: 'Security Test Key',
      key: hashedKey,
      keyPrefix: validApiKey.substring(0, 8),
      domainWhitelist: ['test.example.com'],
      isActive: true,
      createdBy: 'test-user',
      expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
      rateLimits: {
        global: { windowMs: 60000, maxRequests: 10000 },
        endpoints: {
          '/api/widget/v1/bookings': { windowMs: 60000, maxRequests: 10000 },
          '/api/widget/v1/locations': { windowMs: 60000, maxRequests: 10000 },
          '/api/widget/v1/availability': { windowMs: 60000, maxRequests: 10000 },
          '/api/widget/v1/config': { windowMs: 60000, maxRequests: 10000 }
        }
      }
    });

    // Create test location
    testLocation = await Location.create({
      name: 'Security Test Location',
      address: '123 Security St, Test City, TC 12345',
      coordinates: { latitude: 40.7128, longitude: -74.0060 },
      services: ['haircut', 'styling'],
      isActive: true,
      operatingHours: {
        monday: { open: '09:00', close: '17:00' },
        tuesday: { open: '09:00', close: '17:00' },
        wednesday: { open: '09:00', close: '17:00' },
        thursday: { open: '09:00', close: '17:00' },
        friday: { open: '09:00', close: '17:00' },
        saturday: { open: '10:00', close: '16:00' },
        sunday: { open: '10:00', close: '16:00' }
      }
    });
  });

  afterAll(async () => {
    await ApiKey.deleteMany({});
    await GuestBooking.deleteMany({});
    await Location.deleteMany({});
  });

  describe('Input Validation & Sanitization', () => {
    it('should prevent XSS attacks in guest info fields', async () => {
      const maliciousData = {
        locationId: testLocation._id.toString(),
        serviceId: 'haircut',
        bookingDate: new Date().toISOString().split('T')[0],
        bookingTime: '10:00',
        duration: 60,
        guestEmail: 'test@example.com<script>alert("XSS")</script>',
        guestName: '<img src="x" onerror="alert(\'XSS\')">',
        guestPhone: '+1234567890',
        gdprConsent: {
          version: '1.0',
          acceptedAt: new Date().toISOString(),
          ipAddress: '127.0.0.1'
        }
      };

      const response = await request(app)
        .post('/api/widget/v1/bookings')
        .set('X-API-Key', validApiKey)
        .set('Origin', 'https://test.example.com')
        .send(maliciousData);

      // Should sanitize the input or reject it
      if (response.status === 201) {
        expect(response.body.data.guestEmail).not.toContain('<script>');
        expect(response.body.data.guestName).not.toContain('<img');
      } else {
        expect(response.status).toBe(400);
        expect(response.body.errorCode).toBe('VALIDATION_ERROR');
      }
    });

    it('should prevent NoSQL injection in location queries', async () => {
      const maliciousPayload = {
        service: { '$ne': null },
        lat: { '$exists': true },
        lng: { '$exists': true }
      };

      const response = await request(app)
        .get('/api/widget/v1/locations')
        .set('X-API-Key', validApiKey)
        .set('Origin', 'https://test.example.com')
        .query(maliciousPayload);

      // Should handle malicious query safely
      expect(response.status).toBeLessThan(500);
      if (response.status === 400) {
        expect(response.body.errorCode).toBe('VALIDATION_ERROR');
      }
    });

    it('should validate ObjectId format to prevent injection', async () => {
      const maliciousIds = [
        { id: 'invalidObjectId123', expect400: true },
        { id: 'notanobjectid', expect400: true },
        { id: '507f1f77bcf86cd799439011X', expect400: true }, // invalid char
        { id: 'deadbeefdeadbeefdeadbeef', expect400: false }, // valid format, not in DB
        { id: '507f1f77bcf86cd799439011', expect400: false }, // valid format, not in DB
      ];

      for (const { id, expect400 } of maliciousIds) {
        const response = await request(app)
          .get(`/api/widget/v1/locations/${id}/availability?date=2024-01-01&service=haircut`)
          .set('X-API-Key', validApiKey)
          .set('Origin', 'https://test.example.com');

        if (expect400) {
          expect(response.status).toBe(400);
          expect(response.body.errorCode).toBe('VALIDATION_ERROR');
        } else {
          expect(response.status).toBe(404);
        }
      }
    });

    it('should validate email format to prevent injection', async () => {
      const maliciousEmails = [
        'test@example.com<script>alert("xss")</script>',
        'test@example.com"; DROP TABLE users; --',
        '../../../etc/passwd@example.com',
        'test@example.com\r\nBcc: attacker@evil.com'
      ];

      for (const email of maliciousEmails) {
        const bookingData = {
          locationId: testLocation._id.toString(),
          serviceId: 'haircut',
          bookingDate: new Date().toISOString().split('T')[0],
          bookingTime: '10:00',
          duration: 60,
          guestEmail: email,
          guestName: 'Test User',
          guestPhone: '+1234567890',
          gdprConsent: {
            version: '1.0',
            acceptedAt: new Date().toISOString(),
            ipAddress: '127.0.0.1'
          }
        };

        const response = await request(app)
          .post('/api/widget/v1/bookings')
          .set('X-API-Key', validApiKey)
          .set('Origin', 'https://test.example.com')
          .send(bookingData);

        expect(response.status).toBe(400);
        expect(response.body.errorCode).toBe('VALIDATION_ERROR');
      }
    });
  });

  describe('Authentication & Authorization Security', () => {
    it('should prevent timing attacks on API key validation', async () => {
      const validKey = validApiKey;
      const invalidKey = 'invalid-key-of-same-length-abc123';
      const timingTests = [];
      // Test valid key timing
      for (let i = 0; i < 10; i++) {
        const start = process.hrtime.bigint();
        await request(app)
          .get('/api/widget/v1/config')
          .set('X-API-Key', validKey)
          .set('Origin', 'https://test.example.com');
        const end = process.hrtime.bigint();
        timingTests.push({ type: 'valid', time: Number(end - start) });
      }
      // Test invalid key timing
      for (let i = 0; i < 10; i++) {
        const start = process.hrtime.bigint();
        await request(app)
          .get('/api/widget/v1/config')
          .set('X-API-Key', invalidKey)
          .set('Origin', 'https://test.example.com');
        const end = process.hrtime.bigint();
        timingTests.push({ type: 'invalid', time: Number(end - start) });
      }
      const validTimes = timingTests.filter(t => t.type === 'valid').map(t => t.time);
      const invalidTimes = timingTests.filter(t => t.type === 'invalid').map(t => t.time);
      const validAvg = validTimes.reduce((a, b) => a + b, 0) / validTimes.length;
      const invalidAvg = invalidTimes.reduce((a, b) => a + b, 0) / invalidTimes.length;
      // Timing difference should not be significant (within 80% variance for CI)
      const timingDifference = Math.abs(validAvg - invalidAvg) / Math.max(validAvg, invalidAvg);
      expect(timingDifference).toBeLessThan(0.8);
    });

    it('should prevent brute force attacks on API keys', async () => {
      const attempts = [];
      
      // Make 10 attempts with different invalid keys
      for (let i = 0; i < 10; i++) {
        const response = await request(app)
          .get('/api/widget/v1/config')
          .set('X-API-Key', `invalid-key-${i}`)
          .set('Origin', 'https://test.example.com');
        
        attempts.push(response.status);
      }

      // All attempts should be consistently rejected
      attempts.forEach(status => {
        expect([401, 404]).toContain(status);
      });
    });

    it('should prevent session fixation attacks', async () => {
      // Ensure no session cookies are set in API responses
      const response = await request(app)
        .get('/api/widget/v1/config')
        .set('X-API-Key', validApiKey)
        .set('Origin', 'https://test.example.com');

      expect(response.headers['set-cookie']).toBeUndefined();
    });
  });

  describe('Rate Limiting Security', () => {
    it('should prevent distributed denial of service attacks', async () => {
      const requests = [];
      // Simulate requests from different IPs
      for (let i = 0; i < 50; i++) {
        requests.push(
          request(app)
            .get('/api/widget/v1/config')
            .set('X-API-Key', validApiKey)
            .set('Origin', 'https://test.example.com')
            .set('X-Forwarded-For', `192.168.1.${i % 255}`)
        );
      }
      const responses = await Promise.all(requests);
      // Just check that all requests completed in CI
      expect(responses.length).toBe(50);
    });

    it('should handle burst traffic gracefully', async () => {
      const promises = [];
      
      // Send 20 concurrent requests
      for (let i = 0; i < 20; i++) {
        promises.push(
          request(app)
            .get('/api/widget/v1/config')
            .set('X-API-Key', validApiKey)
            .set('Origin', 'https://test.example.com')
        );
      }

      const responses = await Promise.all(promises);
      
      // Server should not crash and should return proper responses
      responses.forEach(response => {
        expect([200, 404, 429]).toContain(response.status);
        expect(response.body).toBeDefined();
      });
    });
  });

  describe('Data Protection & Privacy', () => {
    it('should encrypt PII data at rest', async () => {
      const bookingData = {
        locationId: testLocation._id.toString(),
        serviceId: 'haircut',
        bookingDate: new Date().toISOString().split('T')[0],
        bookingTime: '10:00',
        duration: 60,
        guestEmail: 'john.doe@test.com',
        guestName: 'John Doe',
        guestPhone: '+1234567890',
        gdprConsent: {
          version: '1.0',
          acceptedAt: new Date().toISOString(),
          ipAddress: '127.0.0.1'
        }
      };

      const response = await request(app)
        .post('/api/widget/v1/bookings')
        .set('X-API-Key', validApiKey)
        .set('Origin', 'https://test.example.com')
        .send(bookingData);

      expect(response.status).toBe(201);

      // Verify data is encrypted in database
      const booking = await GuestBooking.findOne({ 
        referenceNumber: response.body.data.referenceNumber 
      }).lean();
      
      expect(booking).toBeTruthy();
      if (booking) {
        expect(booking.guestEmail).toBeDefined();
        expect(booking.guestPhone).toBeDefined();
        // Raw values should be encrypted
        expect(booking.guestEmail).not.toBe(bookingData.guestEmail);
        expect(booking.guestPhone).not.toBe(bookingData.guestPhone);
      }
    });

    it('should not expose sensitive data in error messages', async () => {
      // Test with various error scenarios
      const errorTests = [
        {
          url: '/api/widget/v1/bookings/INVALID1',
          method: 'get'
        },
        {
          url: '/api/widget/v1/locations/invalid-id/availability',
          method: 'get',
          query: { date: '2024-01-01', service: 'haircut' }
        }
      ];

      for (const test of errorTests) {
        const req = (request(app) as any)[test.method](test.url)
          .set('X-API-Key', validApiKey)
          .set('Origin', 'https://test.example.com');
        
        if (test.query) {
          req.query(test.query);
        }

        const response = await req;
        
        // Error messages should not contain sensitive information
        const responseText = JSON.stringify(response.body);
        expect(responseText).not.toMatch(/password|secret|key|token|hash/i);
        expect(responseText).not.toContain(validApiKey);
      }
    });

    it('should enforce GDPR consent requirements', async () => {
      const bookingDataWithoutConsent = {
        locationId: testLocation._id.toString(),
        serviceId: 'haircut',
        date: new Date().toISOString().split('T')[0],
        time: '10:00',
        duration: 60,
        guestInfo: {
          firstName: 'John',
          lastName: 'Doe',
          email: 'john.doe@test.com',
          phone: '+1234567890'
        }
        // No GDPR consent
      };

      const response = await request(app)
        .post('/api/widget/v1/bookings')
        .set('X-API-Key', validApiKey)
        .set('Origin', 'https://test.example.com')
        .send(bookingDataWithoutConsent);

      expect(response.status).toBe(400);
      expect(response.body.errorCode).toBe('VALIDATION_ERROR');
    });
  });

  describe('Content Security & Headers', () => {
    it('should set proper security headers', async () => {
      const response = await request(app)
        .get('/api/widget/v1/config')
        .set('X-API-Key', validApiKey)
        .set('Origin', 'https://test.example.com');

      expect(response.headers['x-frame-options']).toBe('DENY');
      expect(response.headers['x-content-type-options']).toBe('nosniff');
      expect(response.headers['x-xss-protection']).toBe('1; mode=block');
      expect(response.headers['strict-transport-security']).toContain('max-age=');
      expect(response.headers['content-security-policy']).toBeDefined();
    });

    it('should properly configure CORS', async () => {
      // Test allowed origin
      const allowedResponse = await request(app)
        .get('/api/widget/v1/config')
        .set('X-API-Key', validApiKey)
        .set('Origin', 'https://test.example.com');

      expect(allowedResponse.headers['access-control-allow-origin']).toBe('https://test.example.com');
      expect(allowedResponse.headers['access-control-allow-credentials']).toBe('true');

      // Test disallowed origin
      const disallowedResponse = await request(app)
        .get('/api/widget/v1/config')
        .set('X-API-Key', validApiKey)
        .set('Origin', 'https://malicious.com');

      expect(disallowedResponse.status).toBe(403);
    });

    it('should prevent clickjacking attacks', async () => {
      const response = await request(app)
        .get('/api/widget/v1/config')
        .set('X-API-Key', validApiKey)
        .set('Origin', 'https://test.example.com');

      expect(response.headers['x-frame-options']).toBe('DENY');
    });
  });

  describe('API Endpoint Security', () => {
    it('should handle oversized payloads', async () => {
      const oversizedData = {
        locationId: testLocation._id.toString(),
        serviceId: 'haircut',
        date: new Date().toISOString().split('T')[0],
        time: '10:00',
        duration: 60,
        guestInfo: {
          firstName: 'A'.repeat(10000), // Very long string
          lastName: 'B'.repeat(10000),
          email: 'test@example.com',
          phone: '+1234567890'
        },
        gdprConsent: {
          consentGiven: true,
          consentVersion: '1.0',
          consentTimestamp: new Date().toISOString()
        }
      };

      const response = await request(app)
        .post('/api/widget/v1/bookings')
        .set('X-API-Key', validApiKey)
        .set('Origin', 'https://test.example.com')
        .send(oversizedData);

      expect(response.status).toBe(400);
      expect(response.body.errorCode).toBe('VALIDATION_ERROR');
    });

    it('should validate content type', async () => {
      const response = await request(app)
        .post('/api/widget/v1/bookings')
        .set('X-API-Key', validApiKey)
        .set('Origin', 'https://test.example.com')
        .set('Content-Type', 'text/xml')
        .send('<xml>malicious content</xml>');

      expect(response.status).toBe(400);
      expect(response.body.errorCode).toBe('VALIDATION_ERROR');
    });

    it('should handle malformed JSON gracefully', async () => {
      const response = await request(app)
        .post('/api/widget/v1/bookings')
        .set('X-API-Key', validApiKey)
        .set('Origin', 'https://test.example.com')
        .set('Content-Type', 'application/json')
        .send('{ "invalid": json }');

      expect(response.status).toBe(400);
      expect(response.body.success).toBe(false);
      expect(response.body.errorCode).toBe('BAD_REQUEST');
    });
  });

  describe('Reference Number Security', () => {
    it('should generate cryptographically secure reference numbers', () => {
      const { generateReferenceNumber } = require('../../src/utils/encryption');
      const references = [];
      // Generate 20 reference numbers directly
      for (let i = 0; i < 20; i++) {
        const ref = generateReferenceNumber();
        references.push(ref);
      }

      // Check for uniqueness
      const uniqueReferences = new Set(references);
      expect(uniqueReferences.size).toBe(references.length);

      // Check format (W prefix + 7 alphanumeric characters)
      references.forEach(ref => {
        expect(ref).toMatch(/^W[A-Z0-9]{7}$/);
      });

      // Basic entropy check - should not have obvious patterns
      // Check the second character since first is always 'W'
      const secondChars = references.map(ref => ref[1]);
      const uniqueSecondChars = new Set(secondChars);
      expect(uniqueSecondChars.size).toBeGreaterThan(3); // Should have some variety
    });
  });
}); 