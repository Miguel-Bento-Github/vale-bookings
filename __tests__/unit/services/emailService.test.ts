import { afterEach, beforeEach, describe, expect, it, jest } from '@jest/globals';

import { emailQueueService } from '../../../src/services/EmailQueueService';
import { sendEmail, sendBulkEmails, testEmailConfig, getEmailServiceStatus } from '../../../src/services/EmailService';
import { emailTemplateService } from '../../../src/services/EmailTemplateService';

// Mock external dependencies
jest.mock('resend', () => ({
  Resend: jest.fn().mockImplementation(() => ({
    emails: {
      send: jest.fn().mockResolvedValue({ data: { id: 'sg_test-email-id' } })
    }
  })) as any
}));

jest.mock('nodemailer', () => ({
  createTransport: jest.fn().mockReturnValue({
    verify: jest.fn().mockResolvedValue(undefined),
    sendMail: jest.fn().mockResolvedValue({ messageId: 'smtp_test-message-id' }),
    close: jest.fn()
  })
}));



describe('EmailService', () => {
  const ORIGINAL_ENV = process.env;
  const ORIGINAL_SET_TIMEOUT = global.setTimeout;

  beforeEach(() => {
    // Clone env so mutations do not leak between tests
    process.env = { ...ORIGINAL_ENV };
    process.env.EMAIL_PROVIDER = 'resend';
    process.env.RESEND_KEY = 'test_key';
    process.env.EMAIL_DOMAIN = 'valebooking.com';
    process.env.EMAIL_FROM = 'test@valebooking.com';
    process.env.EMAIL_FROM_NAME = 'Vale Test';
  });

  afterEach(() => {
    process.env = ORIGINAL_ENV;
    jest.clearAllMocks();
    global.setTimeout = ORIGINAL_SET_TIMEOUT;
  });

  describe('Basic functionality', () => {
    it('returns error for invalid recipient email', async () => {
      const result = await sendEmail({
        to: 'not-an-email',
        subject: 'Hi',
        html: '<p>Hello</p>',
        text: 'Hello'
      });

      expect(result.success).toBe(false);
      expect(result.error).toMatch(/invalid email address/i);
    });

    it('sends email successfully via SendGrid mock', async () => {
      const result = await sendEmail({
        to: 'user@example.com',
        subject: 'Greetings',
        html: '<p>Hello</p>',
        text: 'Hello'
      });

      expect(result.success).toBe(true);
      expect(result.provider).toBe('resend');
      expect(result.messageId).toMatch(/^sg_/);
    });

    it('sends a batch of emails successfully', async () => {
      const messages = Array.from({ length: 3 }).map((_, idx) => ({
        to: `recipient${idx}@example.com`,
        subject: `Message ${idx}`,
        html: '<p>Body</p>',
        text: 'Body'
      }));

      const results = await sendBulkEmails(messages, 2, 10);

      expect(results).toHaveLength(3);
      expect(results.every(r => r.success)).toBe(true);
    });

    it('routes to SMTP provider', async () => {
      process.env.EMAIL_PROVIDER = 'smtp';
      const result = await sendEmail({
        to: 'user@example.com',
        subject: 'Hi',
        html: '<p>hi</p>',
        text: 'hi'
      });
      expect(result.success).toBe(true);
      expect(result.provider).toBe('smtp');
      expect(result.messageId).toMatch(/^smtp_/);
    });

    it('uses custom from address when provided', async () => {
      const result = await sendEmail({
        to: 'user@example.com',
        subject: 'Test',
        html: '<p>Test</p>',
        text: 'Test',
        from: 'custom@example.com'
      });

      expect(result.success).toBe(true);
    });

    it('uses replyTo from message when provided', async () => {
      const result = await sendEmail({
        to: 'user@example.com',
        subject: 'Test',
        html: '<p>Test</p>',
        text: 'Test',
        replyTo: 'reply@example.com'
      });

      expect(result.success).toBe(true);
    });

    it('uses default replyTo from config when not provided', async () => {
      process.env.EMAIL_REPLY_TO = 'default-reply@example.com';
      const result = await sendEmail({
        to: 'user@example.com',
        subject: 'Test',
        html: '<p>Test</p>',
        text: 'Test'
      });

      expect(result.success).toBe(true);
    });
  });

  describe('Edge cases', () => {
    it('returns error for invalid recipient address', async () => {
      const result = await sendEmail({
        to: 'invalid-email',
        subject: 'Hi',
        html: '<p>Hello</p>',
        text: 'Hello'
      });
      expect(result.success).toBe(false);
      expect(result.error).toMatch(/invalid email address/i);
    });

    it('returns error when subject or text missing', async () => {
      const result = await sendEmail({
        to: 'user@example.com',
        subject: '',
        html: '',
        text: ''
      });
      expect(result.success).toBe(false);
      expect(result.error).toMatch(/subject and text content are required/i);
    });

    it('returns error when subject is missing', async () => {
      const result = await sendEmail({
        to: 'user@example.com',
        subject: '',
        html: '<p>Content</p>',
        text: 'Content'
      });
      expect(result.success).toBe(false);
      expect(result.error).toMatch(/subject and text content are required/i);
    });

    it('returns error when text is missing', async () => {
      const result = await sendEmail({
        to: 'user@example.com',
        subject: 'Test',
        html: '<p>Content</p>',
        text: ''
      });
      expect(result.success).toBe(false);
      expect(result.error).toMatch(/subject and text content are required/i);
    });

    it('handles unsupported provider gracefully', async () => {
      process.env.EMAIL_PROVIDER = 'unknown' as unknown as string;
      const result = await sendEmail({
        to: 'user@example.com',
        subject: 'Test',
        html: '<p>Hi</p>',
        text: 'Hi'
      });
      expect(result.success).toBe(false);
      expect(result.error).toMatch(/unsupported email provider/i);
    });

    it('sendBulkEmails returns mixed success/failure', async () => {
      const messages = [
        { to: 'good1@example.com', subject: 'A', html: '<p>a</p>', text: 'a' },
        { to: 'bad-email', subject: 'B', html: '<p>b</p>', text: 'b' },
        { to: 'good2@example.com', subject: 'C', html: '<p>c</p>', text: 'c' }
      ] as Array<{ to: string; subject: string; html: string; text: string }>;

      const results = await sendBulkEmails(messages, 2, 0);
      expect(results).toHaveLength(3);
      const successCount = results.filter(r => r.success).length;
      const failureCount = results.filter(r => !r.success).length;
      expect(successCount).toBe(2);
      expect(failureCount).toBe(1);
    });

    it('sendBulkEmails with custom batch size and delay', async () => {
      const messages = Array.from({ length: 5 }).map((_, idx) => ({
        to: `recipient${idx}@example.com`,
        subject: `Message ${idx}`,
        html: '<p>Body</p>',
        text: 'Body'
      }));

      const results = await sendBulkEmails(messages, 3, 50);
      expect(results).toHaveLength(5);
      expect(results.every(r => r.success)).toBe(true);
    });

    it('sendBulkEmails with empty array', async () => {
      const results = await sendBulkEmails([], 10, 100);
      expect(results).toHaveLength(0);
    });

    it('sendBulkEmails with single message', async () => {
      const messages = [{
        to: 'user@example.com',
        subject: 'Single',
        html: '<p>Single</p>',
        text: 'Single'
      }];

      const results = await sendBulkEmails(messages, 10, 100);
      expect(results).toHaveLength(1);
      expect(results[0]?.success).toBe(true);
    });

    it('sendBulkEmails with delay between batches', async () => {
      const messages = Array.from({ length: 4 }).map((_, idx) => ({
        to: `recipient${idx}@example.com`,
        subject: `Message ${idx}`,
        html: '<p>Body</p>',
        text: 'Body'
      }));

      const startTime = Date.now();
      const results = await sendBulkEmails(messages, 2, 100);
      const endTime = Date.now();
      
      expect(results).toHaveLength(4);
      expect(results.every(r => r.success)).toBe(true);
      // Should have at least one delay (100ms) between batches
      expect(endTime - startTime).toBeGreaterThanOrEqual(100);
    });

    it('sendBulkEmails with large batch size', async () => {
      const messages = Array.from({ length: 3 }).map((_, idx) => ({
        to: `recipient${idx}@example.com`,
        subject: `Message ${idx}`,
        html: '<p>Body</p>',
        text: 'Body'
      }));

      const results = await sendBulkEmails(messages, 10, 50);
      
      expect(results).toHaveLength(3);
      expect(results.every(r => r.success)).toBe(true);
    });

    it('sendBulkEmails with multiple batches and delay', async () => {
      const messages = Array.from({ length: 6 }).map((_, idx) => ({
        to: `recipient${idx}@example.com`,
        subject: `Message ${idx}`,
        html: '<p>Body</p>',
        text: 'Body'
      }));

      const startTime = Date.now();
      const results = await sendBulkEmails(messages, 2, 50);
      const endTime = Date.now();
      
      expect(results).toHaveLength(6);
      expect(results.every(r => r.success)).toBe(true);
      // Should have at least two delays (50ms each) between 3 batches
      expect(endTime - startTime).toBeGreaterThanOrEqual(100);
    });

    it('sendBulkEmails with exact batch size', async () => {
      const messages = Array.from({ length: 4 }).map((_, idx) => ({
        to: `recipient${idx}@example.com`,
        subject: `Message ${idx}`,
        html: '<p>Body</p>',
        text: 'Body'
      }));

      const results = await sendBulkEmails(messages, 4, 10);
      
      expect(results).toHaveLength(4);
      expect(results.every(r => r.success)).toBe(true);
    });
  });

  describe('Error paths', () => {
    it('returns error when subject or text missing', async () => {
      process.env.EMAIL_PROVIDER = 'sendgrid';
      const result = await sendEmail({
        to: 'user@example.com',
        subject: '',
        html: '',
        text: ''
      });
      expect(result.success).toBe(false);
      expect(result.error).toMatch(/subject and text content are required/i);
    });

    it('returns unsupported provider error', async () => {
      process.env.EMAIL_PROVIDER = 'unknown' as never;
      const result = await sendEmail({
        to: 'user@example.com',
        subject: 'Hello',
        html: '<p>hello</p>',
        text: 'hello'
      });
      expect(result.success).toBe(false);
      expect(result.error).toMatch(/unsupported email provider/i);
    });

    it('handles SendGrid error gracefully', async () => {
      // Mock the Resend service to throw an error
      const originalResend = require('resend').Resend;
      const mockResend = jest.fn().mockImplementation(() => ({
        emails: {
          send: jest.fn().mockRejectedValue(new Error('SendGrid API error'))
        }
      }));
      require('resend').Resend = mockResend;

      const result = await sendEmail({
        to: 'user@example.com',
        subject: 'Test',
        html: '<p>Test</p>',
        text: 'Test'
      });

      expect(result.success).toBe(false);
      expect(result.error).toMatch(/SendGrid API error/);
      expect(result.provider).toBe('resend');

      // Restore original Resend
      require('resend').Resend = originalResend;
    });

    it('handles SMTP error gracefully', async () => {
      process.env.EMAIL_PROVIDER = 'smtp';
      
      // Mock nodemailer to throw an error
      const originalCreateTransport = require('nodemailer').createTransport;
      const mockTransporter = {
        verify: jest.fn().mockRejectedValue(new Error('SMTP error')),
        sendMail: jest.fn(),
        close: jest.fn()
      };
      require('nodemailer').createTransport = jest.fn().mockReturnValue(mockTransporter);

      const result = await sendEmail({
        to: 'user@example.com',
        subject: 'Test',
        html: '<p>Test</p>',
        text: 'Test'
      });

      expect(result.success).toBe(false);
      expect(result.error).toMatch(/SMTP error/);
      expect(result.provider).toBe('smtp');

      // Restore original nodemailer
      require('nodemailer').createTransport = originalCreateTransport;
    });

    it('handles unknown error in sendEmail', async () => {
      // Mock Resend to throw a string error
      const originalResend = require('resend').Resend;
      require('resend').Resend = jest.fn().mockImplementation(() => ({
        emails: {
          send: jest.fn().mockRejectedValue('String error')
        }
      }));

      const result = await sendEmail({
        to: 'user@example.com',
        subject: 'Test',
        html: '<p>Test</p>',
        text: 'Test'
      });

      expect(result.success).toBe(false);
      expect(result.error).toBe('Unknown Resend error');

      // Restore original Resend
      require('resend').Resend = originalResend;
    });

    it('handles error in sendBulkEmails', async () => {
      // Mock Resend to throw error
      const originalResend = require('resend').Resend;
      require('resend').Resend = jest.fn().mockImplementation(() => ({
        emails: {
          send: jest.fn().mockRejectedValue(new Error('Bulk email error'))
        }
      }));

      const messages = [{
        to: 'user@example.com',
        subject: 'Test',
        html: '<p>Test</p>',
        text: 'Test'
      }];

      const results = await sendBulkEmails(messages, 1, 0);
      expect(results).toHaveLength(1);
      expect(results[0]?.success).toBe(false);
      expect(results[0]?.error).toMatch(/Bulk email error/);

      // Restore original Resend
      require('resend').Resend = originalResend;
    });

    it('handles error in getEmailServiceStatus when testEmailConfig throws', async () => {
      // Mock Resend to throw error
      const originalResend = require('resend').Resend;
      require('resend').Resend = jest.fn().mockImplementation(() => ({
        emails: {
          send: jest.fn().mockRejectedValue(new Error('Status check failed'))
        }
      }));

      const status = await getEmailServiceStatus();
      
      expect(status.provider).toBe('resend');
      expect(status.healthy).toBe(false);
      expect(status.lastTest).toBeInstanceOf(Date);
      expect(status.error).toBe('Status check failed');

      // Restore original Resend
      require('resend').Resend = originalResend;
    });

    it('handles non-Error object in getEmailServiceStatus', async () => {
      // Mock Resend to throw a string error
      const originalResend = require('resend').Resend;
      require('resend').Resend = jest.fn().mockImplementation(() => ({
        emails: {
          send: jest.fn().mockRejectedValue('String error in status check')
        }
      }));

      const status = await getEmailServiceStatus();
      
      expect(status.provider).toBe('resend');
      expect(status.healthy).toBe(false);
      expect(status.lastTest).toBeInstanceOf(Date);
      expect(status.error).toBe('Unknown Resend error');

      // Restore original Resend
      require('resend').Resend = originalResend;
    });

    it('handles specific error in getEmailServiceStatus', async () => {
      // Mock Resend to throw a specific error
      const originalResend = require('resend').Resend;
      require('resend').Resend = jest.fn().mockImplementation(() => ({
        emails: {
          send: jest.fn().mockRejectedValue(new Error('Specific status check error'))
        }
      }));

      const status = await getEmailServiceStatus();
      
      expect(status.provider).toBe('resend');
      expect(status.healthy).toBe(false);
      expect(status.lastTest).toBeInstanceOf(Date);
      expect(status.error).toBe('Specific status check error');

      // Restore original Resend
      require('resend').Resend = originalResend;
    });

    it('handles test email failure', async () => {
      // Mock Resend to throw error
      const originalResend = require('resend').Resend;
      require('resend').Resend = jest.fn().mockImplementation(() => ({
        emails: {
          send: jest.fn().mockRejectedValue(new Error('Test email failed'))
        }
      }));

      const result = await testEmailConfig();
      
      expect(result.success).toBe(false);
      expect(result.error).toMatch(/Test email failed/);

      // Restore original Resend
      require('resend').Resend = originalResend;
    });

    it('returns unhealthy status when test fails', async () => {
      // Mock Resend to throw error
      const originalResend = require('resend').Resend;
      require('resend').Resend = jest.fn().mockImplementation(() => ({
        emails: {
          send: jest.fn().mockRejectedValue(new Error('Service unavailable'))
        }
      }));

      const status = await getEmailServiceStatus();
      
      expect(status.provider).toBe('resend');
      expect(status.healthy).toBe(false);
      expect(status.lastTest).toBeInstanceOf(Date);
      expect(status.error).toMatch(/Service unavailable/);

      // Restore original Resend
      require('resend').Resend = originalResend;
    });

    it('handles unknown error in status check', async () => {
      // Mock Resend to throw a string error
      const originalResend = require('resend').Resend;
      require('resend').Resend = jest.fn().mockImplementation(() => ({
        emails: {
          send: jest.fn().mockRejectedValue('String error')
        }
      }));

      const status = await getEmailServiceStatus();
      
      expect(status.provider).toBe('resend');
      expect(status.healthy).toBe(false);
      expect(status.lastTest).toBeInstanceOf(Date);
      expect(status.error).toBe('Unknown Resend error');

      // Restore original Resend
      require('resend').Resend = originalResend;
    });
  });

  describe('Configuration and environment', () => {
    it('uses default configuration when env vars not set', async () => {
      delete process.env.EMAIL_PROVIDER;
      delete process.env.EMAIL_FROM;
      delete process.env.EMAIL_FROM_NAME;
      delete process.env.EMAIL_REGION;

      const result = await sendEmail({
        to: 'user@example.com',
        subject: 'Test',
        html: '<p>Test</p>',
        text: 'Test'
      });

      expect(result.success).toBe(true);
      expect(result.provider).toBe('resend');
    });
  });

  describe('testEmailConfig', () => {
    it('sends test email successfully', async () => {
      const result = await testEmailConfig();
      
      expect(result.success).toBe(true);
      expect(result.provider).toBe('resend');
      expect(result.messageId).toMatch(/^sg_/);
    });

    it('sends test email to configured from address', async () => {
      process.env.EMAIL_FROM = 'test@example.com';
      
      const result = await testEmailConfig();
      
      expect(result.success).toBe(true);
    });

    it('handles test email failure', async () => {
      // Mock Resend to throw error
      const originalResend = require('resend').Resend;
      require('resend').Resend = jest.fn().mockImplementation(() => ({
        emails: {
          send: jest.fn().mockRejectedValue(new Error('Test email failed'))
        }
      }));

      const result = await testEmailConfig();
      
      expect(result.success).toBe(false);
      expect(result.error).toMatch(/Test email failed/);

      // Restore original Resend
      require('resend').Resend = originalResend;
    });
  });

  describe('getEmailServiceStatus', () => {
    it('returns healthy status when test succeeds', async () => {
      const status = await getEmailServiceStatus();
      
      expect(status.provider).toBe('resend');
      expect(status.healthy).toBe(true);
      expect(status.lastTest).toBeInstanceOf(Date);
      expect(status.error).toBeUndefined();
    });

    it('returns unhealthy status when test fails', async () => {
      // Mock Resend to throw error
      const originalResend = require('resend').Resend;
      require('resend').Resend = jest.fn().mockImplementation(() => ({
        emails: {
          send: jest.fn().mockRejectedValue(new Error('Service unavailable'))
        }
      }));

      const status = await getEmailServiceStatus();
      
      expect(status.provider).toBe('resend');
      expect(status.healthy).toBe(false);
      expect(status.lastTest).toBeInstanceOf(Date);
      expect(status.error).toMatch(/Service unavailable/);

      // Restore original Resend
      require('resend').Resend = originalResend;
    });

    it('handles unknown error in status check', async () => {
      // Mock Resend to throw a string error
      const originalResend = require('resend').Resend;
      require('resend').Resend = jest.fn().mockImplementation(() => ({
        emails: {
          send: jest.fn().mockRejectedValue('String error')
        }
      }));

      const status = await getEmailServiceStatus();
      
      expect(status.provider).toBe('resend');
      expect(status.healthy).toBe(false);
      expect(status.lastTest).toBeInstanceOf(Date);
      expect(status.error).toBe('Unknown Resend error');

      // Restore original Resend
      require('resend').Resend = originalResend;
    });
  });

  describe('Email validation', () => {
    it('validates various email formats correctly', async () => {
      const validEmails = [
        'user@example.com',
        'user.name@example.com',
        'user+tag@example.com',
        'user@subdomain.example.com',
        'user@example.co.uk'
      ];

      for (const email of validEmails) {
        const result = await sendEmail({
          to: email,
          subject: 'Test',
          html: '<p>Test</p>',
          text: 'Test'
        });
        expect(result.success).toBe(true);
      }
    });

    it('rejects invalid email formats', async () => {
      const invalidEmails = [
        'not-an-email',
        '@example.com',
        'user@',
        'user.example.com',
        'user@.com',
        'user@example.',
        ''
      ];

      for (const email of invalidEmails) {
        const result = await sendEmail({
          to: email,
          subject: 'Test',
          html: '<p>Test</p>',
          text: 'Test'
        });
        expect(result.success).toBe(false);
        expect(result.error).toMatch(/invalid email address/i);
      }
    });
  });
});

