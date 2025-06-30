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