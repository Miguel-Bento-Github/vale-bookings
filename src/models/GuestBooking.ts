import mongoose, { Schema, model } from 'mongoose';

import { 
  GUEST_BOOKING_STATUSES, 
  DATA_RETENTION_PERIODS,
  AUDIT_ACTIONS,
  GDPR_CONSENT_VERSIONS,
  REFERENCE_NUMBER_CONFIG
} from '../constants/widget';
import { IGuestBooking, GDPRConsent, AuditTrailEntry } from '../types/widget';
import { encryptionService } from '../utils/encryption';

/**
 * GDPR Consent sub-schema
 */
const gdprConsentSchema = new Schema<GDPRConsent>({
  version: {
    type: String,
    required: true,
    enum: Object.values(GDPR_CONSENT_VERSIONS)
  },
  acceptedAt: {
    type: Date,
    required: true,
    default: Date.now
  },
  ipAddress: {
    type: String,
    required: true
  },
  userAgent: {
    type: String
  }
}, { _id: false });

/**
 * Audit Trail Entry sub-schema
 */
const auditTrailSchema = new Schema<AuditTrailEntry>({
  action: {
    type: String,
    required: true,
    enum: Object.values(AUDIT_ACTIONS)
  },
  timestamp: {
    type: Date,
    required: true,
    default: Date.now
  },
  userId: String,
  ipAddress: String,
  previousValue: Schema.Types.Mixed,
  newValue: Schema.Types.Mixed,
  metadata: {
    type: Schema.Types.Mixed
  }
}, { _id: false });

/**
 * Guest Booking Schema
 */
const guestBookingSchema = new Schema<IGuestBooking>({
  // Booking reference
  referenceNumber: {
    type: String,
    unique: true,
    index: true
  },
  
  // Guest information (will be encrypted)
  guestEmail: {
    type: String,
    required: true,
    set: (value: string): string => value ? encryptionService.encrypt(value.toLowerCase()) : value,
    get: (value: string): string => value ? encryptionService.decrypt(value) : value
  },
  guestName: {
    type: String,
    required: true,
    set: (value: string): string => value ? encryptionService.encrypt(value) : value,
    get: (value: string): string => value ? encryptionService.decrypt(value) : value
  },
  guestPhone: {
    type: String,
    set: (value: string): string => value ? encryptionService.encrypt(value) : value,
    get: (value: string): string => value ? encryptionService.decrypt(value) : value
  },
  
  // Booking details
  locationId: {
    type: String,
    required: true,
    index: true
  },
  serviceId: {
    type: String,
    required: true
  },
  bookingDate: {
    type: Date,
    required: true,
    index: true
  },
  bookingTime: {
    type: String,
    required: true
  },
  duration: {
    type: Number,
    required: true,
    min: 15,
    max: 480 // 8 hours max
  },
  
  // Pricing
  price: {
    type: Number,
    required: true,
    min: 0
  },
  currency: {
    type: String,
    required: true,
    default: 'USD',
    uppercase: true,
    maxlength: 3
  },
  
  // GDPR compliance
  gdprConsent: {
    type: gdprConsentSchema,
    required: true
  },
  marketingConsent: {
    type: Boolean,
    required: true,
    default: false
  },
  
  // Security and tracking
  widgetApiKey: {
    type: String,
    required: true,
    index: true
  },
  originDomain: {
    type: String,
    required: true
  },
  ipAddress: {
    type: String,
    required: true
  },
  userAgent: {
    type: String,
    required: true
  },
  
  // Status and metadata
  status: {
    type: String,
    required: true,
    enum: Object.values(GUEST_BOOKING_STATUSES),
    default: GUEST_BOOKING_STATUSES.PENDING,
    index: true
  },
  auditTrail: {
    type: [auditTrailSchema],
    default: []
  },
  
  // Data retention
  expiresAt: {
    type: Date,
    default: function(): Date {
      const now = new Date();
      now.setDate(now.getDate() + DATA_RETENTION_PERIODS.GUEST_BOOKING);
      return now;
    },
    index: true
  }
}, {
  timestamps: true,
  toJSON: { getters: true },
  toObject: { getters: true }
});

// Indexes for performance
guestBookingSchema.index({ bookingDate: 1, locationId: 1 });
guestBookingSchema.index({ createdAt: -1 });
guestBookingSchema.index({ status: 1, bookingDate: 1 });
guestBookingSchema.index({ widgetApiKey: 1, createdAt: -1 });

// TTL index for automatic data expiration
guestBookingSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

