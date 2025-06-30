import { describe, it, expect } from '@jest/globals';

import {
  renderTemplate,
  validateTemplate,
  getSupportedLanguages
} from '../../../src/services/TemplateService';

import type { TemplateData } from '../../../src/types/notification';

describe('TemplateService', () => {
  const baseData: TemplateData = {
    guestName: 'Alice',
    referenceNumber: 'REF123',
    locationName: 'Central',
    bookingDate: '2099-01-01',
    bookingTime: '10:00'
  };

  it('returns error for unknown template type', async () => {
    const result = await renderTemplate('nonexistent', 'email', baseData, 'en');
    expect(result.success).toBe(false);
    expect(result.error).toMatch(/not found/i);
  });

  it('fails when required variables are missing', async () => {
    const badData = { ...baseData, guestName: '' };
    const result = await renderTemplate('booking_confirmation', 'sms', badData, 'en');
    expect(result.success).toBe(false);
  });

  it('validateTemplate catches syntax errors', async () => {
    const template = {
      name: 'bad-template',
      subject: 'Hi {{name', // unclosed variable
      text: 'Hello'
    };

    const validation = await validateTemplate(template);
    expect(validation.valid).toBe(false);
    expect(validation.errors.some(err => /unclosed variable/i.test(err))).toBe(true);
  });

  it('returns empty languages for unknown template', () => {
    const langs = getSupportedLanguages('unknown', 'email');
    expect(langs).toEqual([]);
  });
}); 