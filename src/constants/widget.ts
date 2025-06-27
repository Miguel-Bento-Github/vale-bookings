/**
 * Widget-specific constants
 */

/**
 * Guest booking status types
 */
export const GUEST_BOOKING_STATUSES = {
  PENDING: 'pending',
  CONFIRMED: 'confirmed',
  CANCELLED: 'cancelled',
  COMPLETED: 'completed',
  NO_SHOW: 'no_show'
} as const;

export type GuestBookingStatus = typeof GUEST_BOOKING_STATUSES[keyof typeof GUEST_BOOKING_STATUSES];

/**
 * GDPR consent versions
 */
export const GDPR_CONSENT_VERSIONS = {
  V1_0: '1.0',
  V1_1: '1.1', // Added marketing preferences
  V2_0: '2.0'  // Current version
} as const;

/**
 * Data retention periods (in days)
 */
export const DATA_RETENTION_PERIODS = {
  GUEST_BOOKING: 365,      // 1 year
  AUDIT_LOGS: 730,         // 2 years
  ANALYTICS_DATA: 180,     // 6 months
  CANCELLED_BOOKING: 90,   // 3 months
  API_KEY_USAGE: 90        // 3 months
} as const;

/**
 * Rate limiting defaults
 */
export const RATE_LIMIT_DEFAULTS = {
  GLOBAL: {
    windowMs: 15 * 60 * 1000, // 15 minutes
    maxRequests: 100
  },
  ENDPOINTS: {
    '/api/widget/v1/bookings': {
      windowMs: 5 * 60 * 1000, // 5 minutes
      maxRequests: 10
    },
    '/api/widget/v1/locations': {
      windowMs: 15 * 60 * 1000, // 15 minutes
      maxRequests: 50
    },
    '/api/widget/v1/availability': {
      windowMs: 1 * 60 * 1000, // 1 minute
      maxRequests: 20
    }
  }
} as const;

/**
 * API key configuration
 */
export const API_KEY_CONFIG = {
  PREFIX_LENGTH: 8,
  KEY_LENGTH: 32,
  HASH_ALGORITHM: 'sha256',
  ROTATION_DAYS: 90,
  MAX_DOMAINS_PER_KEY: 10
} as const;

/**
 * Encryption configuration
 */
export const ENCRYPTION_CONFIG = {
  ALGORITHM: 'aes-256-gcm',
  IV_LENGTH: 16,
  SALT_LENGTH: 32,
  TAG_LENGTH: 16,
  ITERATIONS: 100000,
  KEY_LENGTH: 32
} as const;

/**
 * Reference number configuration
 */
export const REFERENCE_NUMBER_CONFIG = {
  LENGTH: 8,
  CHARSET: 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789', // Excludes confusing characters
  PREFIX: 'W' // Widget booking prefix
} as const;

/**
 * Audit trail actions
 */
export const AUDIT_ACTIONS = {
  CREATE: 'CREATE',
  UPDATE: 'UPDATE',
  DELETE: 'DELETE',
  STATUS_CHANGE: 'STATUS_CHANGE',
  CONSENT_GIVEN: 'CONSENT_GIVEN',
  CONSENT_WITHDRAWN: 'CONSENT_WITHDRAWN',
  DATA_EXPORT: 'DATA_EXPORT',
  DATA_ERASURE: 'DATA_ERASURE'
} as const;

export type AuditAction = typeof AUDIT_ACTIONS[keyof typeof AUDIT_ACTIONS];

/**
 * Widget error codes
 */
export const WIDGET_ERROR_CODES = {
  INVALID_API_KEY: 'W001',
  DOMAIN_NOT_ALLOWED: 'W002',
  RATE_LIMIT_EXCEEDED: 'W003',
  INVALID_REFERENCE: 'W004',
  BOOKING_NOT_FOUND: 'W005',
  SLOT_UNAVAILABLE: 'W006',
  GDPR_CONSENT_REQUIRED: 'W007',
  ENCRYPTION_ERROR: 'W008',
  DATA_RETENTION_EXPIRED: 'W009'
} as const;

/**
 * Widget response messages
 */
export const WIDGET_MESSAGES = {
  BOOKING_CREATED: 'Booking created successfully',
  BOOKING_CANCELLED: 'Booking cancelled successfully',
  CONSENT_RECORDED: 'Consent recorded successfully',
  DATA_EXPORTED: 'Data export completed',
  DATA_ERASED: 'Data erasure completed',
  RATE_LIMIT_WARNING: 'You are approaching the rate limit'
} as const; 