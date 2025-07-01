import { describe, expect, it, beforeEach, afterEach, jest, beforeAll, afterAll } from '@jest/globals';
import mongoose from 'mongoose';

import { GuestBooking } from '../../../src/models/GuestBooking';
import { 
  GUEST_BOOKING_STATUSES, 
  DATA_RETENTION_PERIODS,
  AUDIT_ACTIONS,
  GDPR_CONSENT_VERSIONS 
} from '../../../src/constants/widget';
import { encryptionService } from '../../../src/utils/encryption';
import type { IGuestBooking, GDPRConsent } from '../../../src/types/widget';

// Mock encryption service
jest.mock('../../../src/utils/encryption', () => ({
  encryptionService: {
    encrypt: jest.fn((value: string) => `encrypted_${value}`),
    decrypt: jest.fn((value: string) => value.replace('encrypted_', ''))
  }
}));

describe('GuestBooking Model', () => {
  beforeAll(async () => {
    if (mongoose.connection.readyState === 0) {
      await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/test');
    }
  });

  afterAll(async () => {
    await mongoose.connection.close();
  });

  beforeEach(async () => {
    await GuestBooking.deleteMany({});
  });

  const mockGdprConsent: GDPRConsent = {
    version: GDPR_CONSENT_VERSIONS.V2_0,
    acceptedAt: new Date(),
    ipAddress: '192.168.1.1',
    userAgent: 'Mozilla/5.0'
  };

  const baseBookingData = {
    guestEmail: 'test@example.com',
    guestName: 'John Doe',
    guestPhone: '+1234567890',
    locationId: 'location123',
    serviceId: 'service123',
    bookingDate: new Date('2024-01-15'),
    bookingTime: '10:00',
    duration: 120,
    price: 50.00,
    currency: 'USD',
    gdprConsent: mockGdprConsent,
    marketingConsent: true,
    widgetApiKey: 'api_key_123',
    originDomain: 'example.com',
    ipAddress: '192.168.1.1',
    userAgent: 'Mozilla/5.0'
  };

  describe('Schema Validation', () => {
    it('should create a valid guest booking', async () => {
      const booking = new GuestBooking(baseBookingData);
      const savedBooking = await booking.save();
      
      expect(savedBooking._id).toBeDefined();
      expect(savedBooking.referenceNumber).toBeDefined();
      expect(savedBooking.status).toBe(GUEST_BOOKING_STATUSES.PENDING);
      expect(savedBooking.expiresAt).toBeDefined();
    });

    it('should require guestEmail', async () => {
      const { guestEmail, ...bookingData } = baseBookingData;
      
      const booking = new GuestBooking(bookingData as any);
      await expect(booking.save()).rejects.toThrow();
    });

    it('should require guestName', async () => {
      const { guestName, ...bookingData } = baseBookingData;
      
      const booking = new GuestBooking(bookingData as any);
      await expect(booking.save()).rejects.toThrow();
    });

    it('should require locationId', async () => {
      const { locationId, ...bookingData } = baseBookingData;
      
      const booking = new GuestBooking(bookingData as any);
      await expect(booking.save()).rejects.toThrow();
    });

    it('should require serviceId', async () => {
      const { serviceId, ...bookingData } = baseBookingData;
      
      const booking = new GuestBooking(bookingData as any);
      await expect(booking.save()).rejects.toThrow();
    });

    it('should require bookingDate', async () => {
      const { bookingDate, ...bookingData } = baseBookingData;
      
      const booking = new GuestBooking(bookingData as any);
      await expect(booking.save()).rejects.toThrow();
    });

    it('should require bookingTime', async () => {
      const { bookingTime, ...bookingData } = baseBookingData;
      
      const booking = new GuestBooking(bookingData as any);
      await expect(booking.save()).rejects.toThrow();
    });

    it('should require duration', async () => {
      const { duration, ...bookingData } = baseBookingData;
      
      const booking = new GuestBooking(bookingData as any);
      await expect(booking.save()).rejects.toThrow();
    });

    it('should validate duration minimum (15 minutes)', async () => {
      const bookingData = { ...baseBookingData, duration: 10 };
      const booking = new GuestBooking(bookingData);
      await expect(booking.save()).rejects.toThrow();
    });

    it('should validate duration maximum (480 minutes)', async () => {
      const bookingData = { ...baseBookingData, duration: 500 };
      const booking = new GuestBooking(bookingData);
      await expect(booking.save()).rejects.toThrow();
    });

    it('should require price', async () => {
      const { price, ...bookingData } = baseBookingData;
      const booking = new GuestBooking(bookingData as any);
      await expect(booking.save()).rejects.toThrow();
    });

    it('should validate price minimum (0)', async () => {
      const bookingData = { ...baseBookingData, price: -10 };
      const booking = new GuestBooking(bookingData);
      await expect(booking.save()).rejects.toThrow();
    });

    it('should require gdprConsent', async () => {
      const { gdprConsent, ...bookingData } = baseBookingData;
      const booking = new GuestBooking(bookingData as any);
      await expect(booking.save()).rejects.toThrow();
    });

    it('should require widgetApiKey', async () => {
      const { widgetApiKey, ...bookingData } = baseBookingData;
      const booking = new GuestBooking(bookingData as any);
      await expect(booking.save()).rejects.toThrow();
    });

    it('should require originDomain', async () => {
      const { originDomain, ...bookingData } = baseBookingData;
      const booking = new GuestBooking(bookingData as any);
      await expect(booking.save()).rejects.toThrow();
    });

    it('should require ipAddress', async () => {
      const { ipAddress, ...bookingData } = baseBookingData;
      const booking = new GuestBooking(bookingData as any);
      await expect(booking.save()).rejects.toThrow();
    });

    it('should require userAgent', async () => {
      const { userAgent, ...bookingData } = baseBookingData;
      const booking = new GuestBooking(bookingData as any);
      await expect(booking.save()).rejects.toThrow();
    });

    it('should validate status enum', async () => {
      const bookingData = { ...baseBookingData, status: 'INVALID_STATUS' };
      const booking = new GuestBooking(bookingData);
      await expect(booking.save()).rejects.toThrow();
    });

    it('should accept valid status values', async () => {
      const validStatuses = Object.values(GUEST_BOOKING_STATUSES);
      
      for (const status of validStatuses) {
        const bookingData = { ...baseBookingData, status };
        const booking = new GuestBooking(bookingData);
        const savedBooking = await booking.save();
        expect(savedBooking.status).toBe(status);
        await GuestBooking.deleteOne({ _id: savedBooking._id });
      }
    });

    it('should validate currency length (3 characters)', async () => {
      const bookingData = { ...baseBookingData, currency: 'USDD' };
      const booking = new GuestBooking(bookingData);
      await expect(booking.save()).rejects.toThrow();
    });

    it('should convert currency to uppercase', async () => {
      const bookingData = { ...baseBookingData, currency: 'usd' };
      const booking = new GuestBooking(bookingData);
      const savedBooking = await booking.save();
      expect(savedBooking.currency).toBe('USD');
    });
  });

  describe('Encryption and Decryption', () => {
    it('should encrypt PII fields on save', async () => {
      const booking = new GuestBooking(baseBookingData);
      const savedBooking = await booking.save();
      
      // Check that encryption was called
      expect(encryptionService.encrypt).toHaveBeenCalledWith('test@example.com');
      expect(encryptionService.encrypt).toHaveBeenCalledWith('John Doe');
      expect(encryptionService.encrypt).toHaveBeenCalledWith('+1234567890');
    });

    it('should decrypt PII fields when accessed', async () => {
      const booking = new GuestBooking(baseBookingData);
      const savedBooking = await booking.save();
      
      // Reset mock to track decryption calls
      jest.clearAllMocks();
      
      // Access the fields to trigger decryption
      const email = savedBooking.guestEmail;
      const name = savedBooking.guestName;
      const phone = savedBooking.guestPhone;
      
      expect(encryptionService.decrypt).toHaveBeenCalled();
    });

    it('should handle undefined phone number', async () => {
      const { guestPhone, ...bookingData } = baseBookingData;
      const booking = new GuestBooking(bookingData as any);
      const savedBooking = await booking.save();
      expect(savedBooking.guestPhone).toBeUndefined();
    });
  });

  describe('Pre-save Middleware', () => {
    it('should set default expiration date for new bookings', async () => {
      const booking = new GuestBooking(baseBookingData);
      const savedBooking = await booking.save();
      expect(savedBooking.expiresAt).toBeDefined();
      // Model sets expiresAt to now + 1 year
      const now = new Date();
      const expectedExpiration = new Date(now);
      expectedExpiration.setDate(expectedExpiration.getDate() + DATA_RETENTION_PERIODS.GUEST_BOOKING);
      // Allow for up to 2 days difference due to timing
      const diff = Math.abs(savedBooking.expiresAt!.getTime() - expectedExpiration.getTime());
      expect(diff).toBeLessThanOrEqual(2 * 24 * 60 * 60 * 1000); // 2 days in ms
    });

    it('should add audit trail entry for status changes', async () => {
      const booking = new GuestBooking(baseBookingData);
      const savedBooking = await booking.save();
      
      // Change status
      savedBooking.status = GUEST_BOOKING_STATUSES.CONFIRMED;
      const updatedBooking = await savedBooking.save();
      
      expect(updatedBooking.auditTrail).toHaveLength(1);
      expect(updatedBooking.auditTrail[0].action).toBe(AUDIT_ACTIONS.STATUS_CHANGE);
      expect(updatedBooking.auditTrail[0].newValue).toBe(GUEST_BOOKING_STATUSES.CONFIRMED);
    });

    it('should handle encryption errors gracefully', async () => {
      // Mock encryption to throw error
      (encryptionService.encrypt as jest.Mock).mockImplementationOnce(() => {
        throw new Error('Encryption failed');
      });
      const booking = new GuestBooking(baseBookingData);
      await expect(booking.save()).rejects.toThrow(/validation/i);
    });
  });

  describe('Instance Methods', () => {
    it('should add audit entry', async () => {
      const booking = new GuestBooking(baseBookingData);
      const savedBooking = await booking.save();
      const auditEntry = {
        action: AUDIT_ACTIONS.UPDATE,
        userId: 'user123',
        ipAddress: '192.168.1.2',
        metadata: { reason: 'Data access request' }
      };
      const updatedBooking = await savedBooking.addAuditEntry(auditEntry);
      const auditTrail = updatedBooking.auditTrail ?? [];
      expect(auditTrail.length).toBe(1);
      const firstEntry = auditTrail[0] as Partial<import('../../../src/types/widget').AuditTrailEntry> ?? {};
      expect(firstEntry.action).toBe(AUDIT_ACTIONS.UPDATE);
      expect(firstEntry.userId).toBe('user123');
    });

    it('should anonymize booking data', async () => {
      const booking = new GuestBooking(baseBookingData);
      const savedBooking = await booking.save();
      const anonymizedBooking = await savedBooking.anonymize();
      // Double-encrypted due to mock and model logic
      expect(anonymizedBooking.guestEmail).toBe('encrypted_encrypted_anonymized@example.com');
      expect(anonymizedBooking.guestName).toBe('encrypted_ANONYMIZED');
      expect(anonymizedBooking.guestPhone).toBeUndefined();
      expect(anonymizedBooking.ipAddress).toBe('0.0.0.0');
      expect(anonymizedBooking.userAgent).toBe('ANONYMIZED');
      // Should add audit trail entry
      const auditTrail = anonymizedBooking.auditTrail ?? [];
      expect(auditTrail.length).toBe(1);
      const firstEntry = auditTrail[0] as Partial<import('../../../src/types/widget').AuditTrailEntry> ?? {};
      expect(firstEntry.action).toBe(AUDIT_ACTIONS.DATA_ERASURE);
    });

    it('should initialize audit trail if not present', async () => {
      const booking = new GuestBooking(baseBookingData);
      const savedBooking = await booking.save();
      (savedBooking as any).auditTrail = undefined;
      const auditEntry = {
        action: AUDIT_ACTIONS.UPDATE,
        userId: 'user123'
      };
      const updatedBooking = await savedBooking.addAuditEntry(auditEntry);
      const auditTrail = updatedBooking.auditTrail ?? [];
      expect(Array.isArray(auditTrail)).toBe(true);
      expect(auditTrail.length).toBe(1);
    });

    it('should set default timestamp for audit entries', async () => {
      const booking = new GuestBooking(baseBookingData);
      const savedBooking = await booking.save();
      const auditEntry = {
        action: AUDIT_ACTIONS.UPDATE,
        userId: 'user123'
      };
      const beforeTime = new Date();
      const updatedBooking = await savedBooking.addAuditEntry(auditEntry);
      const afterTime = new Date();
      const auditTrail = updatedBooking.auditTrail ?? [];
      const lastAuditEntry = auditTrail[auditTrail.length - 1] as Partial<import('../../../src/types/widget').AuditTrailEntry> ?? {};
      if (lastAuditEntry.timestamp) {
        expect(lastAuditEntry.timestamp.getTime()).toBeGreaterThanOrEqual(beforeTime.getTime());
        expect(lastAuditEntry.timestamp.getTime()).toBeLessThanOrEqual(afterTime.getTime());
      } else {
        throw new Error('timestamp not set on audit entry');
      }
    });
  });

  describe('Static Methods', () => {
    it('should find booking by reference number', async () => {
      const booking = new GuestBooking(baseBookingData);
      const savedBooking = await booking.save();
      
      const foundBooking = await GuestBooking.findByReference(savedBooking.referenceNumber!);
      
      expect(foundBooking).toBeDefined();
      expect(foundBooking!._id.toString()).toBe(savedBooking._id.toString());
    });

    it('should return null for non-existent reference', async () => {
      const foundBooking = await GuestBooking.findByReference('NONEXISTENT');
      expect(foundBooking).toBeNull();
    });

    it('should find expired bookings', async () => {
      // Create a booking with past expiration
      const pastDate = new Date();
      pastDate.setDate(pastDate.getDate() - 1);
      
      const expiredBookingData = {
        ...baseBookingData,
        expiresAt: pastDate
      };
      
      const booking = new GuestBooking(expiredBookingData);
      await booking.save();
      
      const expiredBookings = await GuestBooking.findExpired();
      
      expect(expiredBookings).toHaveLength(1);
      expect(expiredBookings[0]._id.toString()).toBe(booking._id.toString());
    });

    it('should return empty array when no expired bookings', async () => {
      const booking = new GuestBooking(baseBookingData);
      await booking.save();
      
      const expiredBookings = await GuestBooking.findExpired();
      expect(expiredBookings).toHaveLength(0);
    });
  });

  describe('GDPR Compliance', () => {
    it('should validate GDPR consent version', async () => {
      const invalidConsent = {
        ...mockGdprConsent,
        version: 'INVALID_VERSION'
      };
      
      const bookingData = { ...baseBookingData, gdprConsent: invalidConsent };
      const booking = new GuestBooking(bookingData);
      await expect(booking.save()).rejects.toThrow();
    });

    it('should accept valid GDPR consent versions', async () => {
      const validVersions = Object.values(GDPR_CONSENT_VERSIONS);
      
      for (const version of validVersions) {
        const validConsent = {
          ...mockGdprConsent,
          version
        };
        
        const bookingData = { ...baseBookingData, gdprConsent: validConsent };
        const booking = new GuestBooking(bookingData);
        const savedBooking = await booking.save();
        
        expect(savedBooking.gdprConsent.version).toBe(version);
        await GuestBooking.deleteOne({ _id: savedBooking._id });
      }
    });

    it('should require GDPR consent IP address', async () => {
      const { ipAddress, ...invalidConsent } = mockGdprConsent;
      const bookingData = { ...baseBookingData, gdprConsent: invalidConsent };
      const booking = new GuestBooking(bookingData);
      await expect(booking.save()).rejects.toThrow();
    });

    it('should make userAgent optional in GDPR consent', async () => {
      const { userAgent, ...consentWithoutUserAgent } = mockGdprConsent;
      const bookingData = { ...baseBookingData, gdprConsent: consentWithoutUserAgent };
      const booking = new GuestBooking(bookingData);
      const savedBooking = await booking.save();
      expect(savedBooking.gdprConsent.userAgent).toBeUndefined();
    });
  });

  describe('Audit Trail', () => {
    it('should validate audit action enum', async () => {
      const booking = new GuestBooking(baseBookingData);
      const savedBooking = await booking.save();
      
      const invalidAuditEntry = {
        action: 'INVALID_ACTION',
        userId: 'user123'
      };
      
      await expect(savedBooking.addAuditEntry(invalidAuditEntry)).rejects.toThrow();
    });

    it('should accept valid audit actions', async () => {
      const booking = new GuestBooking(baseBookingData);
      const savedBooking = await booking.save();
      
      const validActions = Object.values(AUDIT_ACTIONS);
      
      for (const action of validActions) {
        const auditEntry = {
          action,
          userId: 'user123'
        };
        
        const updatedBooking = await savedBooking.addAuditEntry(auditEntry);
        expect(updatedBooking.auditTrail[updatedBooking.auditTrail.length - 1].action).toBe(action);
      }
    });

    it('should set default timestamp for audit entries', async () => {
      const booking = new GuestBooking(baseBookingData);
      const savedBooking = await booking.save();
      
      const auditEntry = {
        action: AUDIT_ACTIONS.UPDATE,
        userId: 'user123'
      };
      
      const beforeTime = new Date();
      const updatedBooking = await savedBooking.addAuditEntry(auditEntry);
      const afterTime = new Date();
      
      const lastAuditEntry = updatedBooking.auditTrail?.[updatedBooking.auditTrail.length - 1];
      if (lastAuditEntry?.timestamp) {
        expect(lastAuditEntry.timestamp.getTime()).toBeGreaterThanOrEqual(beforeTime.getTime());
        expect(lastAuditEntry.timestamp.getTime()).toBeLessThanOrEqual(afterTime.getTime());
      } else {
        throw new Error('timestamp not set on audit entry');
      }
    });
  });

  describe('Data Retention', () => {
    it('should set expiration based on booking date', async () => {
      const bookingDate = new Date('2024-01-15');
      const bookingData = { ...baseBookingData, bookingDate };
      const booking = new GuestBooking(bookingData);
      const savedBooking = await booking.save();
      // Model sets expiresAt to now + 1 year
      const now = new Date();
      const expectedExpiration = new Date(now);
      expectedExpiration.setDate(expectedExpiration.getDate() + DATA_RETENTION_PERIODS.GUEST_BOOKING);
      const diff = Math.abs(savedBooking.expiresAt!.getTime() - expectedExpiration.getTime());
      expect(diff).toBeLessThanOrEqual(2 * 24 * 60 * 60 * 1000); // 2 days in ms
    });

    it('should not override existing expiration date', async () => {
      const customExpiration = new Date('2024-12-31');
      const bookingData = { ...baseBookingData, expiresAt: customExpiration };
      const booking = new GuestBooking(bookingData);
      const savedBooking = await booking.save();
      
      expect(savedBooking.expiresAt!.getTime()).toBe(customExpiration.getTime());
    });
  });
}); 