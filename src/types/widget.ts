import { Document } from 'mongoose';

/**
 * Widget-specific types and interfaces
 */

/**
 * GDPR consent version tracking
 */
export interface GDPRConsent {
  version: string;
  acceptedAt: Date;
  ipAddress: string;
  userAgent?: string;
}

/**
 * Audit trail entry for booking status changes
 */
export interface AuditTrailEntry {
  action: string;
  timestamp: Date;
  userId?: string;
  ipAddress?: string;
  previousValue?: string | number | boolean | null;
  newValue?: string | number | boolean | null;
  metadata?: Record<string, string | number | boolean>;
}

/**
 * Guest booking interface for widget bookings
 */
export interface IGuestBooking extends Document {
  // Booking reference
  referenceNumber: string;
  
  // Guest information (encrypted)
  guestEmail: string;
  guestName: string;
  guestPhone?: string;
  
  // Booking details
  locationId: string;
  serviceId: string;
  bookingDate: Date;
  bookingTime: string;
  duration: number;
  
  // Pricing
  price: number;
  currency: string;
  
  // GDPR compliance
  gdprConsent: GDPRConsent;
  marketingConsent: boolean;
  
  // Security and tracking
  widgetApiKey: string;
  originDomain: string;
  ipAddress: string;
  userAgent: string;
  
  // Status and metadata
  status: 'pending' | 'confirmed' | 'cancelled' | 'completed' | 'no_show';
  auditTrail: AuditTrailEntry[];
  
  // Methods
  addAuditEntry(entry: Partial<AuditTrailEntry>): Promise<IGuestBooking>;
  anonymize(): Promise<IGuestBooking>;
  
  // Timestamps
  createdAt: Date;
  updatedAt: Date;
  expiresAt?: Date;
}

/**
 * API Key configuration for rate limiting
 */
export interface RateLimitConfig {
  windowMs: number;
  maxRequests: number;
  message?: string;
}

/**
 * API Key interface for widget authentication
 */
export interface IApiKey extends Document {
  _id?: string;
  // Key identification
  name: string;
  key: string; // Hashed
  keyPrefix: string; // First 8 chars for identification
  
  // Security configuration
  domainWhitelist: string[];
  allowWildcardSubdomains: boolean;
  
  // Rate limiting
  rateLimits: {
    global: RateLimitConfig;
    endpoints: Record<string, RateLimitConfig>;
  };
  
  // Key lifecycle
  isActive: boolean;
  expiresAt?: Date;
  lastUsedAt?: Date;
  rotatedFrom?: string; // Previous key ID
  rotatedAt?: Date;
  
  // Usage analytics
  usage: {
    totalRequests: number;
    lastResetAt: Date;
    endpoints: Record<string, number>;
  };
  
  // Metadata
  createdBy: string;
  notes?: string;
  tags?: string[];
  
  // Timestamps
  createdAt: Date;
  updatedAt: Date;
  
  // Computed properties (virtuals)
  isExpired?: boolean;
  needsRotation?: boolean;
}

/**
 * Widget configuration returned to frontend
 */
export interface WidgetConfig {
  apiKey: string;
  theme?: {
    primaryColor?: string;
    secondaryColor?: string;
    fontFamily?: string;
    borderRadius?: string;
  };
  features?: {
    guestCheckout: boolean;
    requirePhone: boolean;
    enableSMS: boolean;
    enableReminders: boolean;
    showMap: boolean;
  };
  localization?: {
    defaultLanguage: string;
    supportedLanguages: string[];
    timeFormat: '12h' | '24h';
    dateFormat: string;
  };
}

/**
 * Data export format for GDPR requests
 */
export interface DataExportFormat {
  format: 'json' | 'csv' | 'pdf';
  includeMetadata: boolean;
  anonymize: boolean;
} 