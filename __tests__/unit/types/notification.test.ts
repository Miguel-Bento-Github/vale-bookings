import {
  NotificationChannel,
  DeliveryStatus,
  TemplateType,
  LanguageCode,
  NotificationTemplate,
  EmailTemplate,
  SMSTemplate,
  NotificationDelivery,
  ChannelDeliveryResult,
  BookingNotificationData,
  NotificationConfig,
  DeliveryAnalytics,
  ABTestVariant,
  WebhookEvent
} from '../../../src/types/notification';

describe('Notification Types', () => {
  describe('NotificationChannel', () => {
    it('should include all valid notification channels', () => {
      const channels: NotificationChannel[] = ['email', 'sms', 'push'];
      
      expect(channels).toContain('email');
      expect(channels).toContain('sms');
      expect(channels).toContain('push');
      expect(channels).toHaveLength(3);
    });

    it('should type check notification channel assignments', () => {
      const emailChannel: NotificationChannel = 'email';
      const smsChannel: NotificationChannel = 'sms';
      const pushChannel: NotificationChannel = 'push';

      expect(emailChannel).toBe('email');
      expect(smsChannel).toBe('sms');
      expect(pushChannel).toBe('push');
    });
  });

  describe('DeliveryStatus', () => {
    it('should include all valid delivery statuses', () => {
      const statuses: DeliveryStatus[] = [
        'pending',
        'sent',
        'delivered',
        'failed',
        'bounced',
        'complaint',
        'opened',
        'clicked'
      ];

      expect(statuses).toHaveLength(8);
      expect(statuses).toContain('pending');
      expect(statuses).toContain('delivered');
      expect(statuses).toContain('failed');
      expect(statuses).toContain('opened');
    });
  });

  describe('TemplateType', () => {
    it('should include all valid template types', () => {
      const types: TemplateType[] = [
        'booking_confirmation',
        'booking_reminder',
        'cancellation_confirmation',
        'admin_notification',
        'gdpr_data_export',
        'gdpr_data_erasure',
        'payment_confirmation',
        'payment_failed'
      ];

      expect(types).toHaveLength(8);
      expect(types).toContain('booking_confirmation');
      expect(types).toContain('gdpr_data_export');
      expect(types).toContain('payment_failed');
    });
  });

  describe('LanguageCode', () => {
    it('should include all supported language codes', () => {
      const languages: LanguageCode[] = ['en', 'es', 'fr', 'de', 'it', 'pt'];

      expect(languages).toHaveLength(6);
      expect(languages).toContain('en');
      expect(languages).toContain('es');
      expect(languages).toContain('fr');
    });
  });

  describe('NotificationTemplate', () => {
    it('should have correct structure for basic template', () => {
      const template: NotificationTemplate = {
        id: 'template_001',
        name: 'Booking Confirmation',
        type: 'booking_confirmation',
        channel: 'email',
        language: 'en',
        subject: 'Your booking is confirmed',
        isActive: true,
        createdAt: new Date(),
        updatedAt: new Date()
      };

      expect(template.id).toBe('template_001');
      expect(template.name).toBe('Booking Confirmation');
      expect(template.type).toBe('booking_confirmation');
      expect(template.channel).toBe('email');
      expect(template.language).toBe('en');
      expect(template.isActive).toBe(true);
    });

    it('should allow optional fields to be undefined', () => {
      const template: NotificationTemplate = {
        id: 'template_002',
        name: 'SMS Template',
        type: 'booking_reminder',
        channel: 'sms',
        language: 'en',
        isActive: true,
        createdAt: new Date(),
        updatedAt: new Date()
      };

      expect(template.subject).toBeUndefined();
      expect(template.html).toBeUndefined();
      expect(template.text).toBeUndefined();
      expect(template.requiredVariables).toBeUndefined();
    });
  });

  describe('EmailTemplate', () => {
    it('should have correct structure for email template', () => {
      const emailTemplate: EmailTemplate = {
        id: 'email_001',
        name: 'Email Confirmation',
        type: 'booking_confirmation',
        channel: 'email',
        language: 'en',
        subject: 'Booking Confirmed - {{referenceNumber}}',
        html: '<h1>Hello {{guestName}}</h1>',
        text: 'Hello {{guestName}}',
        isActive: true,
        createdAt: new Date(),
        updatedAt: new Date(),
        fromEmail: 'bookings@example.com',
        fromName: 'Booking System',
        replyTo: 'support@example.com'
      };

      expect(emailTemplate.channel).toBe('email');
      expect(emailTemplate.subject).toContain('{{referenceNumber}}');
      expect(emailTemplate.html).toContain('{{guestName}}');
      expect(emailTemplate.fromEmail).toBe('bookings@example.com');
      expect(emailTemplate.fromName).toBe('Booking System');
    });

    it('should allow optional email fields', () => {
      const emailTemplate: EmailTemplate = {
        id: 'email_002',
        name: 'Simple Email',
        type: 'booking_confirmation',
        channel: 'email',
        language: 'en',
        subject: 'Test',
        isActive: true,
        createdAt: new Date(),
        updatedAt: new Date(),
        fromEmail: 'test@example.com'
      };

      expect(emailTemplate.fromName).toBeUndefined();
      expect(emailTemplate.replyTo).toBeUndefined();
      expect(emailTemplate.html).toBeUndefined();
      expect(emailTemplate.text).toBeUndefined();
    });
  });

  describe('SMSTemplate', () => {
    it('should have correct structure for SMS template', () => {
      const smsTemplate: SMSTemplate = {
        id: 'sms_001',
        name: 'SMS Confirmation',
        type: 'booking_confirmation',
        channel: 'sms',
        language: 'en',
        text: 'Your booking {{referenceNumber}} is confirmed for {{date}}',
        isActive: true,
        createdAt: new Date(),
        updatedAt: new Date(),
        from: '+15551234567'
      };

      expect(smsTemplate.channel).toBe('sms');
      expect(smsTemplate.text).toContain('{{referenceNumber}}');
      expect(smsTemplate.from).toBe('+15551234567');
      expect(smsTemplate.subject).toBeUndefined();
    });
  });

  describe('NotificationDelivery', () => {
    it('should have correct structure for delivery tracking', () => {
      const delivery: NotificationDelivery = {
        id: 'delivery_001',
        templateId: 'template_001',
        recipient: 'user@example.com',
        channel: 'email',
        status: 'delivered',
        sentAt: new Date(),
        deliveredAt: new Date(),
        data: {
          referenceNumber: 'REF123',
          guestName: 'John Doe',
          locationName: 'Main Office',
          bookingDate: '2024-01-15',
          bookingTime: '14:00'
        },
        messageId: 'msg_12345',
        webhookId: 'webhook_001'
      };

      expect(delivery.id).toBe('delivery_001');
      expect(delivery.status).toBe('delivered');
      expect(delivery.recipient).toBe('user@example.com');
      expect(delivery.data.referenceNumber).toBe('REF123');
      expect(delivery.messageId).toBe('msg_12345');
    });

    it('should allow optional delivery fields', () => {
      const delivery: NotificationDelivery = {
        id: 'delivery_002',
        templateId: 'template_002',
        recipient: '+15551234567',
        channel: 'sms',
        status: 'pending',
        data: {
          referenceNumber: 'REF456',
          guestName: 'Jane Smith',
          locationName: 'Branch Office',
          bookingDate: '2024-01-16',
          bookingTime: '10:00'
        }
      };

      expect(delivery.sentAt).toBeUndefined();
      expect(delivery.deliveredAt).toBeUndefined();
      expect(delivery.messageId).toBeUndefined();
      expect(delivery.webhookId).toBeUndefined();
    });
  });

  describe('ChannelDeliveryResult', () => {
    it('should have correct structure for delivery result', () => {
      const result: ChannelDeliveryResult = {
        status: 'delivered',
        messageId: 'msg_67890',
        recipient: 'user@example.com',
        sentAt: new Date(),
        deliveredAt: new Date(),
        metadata: {
          provider: 'sendgrid',
          cost: 0.01,
          isTest: false
        }
      };

      expect(result.status).toBe('delivered');
      expect(result.messageId).toBe('msg_67890');
      expect(result.recipient).toBe('user@example.com');
      expect(result.metadata?.provider).toBe('sendgrid');
      expect(result.metadata?.cost).toBe(0.01);
      expect(result.metadata?.isTest).toBe(false);
    });

    it('should handle failure results', () => {
      const result: ChannelDeliveryResult = {
        status: 'failed',
        recipient: 'invalid@email.com',
        error: 'Invalid email address',
        metadata: {
          errorCode: 'INVALID_EMAIL',
          retryable: false
        }
      };

      expect(result.status).toBe('failed');
      expect(result.error).toBe('Invalid email address');
      expect(result.metadata?.errorCode).toBe('INVALID_EMAIL');
      expect(result.metadata?.retryable).toBe(false);
    });
  });

  describe('BookingNotificationData', () => {
    it('should have correct structure for booking data', () => {
      const data: BookingNotificationData = {
        referenceNumber: 'BK123456',
        guestName: 'Alice Johnson',
        locationName: 'Downtown Office',
        bookingDate: '2024-02-15',
        bookingTime: '09:30',
        duration: '60 minutes',
        service: 'Consultation',
        guestEmail: 'alice@example.com',
        guestPhone: '+15551234567',
        notes: 'Please bring ID',
        confirmationUrl: 'https://example.com/confirm/BK123456',
        cancellationUrl: 'https://example.com/cancel/BK123456'
      };

      expect(data.referenceNumber).toBe('BK123456');
      expect(data.guestName).toBe('Alice Johnson');
      expect(data.bookingDate).toBe('2024-02-15');
      expect(data.bookingTime).toBe('09:30');
      expect(data.guestEmail).toBe('alice@example.com');
    });

    it('should allow optional booking data fields', () => {
      const data: BookingNotificationData = {
        referenceNumber: 'BK789012',
        guestName: 'Bob Wilson',
        locationName: 'Remote',
        bookingDate: '2024-02-20',
        bookingTime: '14:00'
      };

      expect(data.duration).toBeUndefined();
      expect(data.service).toBeUndefined();
      expect(data.guestEmail).toBeUndefined();
      expect(data.notes).toBeUndefined();
    });
  });

  describe('WebhookEvent', () => {
    it('should have correct structure for webhook events', () => {
      const event: WebhookEvent = {
        id: 'webhook_event_001',
        type: 'delivery.delivered',
        data: {
          messageId: 'msg_12345',
          deliveryId: 'delivery_001',
          status: 'delivered',
          recipient: 'user@example.com',
          timestamp: new Date(),
          metadata: {
            provider: 'sendgrid',
            openedAt: new Date().toISOString()
          }
        },
        received: new Date(),
        processed: true
      };

      expect(event.id).toBe('webhook_event_001');
      expect(event.type).toBe('delivery.delivered');
      expect(event.data.messageId).toBe('msg_12345');
      expect(event.data.status).toBe('delivered');
      expect(event.processed).toBe(true);
    });

    it('should handle bounce events', () => {
      const event: WebhookEvent = {
        id: 'webhook_event_002',
        type: 'delivery.bounced',
        data: {
          messageId: 'msg_67890',
          status: 'bounced',
          recipient: 'bounced@example.com',
          timestamp: new Date(),
          bounceReason: 'Mailbox does not exist',
          metadata: {
            bounceType: 'permanent',
            bounceSubType: 'NoSuchUser'
          }
        },
        received: new Date(),
        processed: false
      };

      expect(event.type).toBe('delivery.bounced');
      expect(event.data.status).toBe('bounced');
      expect(event.data.bounceReason).toBe('Mailbox does not exist');
      expect(event.processed).toBe(false);
    });
  });

  describe('Type Safety', () => {
    it('should enforce metadata type safety', () => {
      const validMetadata: Record<string, string | number | boolean> = {
        provider: 'sendgrid',
        cost: 0.015,
        isTest: true,
        attempts: 1
      };

      const result: ChannelDeliveryResult = {
        status: 'sent',
        recipient: 'test@example.com',
        metadata: validMetadata
      };

      expect(typeof result.metadata?.provider).toBe('string');
      expect(typeof result.metadata?.cost).toBe('number');
      expect(typeof result.metadata?.isTest).toBe('boolean');
      expect(typeof result.metadata?.attempts).toBe('number');
    });

    it('should handle undefined optional fields gracefully', () => {
      const template: NotificationTemplate = {
        id: 'test_template',
        name: 'Test Template',
        type: 'booking_confirmation',
        channel: 'email',
        language: 'en',
        isActive: true,
        createdAt: new Date(),
        updatedAt: new Date()
      };

      expect(template.subject).toBeUndefined();
      expect(template.html).toBeUndefined();
      expect(template.text).toBeUndefined();
      expect(template.requiredVariables).toBeUndefined();
    });
  });
}); 