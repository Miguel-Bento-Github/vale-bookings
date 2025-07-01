import { afterEach, beforeEach, describe, expect, it, jest } from '@jest/globals';

import { sendEmail, sendBulkEmails, testEmailConfig, getEmailServiceStatus } from '../../../src/services/EmailService';

describe('EmailService', () => {
  const ORIGINAL_ENV = process.env;
  const ORIGINAL_SET_TIMEOUT = global.setTimeout;

  beforeEach(() => {
    // Clone env so mutations do not leak between tests
    process.env = { ...ORIGINAL_ENV };
    process.env.EMAIL_PROVIDER = 'sendgrid';
    process.env.EMAIL_FROM = 'noreply@example.com';
    process.env.EMAIL_FROM_NAME = 'Example';
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
      expect(result.provider).toBe('sendgrid');
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

    it('routes to SES provider', async () => {
      process.env.EMAIL_PROVIDER = 'ses';
      process.env.EMAIL_REGION = 'us-east-1';
      const result = await sendEmail({
        to: 'user@example.com',
        subject: 'Hi',
        html: '<p>hi</p>',
        text: 'hi'
      });
      expect(result.success).toBe(true);
      expect(result.provider).toBe('ses');
      expect(result.messageId).toMatch(/^ses_/);
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
      expect(results[0].success).toBe(true);
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
      // Mock setTimeout to throw error
      const originalSetTimeout = global.setTimeout;
      global.setTimeout = jest.fn().mockImplementation((_callback) => {
        throw new Error('SendGrid API error');
      }) as unknown as typeof setTimeout;

      const result = await sendEmail({
        to: 'user@example.com',
        subject: 'Test',
        html: '<p>Test</p>',
        text: 'Test'
      });

      expect(result.success).toBe(false);
      expect(result.error).toMatch(/SendGrid API error/);
      expect(result.provider).toBe('sendgrid');

      // Restore original setTimeout
      global.setTimeout = originalSetTimeout;
    });

    it('handles SES error gracefully', async () => {
      process.env.EMAIL_PROVIDER = 'ses';
      
      // Mock setTimeout to throw error
      const originalSetTimeout = global.setTimeout;
      global.setTimeout = jest.fn().mockImplementation((_callback) => {
        throw new Error('SES API error');
      }) as unknown as typeof setTimeout;

      const result = await sendEmail({
        to: 'user@example.com',
        subject: 'Test',
        html: '<p>Test</p>',
        text: 'Test'
      });

      expect(result.success).toBe(false);
      expect(result.error).toMatch(/SES API error/);
      expect(result.provider).toBe('ses');

      // Restore original setTimeout
      global.setTimeout = originalSetTimeout;
    });

    it('handles SMTP error gracefully', async () => {
      process.env.EMAIL_PROVIDER = 'smtp';
      
      // Mock setTimeout to throw error
      const originalSetTimeout = global.setTimeout;
      global.setTimeout = jest.fn().mockImplementation((_callback) => {
        throw new Error('SMTP error');
      }) as unknown as typeof setTimeout;

      const result = await sendEmail({
        to: 'user@example.com',
        subject: 'Test',
        html: '<p>Test</p>',
        text: 'Test'
      });

      expect(result.success).toBe(false);
      expect(result.error).toMatch(/SMTP error/);
      expect(result.provider).toBe('smtp');

      // Restore original setTimeout
      global.setTimeout = originalSetTimeout;
    });

    it('handles unknown error in sendEmail', async () => {
      // Mock getEmailConfig to throw error
      const originalEnv = process.env;
      process.env = { ...originalEnv, EMAIL_PROVIDER: 'sendgrid' };
      
      // Mock setTimeout to throw non-Error object
      const originalSetTimeout = global.setTimeout;
      global.setTimeout = jest.fn().mockImplementation((_callback) => {
        throw new Error('String error');
      }) as unknown as typeof setTimeout;

      const result = await sendEmail({
        to: 'user@example.com',
        subject: 'Test',
        html: '<p>Test</p>',
        text: 'Test'
      });

      expect(result.success).toBe(false);
      expect(result.error).toBe('Unknown SendGrid error');

      // Restore original setTimeout
      global.setTimeout = originalSetTimeout;
    });

    it('handles error in sendBulkEmails', async () => {
      // Mock sendEmail to throw error
      const originalSetTimeout = global.setTimeout;
      global.setTimeout = jest.fn().mockImplementation((_callback) => {
        throw new Error('Bulk email error');
      }) as unknown as typeof setTimeout;

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

      // Restore original setTimeout
      global.setTimeout = originalSetTimeout;
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
      expect(result.provider).toBe('sendgrid');
    });

    it('uses custom region for SES', async () => {
      process.env.EMAIL_PROVIDER = 'ses';
      process.env.EMAIL_REGION = 'eu-west-1';

      const result = await sendEmail({
        to: 'user@example.com',
        subject: 'Test',
        html: '<p>Test</p>',
        text: 'Test'
      });

      expect(result.success).toBe(true);
      expect(result.provider).toBe('ses');
    });
  });

  describe('testEmailConfig', () => {
    it('sends test email successfully', async () => {
      const result = await testEmailConfig();
      
      expect(result.success).toBe(true);
      expect(result.provider).toBe('sendgrid');
      expect(result.messageId).toMatch(/^sg_/);
    });

    it('sends test email to configured from address', async () => {
      process.env.EMAIL_FROM = 'test@example.com';
      
      const result = await testEmailConfig();
      
      expect(result.success).toBe(true);
    });

    it('handles test email failure', async () => {
      // Mock setTimeout to throw error
      const originalSetTimeout = global.setTimeout;
      global.setTimeout = jest.fn().mockImplementation((_callback) => {
        throw new Error('Test email failed');
      }) as unknown as typeof setTimeout;

      const result = await testEmailConfig();
      
      expect(result.success).toBe(false);
      expect(result.error).toMatch(/Test email failed/);

      // Restore original setTimeout
      global.setTimeout = originalSetTimeout;
    });
  });

  describe('getEmailServiceStatus', () => {
    it('returns healthy status when test succeeds', async () => {
      const status = await getEmailServiceStatus();
      
      expect(status.provider).toBe('sendgrid');
      expect(status.healthy).toBe(true);
      expect(status.lastTest).toBeInstanceOf(Date);
      expect(status.error).toBeUndefined();
    });

    it('returns unhealthy status when test fails', async () => {
      // Mock setTimeout to throw error
      const originalSetTimeout = global.setTimeout;
      global.setTimeout = jest.fn().mockImplementation((_callback) => {
        throw new Error('Service unavailable');
      }) as unknown as typeof setTimeout;

      const status = await getEmailServiceStatus();
      
      expect(status.provider).toBe('sendgrid');
      expect(status.healthy).toBe(false);
      expect(status.lastTest).toBeInstanceOf(Date);
      expect(status.error).toMatch(/Service unavailable/);

      // Restore original setTimeout
      global.setTimeout = originalSetTimeout;
    });

    it('handles unknown error in status check', async () => {
      // Mock setTimeout to throw non-Error object
      const originalSetTimeout = global.setTimeout;
      global.setTimeout = jest.fn().mockImplementation((_callback) => {
        throw new Error('String error');
      }) as unknown as typeof setTimeout;

      const status = await getEmailServiceStatus();
      
      expect(status.provider).toBe('sendgrid');
      expect(status.healthy).toBe(false);
      expect(status.lastTest).toBeInstanceOf(Date);
      expect(status.error).toBe('Unknown SendGrid error');

      // Restore original setTimeout
      global.setTimeout = originalSetTimeout;
    });

    it('returns correct provider in status', async () => {
      process.env.EMAIL_PROVIDER = 'ses';
      
      const status = await getEmailServiceStatus();
      
      expect(status.provider).toBe('ses');
      expect(status.healthy).toBe(true);
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