import { afterEach, beforeEach, describe, expect, it } from '@jest/globals';

import { sendEmail, sendBulkEmails } from '../../../src/services/EmailService';

describe('EmailService edge cases', () => {
  const ORIGINAL_ENV = process.env;

  beforeEach(() => {
    process.env = { ...ORIGINAL_ENV };
    process.env.EMAIL_PROVIDER = 'sendgrid';
    process.env.EMAIL_FROM = 'noreply@example.com';
    process.env.EMAIL_FROM_NAME = 'Vale';
  });

  afterEach(() => {
    process.env = ORIGINAL_ENV;
  });

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