describe('EmailTemplateService', () => {
  const ORIGINAL_ENV = process.env;
  let originalSendEmail: typeof import('../../../src/services/EmailService').sendEmail;

  beforeEach(() => {
    jest.resetModules();
    process.env = { ...ORIGINAL_ENV };
    process.env.EMAIL_PROVIDER = 'resend';
    process.env.RESEND_KEY = 'test_key';
    process.env.EMAIL_FROM = 'test@vale.com';
    process.env.EMAIL_FROM_NAME = 'Vale Test';
    // Mock sendEmail for EmailTemplateService tests only
    originalSendEmail = require('../../../src/services/EmailService').sendEmail;
    require('../../../src/services/EmailService').sendEmail = jest.fn().mockResolvedValue({
      success: true,
      messageId: 'sg_test-id',
      provider: 'resend'
    });
  });

  afterEach(() => {
    // Restore original sendEmail
    require('../../../src/services/EmailService').sendEmail = originalSendEmail;
  });

  afterEach(() => {
    process.env = ORIGINAL_ENV;
  });

  describe('sendBookingConfirmation', () => {
    it('should generate booking confirmation email', async () => {
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

      const result = await emailTemplateService.sendBookingConfirmation(bookingData);
      expect(result).toBe(true);
    });

    it('should include all required booking information', async () => {
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

      const result = await emailTemplateService.sendBookingConfirmation(bookingData);
      expect(result).toBe(true);
    });
  });

  describe('sendBookingReminder', () => {
    it('should send booking reminder email', async () => {
      const bookingData = {
        bookingId: 'booking-123',
        reference: 'REF123',
        locationName: 'Test Location',
        locationAddress: '123 Test St',
        startTime: '2024-01-15T10:00:00Z',
        endTime: '2024-01-15T12:00:00Z',
        duration: 2,
        totalAmount: 50,
        currency: 'USD',
        customerName: 'John Doe',
        customerEmail: 'john@example.com',
        status: 'confirmed'
      };

      const result = await emailTemplateService.sendBookingReminder(bookingData);
      expect(result).toBe(true);
    });
  });

  describe('sendPasswordReset', () => {
    it('should send password reset email', async () => {
      const resetData = {
        customerName: 'John Doe',
        customerEmail: 'john@example.com',
        resetLink: 'https://vale.com/reset?token=abc123',
        expiryTime: '2024-01-16T10:00:00Z',
        supportEmail: 'support@vale.com'
      };

      const result = await emailTemplateService.sendPasswordReset(resetData);
      expect(result).toBe(true);
    });
  });
});

