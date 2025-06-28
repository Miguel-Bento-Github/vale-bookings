import {
  GDPRConsent,
  AuditTrailEntry,
  WidgetConfig,
  DataExportFormat,
  RateLimitConfig
} from '../../../src/types/widget';

describe('Widget Types', () => {
  describe('GDPRConsent', () => {
    it('should have correct structure for GDPR consent', () => {
      const consent: GDPRConsent = {
        version: '1.0',
        acceptedAt: new Date(),
        ipAddress: '192.168.1.1',
        userAgent: 'Mozilla/5.0'
      };

      expect(consent.version).toBe('1.0');
      expect(consent.acceptedAt).toBeInstanceOf(Date);
      expect(consent.ipAddress).toBe('192.168.1.1');
      expect(consent.userAgent).toBe('Mozilla/5.0');
    });

    it('should allow optional userAgent', () => {
      const consent: GDPRConsent = {
        version: '1.0',
        acceptedAt: new Date(),
        ipAddress: '192.168.1.1'
      };

      expect(consent.userAgent).toBeUndefined();
    });
  });

  describe('AuditTrailEntry', () => {
    it('should have correct structure for audit entries', () => {
      const entry: AuditTrailEntry = {
        action: 'status_change',
        timestamp: new Date(),
        userId: 'user123',
        ipAddress: '192.168.1.1',
        previousValue: 'pending',
        newValue: 'confirmed',
        metadata: { reason: 'approved', channel: 'email' }
      };

      expect(entry.action).toBe('status_change');
      expect(entry.timestamp).toBeInstanceOf(Date);
      expect(entry.userId).toBe('user123');
      expect(entry.ipAddress).toBe('192.168.1.1');
      expect(entry.previousValue).toBe('pending');
      expect(entry.newValue).toBe('confirmed');
      expect(entry.metadata).toEqual({ reason: 'approved', channel: 'email' });
    });

    it('should allow all optional fields to be undefined', () => {
      const entry: AuditTrailEntry = {
        action: 'create',
        timestamp: new Date()
      };

      expect(entry.userId).toBeUndefined();
      expect(entry.ipAddress).toBeUndefined();
      expect(entry.previousValue).toBeUndefined();
      expect(entry.newValue).toBeUndefined();
      expect(entry.metadata).toBeUndefined();
    });

    it('should accept proper value types for previousValue and newValue', () => {
      const stringEntry: AuditTrailEntry = {
        action: 'update',
        timestamp: new Date(),
        previousValue: 'old_value',
        newValue: 'new_value'
      };

      const numberEntry: AuditTrailEntry = {
        action: 'update',
        timestamp: new Date(),
        previousValue: 100,
        newValue: 200
      };

      const booleanEntry: AuditTrailEntry = {
        action: 'update',
        timestamp: new Date(),
        previousValue: false,
        newValue: true
      };

      const nullEntry: AuditTrailEntry = {
        action: 'update',
        timestamp: new Date(),
        previousValue: null,
        newValue: null
      };

      expect(stringEntry.previousValue).toBe('old_value');
      expect(numberEntry.previousValue).toBe(100);
      expect(booleanEntry.previousValue).toBe(false);
      expect(nullEntry.previousValue).toBeNull();
    });
  });

  describe('RateLimitConfig', () => {
    it('should have correct structure for rate limiting', () => {
      const config: RateLimitConfig = {
        windowMs: 60000,
        maxRequests: 100,
        message: 'Rate limit exceeded'
      };

      expect(config.windowMs).toBe(60000);
      expect(config.maxRequests).toBe(100);
      expect(config.message).toBe('Rate limit exceeded');
    });

    it('should allow optional message', () => {
      const config: RateLimitConfig = {
        windowMs: 60000,
        maxRequests: 100
      };

      expect(config.message).toBeUndefined();
    });
  });

  describe('WidgetConfig', () => {
    it('should have correct structure for widget configuration', () => {
      const config: WidgetConfig = {
        apiKey: 'test-key',
        theme: {
          primaryColor: '#007bff',
          secondaryColor: '#6c757d',
          fontFamily: 'Arial',
          borderRadius: '4px'
        },
        features: {
          guestCheckout: true,
          requirePhone: false,
          enableSMS: true,
          enableReminders: true,
          showMap: false
        },
        localization: {
          defaultLanguage: 'en',
          supportedLanguages: ['en', 'es', 'fr'],
          timeFormat: '12h',
          dateFormat: 'MM/DD/YYYY'
        }
      };

      expect(config.apiKey).toBe('test-key');
      expect(config.theme?.primaryColor).toBe('#007bff');
      expect(config.features?.guestCheckout).toBe(true);
      expect(config.localization?.defaultLanguage).toBe('en');
    });

    it('should allow all optional configuration sections', () => {
      const minimalConfig: WidgetConfig = {
        apiKey: 'test-key'
      };

      expect(minimalConfig.theme).toBeUndefined();
      expect(minimalConfig.features).toBeUndefined();
      expect(minimalConfig.localization).toBeUndefined();
    });
  });

  describe('DataExportFormat', () => {
    it('should have correct structure for data export', () => {
      const exportFormat: DataExportFormat = {
        format: 'json',
        includeMetadata: true,
        anonymize: false
      };

      expect(exportFormat.format).toBe('json');
      expect(exportFormat.includeMetadata).toBe(true);
      expect(exportFormat.anonymize).toBe(false);
    });

    it('should accept all valid format types', () => {
      const jsonFormat: DataExportFormat = {
        format: 'json',
        includeMetadata: true,
        anonymize: false
      };

      const csvFormat: DataExportFormat = {
        format: 'csv',
        includeMetadata: true,
        anonymize: false
      };

      const pdfFormat: DataExportFormat = {
        format: 'pdf',
        includeMetadata: true,
        anonymize: false
      };

      expect(jsonFormat.format).toBe('json');
      expect(csvFormat.format).toBe('csv');
      expect(pdfFormat.format).toBe('pdf');
    });
  });

  describe('Type Safety', () => {
    it('should prevent any types in AuditTrailEntry metadata', () => {
      // This test ensures that metadata only accepts specific types
      const validMetadata: Record<string, string | number | boolean> = {
        reason: 'approved',
        count: 5,
        active: true
      };

      const entry: AuditTrailEntry = {
        action: 'update',
        timestamp: new Date(),
        metadata: validMetadata
      };

      expect(typeof entry.metadata?.reason).toBe('string');
      expect(typeof entry.metadata?.count).toBe('number');
      expect(typeof entry.metadata?.active).toBe('boolean');
    });

    it('should handle null values in previousValue and newValue', () => {
      const entry: AuditTrailEntry = {
        action: 'clear',
        timestamp: new Date(),
        previousValue: 'some_value',
        newValue: null
      };

      expect(entry.previousValue).toBe('some_value');
      expect(entry.newValue).toBeNull();
    });
  });
}); 