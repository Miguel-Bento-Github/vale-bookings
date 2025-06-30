import { afterEach, beforeEach, describe, expect, it } from '@jest/globals';

import { sendSMS, sendBulkSMS } from '../../../src/services/SMSService';

describe('SMSService', () => {
  const ORIGINAL_ENV = process.env;

  beforeEach(() => {
    process.env = { ...ORIGINAL_ENV };
    process.env.SMS_PROVIDER = 'twilio';
    process.env.SMS_FROM_NUMBER = '+15555550000';
  });

  afterEach(() => {
    process.env = ORIGINAL_ENV;
  });

  it('returns error for invalid phone number', async () => {
    const result = await sendSMS({
      to: '12345',
      message: 'Hi'
    });

    expect(result.success).toBe(false);
    expect(result.error).toMatch(/invalid phone number/i);
  });

  it('sends SMS successfully via Twilio mock', async () => {
    const result = await sendSMS({
      to: '+15555551234',
      message: 'Hello there'
    });

    expect(result.success).toBe(true);
    expect(result.provider).toBe('twilio');
    expect(result.messageId).toMatch(/^tw_/);
    expect(result.segments).toBeGreaterThanOrEqual(1);
  });

  it('sends bulk SMS successfully', async () => {
    const messages = [
      { to: '+15555551111', message: 'Msg1' },
      { to: '+15555552222', message: 'Msg2' },
      { to: '+15555553333', message: 'Msg3' }
    ];

    const results = await sendBulkSMS(messages, 2, 10);

    expect(results).toHaveLength(3);
    expect(results.every(r => r.success)).toBe(true);
  });
}); 