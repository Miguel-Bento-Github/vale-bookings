import { afterEach, beforeEach, describe, expect, it } from '@jest/globals';

import { sendEmail, sendBulkEmails } from '../../../src/services/EmailService';

describe('EmailService', () => {
  const ORIGINAL_ENV = process.env;

  beforeEach(() => {
    // Clone env so mutations do not leak between tests
    process.env = { ...ORIGINAL_ENV };
    process.env.EMAIL_PROVIDER = 'sendgrid';
    process.env.EMAIL_FROM = 'noreply@example.com';
    process.env.EMAIL_FROM_NAME = 'Example';
  });

  afterEach(() => {
    process.env = ORIGINAL_ENV;
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
  });
}); 