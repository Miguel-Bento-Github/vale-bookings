// Notification channels
export type NotificationChannel = 'email' | 'sms' | 'push';

// Delivery status
export type DeliveryStatus =
  | 'pending'
  | 'sent'
  | 'delivered'
  | 'failed'
  | 'bounced'
  | 'complaint'
  | 'opened'
  | 'clicked';

// Template types
export type TemplateType =
  | 'booking_confirmation'
  | 'booking_reminder'
  | 'cancellation_confirmation'
  | 'admin_notification'
  | 'gdpr_data_export'
  | 'gdpr_data_erasure'
  | 'payment_confirmation'
  | 'payment_failed';

// Language codes
export type LanguageCode = 'en' | 'es' | 'fr' | 'de' | 'it' | 'pt';

// Base notification template interface
export interface NotificationTemplate {
  id: string;
  name: string;
  type: TemplateType;
  channel: NotificationChannel;
  language: LanguageCode;
  subject?: string; // For email
  html?: string; // For email
  text: string; // For email text version and SMS
  requiredVariables: string[];
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

// Template rendering data
export interface TemplateData {
  guestName?: string;
  guestEmail?: string;
  guestPhone?: string;
  referenceNumber?: string;
  locationName?: string;
  locationAddress?: string;
  bookingDate?: string;
  bookingTime?: string;
  duration?: number;
  serviceName?: string;
  price?: number;
  currency?: string;
  hoursUntil?: number;
  adminName?: string;
  cancelReason?: string;
  rescheduleUrl?: string;
  supportEmail?: string;
  supportPhone?: string;
}

// Booking data for notifications
export interface BookingNotificationData {
  id: string;
  referenceNumber: string;
  guestEmail?: string;
  guestName?: string;
  guestPhone?: string;
  locationName: string;
  locationAddress?: string;
  bookingDate: string;
  bookingTime: string;
  duration?: number;
  serviceName?: string;
  price?: number;
  currency?: string;
  hoursUntil?: number;
  channels?: NotificationChannel[];
}

// Channel delivery result
export interface ChannelDeliveryResult {
  status: DeliveryStatus;
  messageId?: string;
  recipient: string;
  sentAt?: Date;
  deliveredAt?: Date;
  bouncedAt?: Date;
  bounceReason?: string;
  error?: string;
  metadata?: Record<string, string | number | boolean>;
}

// Notification delivery result
export interface NotificationDeliveryResult {
  success: boolean;
  deliveryId?: string;
  error?: string;
  channels: Record<NotificationChannel, ChannelDeliveryResult>;
}

// Scheduled reminder
export interface ScheduledReminder {
  success: boolean;
  jobId?: string | null;
  scheduledFor?: Date;
  channels?: NotificationChannel[];
  error?: string;
}

// Reminder cancellation
export interface ReminderCancellation {
  success: boolean;
  jobId: string;
  cancelledAt?: Date;
  error?: string;
}

// Delivery tracking
export interface DeliveryTracking {
  deliveryId: string;
  channels: Record<string, ChannelDeliveryResult>;
  createdAt: Date;
  updatedAt: Date;
}

// Delivery statistics
export interface DeliveryStats {
  totalSent: number;
  delivered: number;
  bounced: number;
  complaints: number;
  opened: number;
  clicked: number;
  deliveryRate: number;
  openRate: number;
  clickRate: number;
  period: {
    startDate: string;
    endDate: string;
  };
}

// Delivery stats filter
export interface DeliveryStatsFilter {
  startDate: string;
  endDate: string;
  channel?: NotificationChannel;
  templateType?: TemplateType;
  language?: LanguageCode;
}

// Template rendering result
export interface TemplateRenderResult {
  success: boolean;
  subject?: string;
  html?: string;
  text?: string;
  message?: string;
  length?: number;
  error?: string;
}

// Template validation result
export interface TemplateValidationResult {
  valid: boolean;
  errors: string[];
}

// Email service configuration
export interface EmailConfig {
  provider: 'sendgrid' | 'ses' | 'smtp';
  apiKey?: string;
  region?: string;
  fromEmail: string;
  fromName: string;
  replyTo?: string;
  webhookUrl?: string;
}

// SMS service configuration
export interface SMSConfig {
  provider: 'twilio' | 'sns';
  accountSid?: string;
  authToken?: string;
  fromNumber: string;
  region?: string;
  webhookUrl?: string;
}

// Queue configuration
export interface QueueConfig {
  provider: 'bull' | 'agenda';
  redis?: {
    host: string;
    port: number;
    password?: string;
    db?: number;
  };
  mongodb?: {
    url: string;
    collection?: string;
  };
}

// Notification preferences
export interface NotificationPreferences {
  userId?: string;
  guestEmail?: string;
  channels: {
    email: boolean;
    sms: boolean;
    push: boolean;
  };
  types: {
    booking_confirmation: boolean;
    booking_reminder: boolean;
    cancellation_confirmation: boolean;
    marketing: boolean;
  };
  language: LanguageCode;
  timezone: string;
  unsubscribeToken?: string;
  createdAt: Date;
  updatedAt: Date;
}

// Webhook event
export interface WebhookEvent {
  id: string;
  type: string;
  data: {
    messageId: string;
    deliveryId?: string;
    status: DeliveryStatus;
    recipient: string;
    timestamp: Date;
    error?: string;
    bounceReason?: string;
    metadata?: Record<string, string | number | boolean>;
  };
  received: Date;
  processed: boolean;
}

// A/B testing variant
export interface TemplateVariant {
  id: string;
  templateId: string;
  name: string;
  percentage: number; // 0-100
  subject?: string;
  html?: string;
  text?: string;
  isActive: boolean;
  metrics: {
    sent: number;
    delivered: number;
    opened: number;
    clicked: number;
  };
}

// Rate limiting for notifications
export interface NotificationRateLimit {
  channel: NotificationChannel;
  maxPerHour: number;
  maxPerDay: number;
  currentHour: number;
  currentDay: number;
  resetHour: Date;
  resetDay: Date;
}

 