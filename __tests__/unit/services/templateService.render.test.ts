import { describe, it, expect } from '@jest/globals';

import {
  renderTemplate,
  previewTemplate,
  validateTemplate,
  getSupportedLanguages
} from '../../../src/services/TemplateService';

import type { TemplateData } from '../../../src/types/notification';

describe('TemplateService – extended rendering tests', () => {
  const fullData: TemplateData = {
    guestName: 'Bob Builder',
    referenceNumber: 'ABC12345',
    locationName: 'Downtown Garage',
    locationAddress: '1 Infinite Loop',
    bookingDate: '2099-12-31',
    bookingTime: '08:30',
    duration: 120,
    serviceName: 'Valet Plus',
    hoursUntil: 48
  };

  it('successfully renders a booking confirmation email', async () => {
    const result = await renderTemplate('booking_confirmation', 'email', fullData, 'en');
    expect(result.success).toBe(true);
    if (!result.success) throw new Error(result.error ?? 'Rendering failed');

    // Ensure key fields are substituted
    expect(result.subject).toContain(fullData.referenceNumber);
    expect(result.html).toContain(fullData.locationName);
    expect(result.text).toContain(fullData.bookingDate);
  });

  it('successfully renders a booking confirmation SMS', async () => {
    const result = await renderTemplate('booking_confirmation', 'sms', fullData, 'en');
    expect(result.success).toBe(true);
    if (!result.success) throw new Error(result.error ?? 'SMS render failed');
    expect(result.message).toContain(fullData.referenceNumber);
    // Length metadata should be present and accurate
    expect(result.length).toBe(result.message?.length);
  });

  it('previewTemplate returns a successful render', async () => {
    const preview = await previewTemplate('booking_confirmation', 'email', 'en');
    expect(preview.success).toBe(true);
    if (preview.success) {
      expect(preview.subject).toBeDefined();
      expect(preview.html).toBeDefined();
      expect(preview.text).toBeDefined();
    }
  });

  it('getSupportedLanguages returns expected array', () => {
    const langs = getSupportedLanguages('booking_confirmation', 'email');
    // Built-in templates currently support at least English
    expect(langs).toContain('en');
  });

  it('validateTemplate passes for a well-formed custom template', async () => {
    const customTemplate = {
      name: 'simple-test',
      subject: 'Hello {{guestName}}',
      text: 'Ref: {{referenceNumber}}',
      requiredVariables: ['guestName', 'referenceNumber']
    };

    const validation = await validateTemplate(customTemplate);
    expect(validation.valid).toBe(true);
    expect(validation.errors).toHaveLength(0);
  });
}); 