import { emailTemplateService } from '../../../src/services/EmailTemplateService';
import type { 
  BookingTemplateData, 
  WelcomeTemplateData, 
  PasswordResetTemplateData,
  AdminNotificationData,
  GDPRTemplateData 
} from '../../../src/services/EmailTemplateService';

// Mock EmailService
jest.mock('../../../src/services/EmailService', () => ({
  sendEmail: jest.fn()
}));

const mockSendEmail = require('../../../src/services/EmailService').sendEmail as jest.MockedFunction<typeof import('../../../src/services/EmailService').sendEmail>;

describe('EmailTemplateService', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockSendEmail.mockResolvedValue({ 
      success: true, 
      messageId: 'test-message-id' 
    });
  });

  describe('sendBookingConfirmation', () => {
    const bookingData: BookingTemplateData = {
      bookingId: 'booking-123',
      reference: 'REF123',
      locationName: 'Downtown Office',
      locationAddress: '123 Main St, City, State 12345',
      startTime: '2024-01-15T10:00:00Z',
      endTime: '2024-01-15T12:00:00Z',
      duration: 2,
      totalAmount: 50,
      currency: 'USD',
      customerName: 'John Doe',
      customerEmail: 'john@example.com',
      status: 'confirmed',
      cancellationPolicy: 'Free cancellation up to 24 hours before',
      instructions: 'Please arrive 10 minutes early'
    };

    it('should send booking confirmation email successfully', async () => {
      const result = await emailTemplateService.sendBookingConfirmation(bookingData);
      
      expect(result).toBe(true);
      expect(mockSendEmail).toHaveBeenCalledWith({
        to: 'john@example.com',
        subject: expect.stringContaining('Booking Confirmed'),
        html: expect.stringContaining('John Doe'),
        text: expect.stringContaining('John Doe')
      });
    });

    it('should handle email sending failure', async () => {
      mockSendEmail.mockResolvedValue({ 
        success: false, 
        error: 'Email service unavailable' 
      });

      const result = await emailTemplateService.sendBookingConfirmation(bookingData);
      
      expect(result).toBe(false);
    });

    it('should include all booking details in template', async () => {
      await emailTemplateService.sendBookingConfirmation(bookingData);
      
      const callArgs = mockSendEmail.mock.calls[0]?.[0];
      expect(callArgs).toBeDefined();
      expect(callArgs?.html).toContain('REF123');
      expect(callArgs?.html).toContain('Downtown Office');
      expect(callArgs?.html).toContain('123 Main St');
      expect(callArgs?.html).toContain('USD 50');
      expect(callArgs?.html).toContain('Free cancellation up to 24 hours before');
      expect(callArgs?.html).toContain('Please arrive 10 minutes early');
    });
  });

  describe('sendBookingReminder', () => {
    const bookingData: BookingTemplateData = {
      bookingId: 'booking-456',
      reference: 'REF456',
      locationName: 'Uptown Office',
      locationAddress: '456 Oak Ave, City, State 12345',
      startTime: '2024-01-16T14:00:00Z',
      endTime: '2024-01-16T16:00:00Z',
      duration: 2,
      totalAmount: 75,
      currency: 'USD',
      customerName: 'Jane Smith',
      customerEmail: 'jane@example.com',
      status: 'confirmed'
    };

    it('should send booking reminder email successfully', async () => {
      const result = await emailTemplateService.sendBookingReminder(bookingData);
      
      expect(result).toBe(true);
      expect(mockSendEmail).toHaveBeenCalledWith({
        to: 'jane@example.com',
        subject: expect.stringContaining('Reminder'),
        html: expect.stringContaining('Jane Smith'),
        text: expect.stringContaining('Jane Smith')
      });
    });

    it('should include reminder-specific content', async () => {
      await emailTemplateService.sendBookingReminder(bookingData);
      
      const callArgs = mockSendEmail.mock.calls[0]?.[0];
      expect(callArgs).toBeDefined();
      expect(callArgs?.html).toContain('reminder');
      expect(callArgs?.html).toContain('REF456');
      expect(callArgs?.html).toContain('Uptown Office');
    });
  });

  describe('sendBookingCancelled', () => {
    const bookingData: BookingTemplateData = {
      bookingId: 'booking-789',
      reference: 'REF789',
      locationName: 'Downtown Office',
      locationAddress: '123 Main St, City, State 12345',
      startTime: '2024-01-17T09:00:00Z',
      endTime: '2024-01-17T11:00:00Z',
      duration: 2,
      totalAmount: 60,
      currency: 'USD',
      customerName: 'Bob Wilson',
      customerEmail: 'bob@example.com',
      status: 'cancelled'
    };

    it('should send booking cancellation email successfully', async () => {
      const result = await emailTemplateService.sendBookingCancelled(bookingData);
      
      expect(result).toBe(true);
      expect(mockSendEmail).toHaveBeenCalledWith({
        to: 'bob@example.com',
        subject: expect.stringContaining('Cancelled'),
        html: expect.stringContaining('Bob Wilson'),
        text: expect.stringContaining('Bob Wilson')
      });
    });

    it('should include cancellation-specific content', async () => {
      await emailTemplateService.sendBookingCancelled(bookingData);
      
      const callArgs = mockSendEmail.mock.calls[0]?.[0];
      expect(callArgs).toBeDefined();
      expect(callArgs?.html).toContain('cancelled');
      expect(callArgs?.html).toContain('REF789');
    });
  });

  describe('sendBookingModified', () => {
    const bookingData: BookingTemplateData = {
      bookingId: 'booking-101',
      reference: 'REF101',
      locationName: 'Downtown Office',
      locationAddress: '123 Main St, City, State 12345',
      startTime: '2024-01-18T13:00:00Z',
      endTime: '2024-01-18T15:00:00Z',
      duration: 2,
      totalAmount: 80,
      currency: 'USD',
      customerName: 'Alice Johnson',
      customerEmail: 'alice@example.com',
      status: 'modified'
    };

    it('should send booking modification email successfully', async () => {
      const result = await emailTemplateService.sendBookingModified(bookingData);
      
      expect(result).toBe(true);
      expect(mockSendEmail).toHaveBeenCalledWith({
        to: 'alice@example.com',
        subject: expect.stringContaining('Modified'),
        html: expect.stringContaining('Alice Johnson'),
        text: expect.stringContaining('Alice Johnson')
      });
    });

    it('should include modification-specific content', async () => {
      await emailTemplateService.sendBookingModified(bookingData);
      
      const callArgs = mockSendEmail.mock.calls[0]?.[0];
      expect(callArgs).toBeDefined();
      expect(callArgs?.html).toContain('modified');
      expect(callArgs?.html).toContain('REF101');
    });
  });

  describe('sendWelcomeEmail', () => {
    const welcomeData: WelcomeTemplateData = {
      customerName: 'New User',
      customerEmail: 'newuser@example.com',
      activationLink: 'https://vale.com/activate?token=abc123',
      supportEmail: 'support@vale.com'
    };

    it('should send welcome email successfully', async () => {
      const result = await emailTemplateService.sendWelcomeEmail(welcomeData);
      
      expect(result).toBe(true);
      expect(mockSendEmail).toHaveBeenCalledWith({
        to: 'newuser@example.com',
        subject: expect.stringContaining('Welcome'),
        html: expect.stringContaining('New User'),
        text: expect.stringContaining('New User')
      });
    });

    it('should include welcome-specific content', async () => {
      await emailTemplateService.sendWelcomeEmail(welcomeData);
      
      const callArgs = mockSendEmail.mock.calls[0]?.[0];
      expect(callArgs).toBeDefined();
      expect(callArgs?.html).toContain('Welcome to Vale');
      expect(callArgs?.html).toContain('https://vale.com/activate?token=abc123');
      expect(callArgs?.html).toContain('support@vale.com');
    });

    it('should handle welcome email without activation link', async () => {
      const dataWithoutActivation = { ...welcomeData };
      delete dataWithoutActivation.activationLink;

      const result = await emailTemplateService.sendWelcomeEmail(dataWithoutActivation);
      
      expect(result).toBe(true);
    });
  });

  describe('sendPasswordReset', () => {
    const resetData: PasswordResetTemplateData = {
      customerName: 'John Doe',
      customerEmail: 'john@example.com',
      resetLink: 'https://vale.com/reset?token=xyz789',
      expiryTime: '2024-01-16T10:00:00Z',
      supportEmail: 'support@vale.com'
    };

    it('should send password reset email successfully', async () => {
      const result = await emailTemplateService.sendPasswordReset(resetData);
      
      expect(result).toBe(true);
      expect(mockSendEmail).toHaveBeenCalledWith({
        to: 'john@example.com',
        subject: expect.stringContaining('Password Reset'),
        html: expect.stringContaining('John Doe'),
        text: expect.stringContaining('John Doe')
      });
    });

    it('should include reset-specific content', async () => {
      await emailTemplateService.sendPasswordReset(resetData);
      
      const callArgs = mockSendEmail.mock.calls[0]?.[0];
      expect(callArgs).toBeDefined();
      expect(callArgs?.html).toContain('Password Reset');
      expect(callArgs?.html).toContain('https://vale.com/reset?token=xyz789');
      expect(callArgs?.html).toContain('2024-01-16T10:00:00Z');
    });
  });

  describe('sendAdminNotification', () => {
    const adminData: AdminNotificationData = {
      bookingId: 'booking-202',
      customerName: 'Admin Test',
      locationName: 'Test Location',
      startTime: '2024-01-19T10:00:00Z',
      totalAmount: 100,
      currency: 'USD',
      adminEmail: 'admin@vale.com'
    };

    it('should send admin notification email successfully', async () => {
      const result = await emailTemplateService.sendAdminNotification(adminData);
      
      expect(result).toBe(true);
      expect(mockSendEmail).toHaveBeenCalledWith({
        to: 'admin@vale.com',
        subject: expect.stringContaining('New Booking'),
        html: expect.stringContaining('Admin Test'),
        text: expect.stringContaining('Admin Test')
      });
    });

    it('should include admin notification content', async () => {
      await emailTemplateService.sendAdminNotification(adminData);
      
      const callArgs = mockSendEmail.mock.calls[0]?.[0];
      expect(callArgs).toBeDefined();
      expect(callArgs?.html).toContain('New Booking Notification');
      expect(callArgs?.html).toContain('booking-202');
      expect(callArgs?.html).toContain('Test Location');
      expect(callArgs?.html).toContain('USD 100');
    });
  });

  describe('sendGDPREmail', () => {
    it('should send GDPR export email successfully', async () => {
      const gdprData: GDPRTemplateData = {
        customerName: 'GDPR User',
        customerEmail: 'gdpr@example.com',
        requestType: 'export',
        requestDate: '2024-01-15T10:00:00Z',
        completionDate: '2024-01-16T10:00:00Z',
        downloadLink: 'https://vale.com/download?token=gdpr123'
      };

      const result = await emailTemplateService.sendGDPREmail(gdprData);
      
      expect(result).toBe(true);
      expect(mockSendEmail).toHaveBeenCalledWith({
        to: 'gdpr@example.com',
        subject: expect.stringContaining('GDPR'),
        html: expect.stringContaining('GDPR User'),
        text: expect.stringContaining('GDPR User')
      });
    });

    it('should send GDPR deletion email successfully', async () => {
      const gdprData: GDPRTemplateData = {
        customerName: 'Delete User',
        customerEmail: 'delete@example.com',
        requestType: 'deletion',
        requestDate: '2024-01-15T10:00:00Z',
        completionDate: '2024-01-16T10:00:00Z'
      };

      const result = await emailTemplateService.sendGDPREmail(gdprData);
      
      expect(result).toBe(true);
      expect(mockSendEmail).toHaveBeenCalledWith({
        to: 'delete@example.com',
        subject: expect.stringContaining('GDPR'),
        html: expect.stringContaining('Delete User'),
        text: expect.stringContaining('Delete User')
      });
    });

    it('should include GDPR-specific content for export', async () => {
      const gdprData: GDPRTemplateData = {
        customerName: 'GDPR User',
        customerEmail: 'gdpr@example.com',
        requestType: 'export',
        requestDate: '2024-01-15T10:00:00Z',
        completionDate: '2024-01-16T10:00:00Z',
        downloadLink: 'https://vale.com/download?token=gdpr123'
      };

      await emailTemplateService.sendGDPREmail(gdprData);
      
      const callArgs = mockSendEmail.mock.calls[0]?.[0];
      expect(callArgs).toBeDefined();
      expect(callArgs?.html).toContain('export');
      expect(callArgs?.html).toContain('https://vale.com/download?token=gdpr123');
    });

    it('should include GDPR-specific content for deletion', async () => {
      const gdprData: GDPRTemplateData = {
        customerName: 'Delete User',
        customerEmail: 'delete@example.com',
        requestType: 'deletion',
        requestDate: '2024-01-15T10:00:00Z',
        completionDate: '2024-01-16T10:00:00Z'
      };

      await emailTemplateService.sendGDPREmail(gdprData);
      
      const callArgs = mockSendEmail.mock.calls[0]?.[0];
      expect(callArgs).toBeDefined();
      expect(callArgs?.html).toContain('deletion');
      expect(callArgs?.html).not.toContain('download');
    });

    it('should handle GDPR email without completion date', async () => {
      const gdprData: GDPRTemplateData = {
        customerName: 'GDPR User',
        customerEmail: 'gdpr@example.com',
        requestType: 'export',
        requestDate: '2024-01-15T10:00:00Z'
      };

      const result = await emailTemplateService.sendGDPREmail(gdprData);
      
      expect(result).toBe(true);
    });
  });

  describe('error handling', () => {
    it('should handle sendEmail throwing an error', async () => {
      mockSendEmail.mockRejectedValue(new Error('Network error'));

      const bookingData: BookingTemplateData = {
        bookingId: 'booking-123',
        reference: 'REF123',
        locationName: 'Test Location',
        locationAddress: '123 Test St',
        startTime: '2024-01-15T10:00:00Z',
        endTime: '2024-01-15T12:00:00Z',
        duration: 2,
        totalAmount: 50,
        currency: 'USD',
        customerName: 'John Doe',
        customerEmail: 'john@example.com',
        status: 'confirmed'
      };

      await expect(emailTemplateService.sendBookingConfirmation(bookingData))
        .rejects.toThrow('Network error');
    });
  });

  describe('singleton pattern', () => {
    it('should return the same instance', () => {
      const instance1 = emailTemplateService;
      const instance2 = emailTemplateService;
      
      expect(instance1).toBe(instance2);
    });
  });
}); 