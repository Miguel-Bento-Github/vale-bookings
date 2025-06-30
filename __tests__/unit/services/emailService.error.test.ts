import { describe, expect, it, beforeEach, afterEach } from '@jest/globals';
import { sendEmail } from '../../../src/services/EmailService';

describe('EmailService error paths', () => {
  const ORIGINAL_ENV = process.env;

  beforeEach(() => {
    process.env = { ...ORIGINAL_ENV };
    process.env.EMAIL_FROM = 'noreply@example.com';
    process.env.EMAIL_FROM_NAME = 'Vale';
  });

  afterEach(() => {
    process.env = ORIGINAL_ENV;
  });

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