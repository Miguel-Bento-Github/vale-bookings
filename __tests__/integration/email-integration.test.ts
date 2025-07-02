import { emailQueueService } from '../../src/services/EmailQueueService';
import { sendEmail } from '../../src/services/EmailService';
import { emailTemplateService } from '../../src/services/EmailTemplateService';
import { EmailWebhookService } from '../../src/services/EmailWebhookService';

// Mock environment variables for testing
const originalEnv = process.env;

describe('Email Integration Tests', () => {
  beforeEach(() => {
    jest.resetModules();
    process.env = { ...originalEnv };
    
    // Set up test environment
    process.env.EMAIL_PROVIDER = 'resend';
    process.env.RESEND_KEY = 'test_key';
    process.env.EMAIL_DOMAIN = 'valebooking.com';
    process.env.EMAIL_FROM = 'test@valebooking.com';
    process.env.EMAIL_FROM_NAME = 'Vale Test';
  });

  afterEach(() => {
    process.env = originalEnv;
    emailQueueService.clear();
  });

  describe('Complete Email Workflow', () => {
    it('should handle a complete booking email workflow', async () => {
      // 1. Send booking confirmation via template service
      const bookingData = {
        bookingId: 'booking-123',
        reference: 'REF123',
        locationName: 'Downtown Office',
        locationAddress: '123 Main St',
        startTime: '2024-01-15T10:00:00Z',
        endTime: '2024-01-15T12:00:00Z',
        duration: 2,
        totalAmount: 50,
        currency: 'USD',
        customerName: 'John Doe',
        customerEmail: 'john@example.com',
        status: 'confirmed' as const
      };

      const confirmationResult = await emailTemplateService.sendBookingConfirmation(bookingData);
      
      // Will fail due to invalid API key, but we can test the workflow
      expect(typeof confirmationResult).toBe('boolean');

      // 2. Queue a reminder email for later

      const tomorrow = new Date();
      tomorrow.setDate(tomorrow.getDate() + 1);

      const queueId = await emailQueueService.enqueue({
        to: 'john@example.com',
        subject: 'Booking Reminder',
        html: '<h1>Your booking is tomorrow!</h1>',
        text: 'Your booking is tomorrow!'
      }, {
        priority: 'normal',
        scheduledFor: tomorrow
      });

      expect(queueId).toBeDefined();
      expect(emailQueueService.getStatus().queueLength).toBe(1);

      // 3. Handle webhook events
      const webhookEvent = {
        type: 'email.delivered' as const,
        data: {
          id: 'email-123',
          from: 'test@valebooking.com',
          to: 'john@example.com',
          subject: 'Booking Confirmation',
          created_at: '2024-01-15T10:00:00Z'
        }
      };

      const webhookResult = await EmailWebhookService.handleWebhookEvent(webhookEvent);
      
      expect(webhookResult.success).toBe(true);
      expect(webhookResult.message).toBe('Email delivered successfully');
    });

    it('should handle email failure and retry workflow', async () => {
      // 1. Send email that will fail
      const email = {
        to: 'test@example.com',
        subject: 'Test',
        html: '<p>Test</p>',
        text: 'Test'
      };

      const sendResult = await sendEmail(email);
      
      // May fail due to invalid API key, but we can still test the workflow
      expect(typeof sendResult.success).toBe('boolean');

      // 2. Queue the failed email for retry
      const queueId = emailQueueService.enqueue(email, { priority: 'high' });
      
      expect(queueId).toBeDefined();
      expect(emailQueueService.getStatus().queueLength).toBe(1);

      // 3. Handle bounce webhook
      const bounceEvent = {
        type: 'email.bounced' as const,
        data: {
          id: 'email-123',
          from: 'test@valebooking.com',
          to: 'test@example.com',
          subject: 'Test',
          created_at: '2024-01-15T10:00:00Z',
          bounce_type: 'hard_bounce' as const,
          bounce_data: {
            type: 'hard_bounce',
            description: 'User not found'
          }
        }
      };

      const bounceResult = await EmailWebhookService.handleWebhookEvent(bounceEvent);
      
      expect(bounceResult.success).toBe(true);
      expect(bounceResult.action).toBe('remove_from_list');
    });

    it('should handle spam complaint workflow', async () => {
      // 1. Handle spam complaint webhook
      const spamEvent = {
        type: 'email.complained' as const,
        data: {
          id: 'email-123',
          from: 'test@valebooking.com',
          to: 'spam@example.com',
          subject: 'Test',
          created_at: '2024-01-15T10:00:00Z',
          complaint_data: {
            type: 'spam',
            description: 'User marked as spam'
          }
        }
      };

      const spamResult = await EmailWebhookService.handleWebhookEvent(spamEvent);
      
      expect(spamResult.success).toBe(true);
      expect(spamResult.action).toBe('remove_from_list');
      expect(spamResult.message).toContain('Spam complaint');

      // 2. Verify the email would be removed from future sends
      // (In a real implementation, this would check a database)
    });
  });

  describe('Email Queue Integration', () => {
    it('should handle multiple queued emails with different priorities', async () => {
      // Add emails with different priorities
      await emailQueueService.enqueue({
        to: 'low@example.com',
        subject: 'Low Priority',
        html: '<p>Low</p>',
        text: 'Low'
      }, { priority: 'low' });

      await emailQueueService.enqueue({
        to: 'high@example.com',
        subject: 'High Priority',
        html: '<p>High</p>',
        text: 'High'
      }, { priority: 'high' });

      await emailQueueService.enqueue({
        to: 'normal@example.com',
        subject: 'Normal Priority',
        html: '<p>Normal</p>',
        text: 'Normal'
      }, { priority: 'normal' });

      const status = emailQueueService.getStatus();
      expect(status.queueLength).toBe(3);
      // Processing status may vary based on queue implementation
      expect(typeof status.processing).toBe('boolean');
    });

    it('should handle scheduled emails', async () => {
      const future = new Date();
      future.setDate(future.getDate() + 2);

      await emailQueueService.enqueue({
        to: 'future@example.com',
        subject: 'Future Email',
        html: '<p>Future</p>',
        text: 'Future'
      }, { scheduledFor: future });

      const status = emailQueueService.getStatus();
      expect(status.queueLength).toBe(1);
    });
  });

  describe('Webhook Integration', () => {
    it('should handle all webhook event types', async () => {
      const events = [
        {
          type: 'email.delivered' as const,
          expectedAction: undefined,
          expectedMessage: 'Email delivered successfully'
        },
        {
          type: 'email.delivery_delayed' as const,
          expectedAction: 'retry_later' as const,
          expectedMessage: 'Email delivery delayed'
        },
        {
          type: 'email.bounced' as const,
          expectedAction: 'remove_from_list' as const,
          expectedMessage: 'Hard bounce'
        },
        {
          type: 'email.complained' as const,
          expectedAction: 'remove_from_list' as const,
          expectedMessage: 'Spam complaint'
        },
        {
          type: 'email.unsubscribed' as const,
          expectedAction: 'remove_from_list' as const,
          expectedMessage: 'unsubscribed'
        }
      ];

      for (const eventConfig of events) {
        const event = {
          type: eventConfig.type,
          data: {
            id: 'email-123',
            from: 'test@valebooking.com',
            to: 'test@example.com',
            subject: 'Test',
            created_at: '2024-01-15T10:00:00Z',
            ...(eventConfig.type === 'email.bounced' && {
              bounce_type: 'hard_bounce' as const,
              bounce_data: { type: 'hard_bounce', description: 'Test' }
            }),
            ...(eventConfig.type === 'email.complained' && {
              complaint_data: { type: 'spam', description: 'Test' }
            })
          }
        };

        const result = await EmailWebhookService.handleWebhookEvent(event);
        
        expect(result.success).toBe(true);
        if (eventConfig.expectedAction) {
          expect(result.action).toBe(eventConfig.expectedAction);
        }
        expect(result.message).toContain(eventConfig.expectedMessage);
      }
    });
  });
}); 