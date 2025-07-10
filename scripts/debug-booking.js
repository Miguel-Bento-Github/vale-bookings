const request = require('supertest');
const app = require('../dist/src/app').default;
const { ApiKey } = require('../dist/src/models/ApiKey');
const { hash, generateSecureToken } = require('../dist/src/utils/encryption');

async function testBooking() {
  try {
    // Create API key
    const validApiKey = generateSecureToken(32);
    const hashedKey = hash(validApiKey);
    
    await ApiKey.create({
      name: 'Debug Test Key',
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

    // Create test booking
    const bookingData = {
      locationId: '507f1f77bcf86cd799439011', // Fake ObjectId for testing
      serviceId: 'haircut',
      date: new Date().toISOString().split('T')[0],
      time: '10:00',
      duration: 60,
      guestInfo: {
        firstName: 'John',
        lastName: 'Doe',
        email: 'john.doe@test.com',
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
      .send(bookingData);

    console.log('Status:', response.status);
    console.log('Body:', JSON.stringify(response.body, null, 2));
  } catch (error) {
    console.error('Error:', error);
  }
}

testBooking();