describe('EmailQueueService', () => {
  let originalSendEmail: any;

  beforeEach(() => {
    emailQueueService.clear();
    
    // Mock sendEmail to throw error for queue tests, so emails stay in queue
    originalSendEmail = require('../../../src/services/EmailService').sendEmail;
    require('../../../src/services/EmailService').sendEmail = jest.fn().mockRejectedValue(new Error('Test error'));
  });

  afterEach(() => {
    // Restore original sendEmail
    require('../../../src/services/EmailService').sendEmail = originalSendEmail;
  });

  describe('enqueue', () => {
    it('should add email to queue', async () => {
      const email = {
        to: 'test@example.com',
        subject: 'Test',
        html: '<p>Test</p>',
        text: 'Test'
      };

      const id = emailQueueService.enqueue(email);
      expect(id).toBeDefined();
      expect(id).toMatch(/^email_\d+_[a-z0-9]+$/);
      
      // Wait a bit for processing to complete and email to be re-queued due to error
      await new Promise(resolve => setTimeout(resolve, 100));
      
      // Check queue length after processing
      const status = emailQueueService.getStatus();
      expect(status.queueLength).toBe(1);
    });

    it('should handle priority queuing', async () => {
      const normalEmail = {
        to: 'normal@example.com',
        subject: 'Normal',
        html: '<p>Normal</p>',
        text: 'Normal'
      };

      const highEmail = {
        to: 'high@example.com',
        subject: 'High',
        html: '<p>High</p>',
        text: 'High'
      };

      await emailQueueService.enqueue(normalEmail, { priority: 'normal' });
      await emailQueueService.enqueue(highEmail, { priority: 'high' });

      const status = emailQueueService.getStatus();
      expect(status.queueLength).toBe(2);
    });

    it('should handle scheduled emails', async () => {
      const scheduledEmail = {
        to: 'scheduled@example.com',
        subject: 'Scheduled',
        html: '<p>Scheduled</p>',
        text: 'Scheduled'
      };

      const tomorrow = new Date();
      tomorrow.setDate(tomorrow.getDate() + 1);

      const id = await emailQueueService.enqueue(scheduledEmail, {
        scheduledFor: tomorrow
      });

      expect(id).toBeDefined();
      
      const status = emailQueueService.getStatus();
      expect(status.queueLength).toBe(1);
    });
  });

  describe('getStatus', () => {
    it('should return queue status', () => {
      const status = emailQueueService.getStatus();
      
      expect(status).toHaveProperty('queueLength');
      expect(status).toHaveProperty('processing');
      expect(status).toHaveProperty('config');
      expect(status.config).toHaveProperty('rateLimitPerSecond');
      expect(status.config).toHaveProperty('maxRetries');
    });

    it('should show correct queue length', async () => {
      expect(emailQueueService.getStatus().queueLength).toBe(0);

      await emailQueueService.enqueue({
        to: 'test@example.com',
        subject: 'Test',
        html: '<p>Test</p>',
        text: 'Test'
      });

      expect(emailQueueService.getStatus().queueLength).toBe(1);
    });
  });

  describe('clear', () => {
    it('should clear the queue', async () => {
      await emailQueueService.enqueue({
        to: 'test@example.com',
        subject: 'Test',
        html: '<p>Test</p>',
        text: 'Test'
      });

      expect(emailQueueService.getStatus().queueLength).toBe(1);

      emailQueueService.clear();

      expect(emailQueueService.getStatus().queueLength).toBe(0);
    });
  });
}); 