// Pre-save middleware for encryption
guestBookingSchema.pre('save', function(this: IGuestBooking, next): void {
  try {
    // Generate reference number for new bookings
    if (this.isNew && !this.referenceNumber) {
      const timestamp = Date.now().toString(36); // Convert timestamp to base36
      const randomChars = Array.from(
        { length: REFERENCE_NUMBER_CONFIG.LENGTH - REFERENCE_NUMBER_CONFIG.PREFIX.length - timestamp.length },
        () => REFERENCE_NUMBER_CONFIG.CHARSET[Math.floor(Math.random() * REFERENCE_NUMBER_CONFIG.CHARSET.length)]
      ).join('');
      
      this.referenceNumber = REFERENCE_NUMBER_CONFIG.PREFIX + timestamp + randomChars;
    }

    // Encrypt PII fields if they are being modified
    if (this.isModified('guestEmail') && this.guestEmail !== undefined) {
      this.guestEmail = encryptionService.encrypt(this.guestEmail);
    }
    if (this.isModified('guestPhone') && this.guestPhone !== undefined) {
      this.guestPhone = encryptionService.encrypt(this.guestPhone);
    }

    // Set default expiration for GDPR compliance (30 days after booking date)
    if (this.isNew === true && this.expiresAt === undefined) {
      const expirationDate = new Date(this.bookingDate);
      expirationDate.setDate(
        expirationDate.getDate() + DATA_RETENTION_PERIODS.GUEST_BOOKING
      );
      this.expiresAt = expirationDate;
    }

    // Audit trail for status changes
    if (this.isModified('status')) {
      const auditEntry: AuditTrailEntry = {
        action: AUDIT_ACTIONS.STATUS_CHANGE,
        timestamp: new Date(),
        previousValue: this.get('status', null, { getters: false }) as string,
        newValue: this.status,
        userId: 'system', // In real implementation, this would be the user ID
        metadata: { reason: 'Status update' }
      };
      this.auditTrail.push(auditEntry);
    }
    next();
  } catch (err) {
    next(err as Error);
  }
});

// Pre-update middleware to track changes
guestBookingSchema.pre('findOneAndUpdate', function(next): void {
  const update = this.getUpdate() as {
    $set?: Record<string, unknown>;
    $push?: Record<string, unknown>;
  };
  
  // If status is being updated, add audit trail
  const isStatusUpdate = update.$set !== undefined && 
    typeof update.$set === 'object' && 
    update.$set !== null && 
    typeof update.$set.status === 'string';
  if (isStatusUpdate && update.$set !== undefined) {
    update.$push = update.$push ?? {};
    if (typeof update.$push === 'object' && update.$push !== null) {
      const auditEntry: AuditTrailEntry = {
        action: AUDIT_ACTIONS.STATUS_CHANGE,
        timestamp: new Date(),
        previousValue: this.getOptions().status as string,
        newValue: update.$set.status as string,
        ipAddress: typeof update.$set.ipAddress === 'string' ? update.$set.ipAddress : 'system'
      };
      update.$push.auditTrail = auditEntry;
    }
  }
  
  next();
});

// Instance methods
guestBookingSchema.methods.addAuditEntry = function(
  this: IGuestBooking,
  entry: Partial<AuditTrailEntry>
): Promise<IGuestBooking> {
  const completeEntry: AuditTrailEntry = {
    action: entry.action ?? 'UNKNOWN',
    timestamp: entry.timestamp ?? new Date(),
    userId: entry.userId,
    ipAddress: entry.ipAddress,
    previousValue: entry.previousValue,
    newValue: entry.newValue,
    metadata: entry.metadata
  };
  if (!Array.isArray(this.auditTrail)) {
    this.auditTrail = [];
  }
  this.auditTrail.push(completeEntry);
  return this.save();
};

guestBookingSchema.methods.anonymize = function(this: IGuestBooking): Promise<IGuestBooking> {
  this.guestEmail = encryptionService.encrypt('anonymized@example.com');
  this.guestName = encryptionService.encrypt('ANONYMIZED');
  this.guestPhone = undefined;
  this.ipAddress = '0.0.0.0';
  this.userAgent = 'ANONYMIZED';
  
  return this.addAuditEntry({
    action: AUDIT_ACTIONS.DATA_ERASURE,
    metadata: { reason: 'GDPR request' }
  });
};

// Static methods
guestBookingSchema.statics.findByReference = function(referenceNumber: string): Promise<IGuestBooking | null> {
  return this.findOne({ referenceNumber });
};

guestBookingSchema.statics.findExpired = function(): Promise<IGuestBooking[]> {
  return this.find({ expiresAt: { $lte: new Date() } });
};

// Create interface for static methods
interface IGuestBookingModel extends mongoose.Model<IGuestBooking> {
  findByReference(referenceNumber: string): Promise<IGuestBooking | null>;
  findExpired(): Promise<IGuestBooking[]>;
}

// Export model
export const GuestBooking = model<IGuestBooking, IGuestBookingModel>('GuestBooking', guestBookingSchema); 