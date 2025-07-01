import { describe, it, expect } from '@jest/globals';

import {
  renderTemplate,
  validateTemplate,
  getSupportedLanguages,
  previewTemplate
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

  describe('Basic functionality', () => {
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

  describe('Extended rendering', () => {
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
}); 