import { sendEmail, type EmailMessage } from './EmailService';

// Email template types
export type EmailTemplateType = 
  | 'booking_confirmation'
  | 'booking_reminder'
  | 'booking_cancelled'
  | 'booking_modified'
  | 'welcome'
  | 'password_reset'
  | 'admin_notification'
  | 'gdpr_export'
  | 'gdpr_deletion';

// Template data interfaces
export interface BookingTemplateData {
  bookingId: string;
  reference: string;
  locationName: string;
  locationAddress: string;
  startTime: string;
  endTime: string;
  duration: number;
  totalAmount: number;
  currency: string;
  customerName: string;
  customerEmail: string;
  status: string;
  cancellationPolicy?: string;
  instructions?: string;
}

export interface WelcomeTemplateData {
  customerName: string;
  customerEmail: string;
  activationLink?: string;
  supportEmail: string;
}

export interface PasswordResetTemplateData {
  customerName: string;
  customerEmail: string;
  resetLink: string;
  expiryTime: string;
  supportEmail: string;
}

export interface AdminNotificationData {
  bookingId: string;
  customerName: string;
  locationName: string;
  startTime: string;
  totalAmount: number;
  currency: string;
  adminEmail: string;
}

export interface GDPRTemplateData {
  customerName: string;
  customerEmail: string;
  requestType: 'export' | 'deletion';
  requestDate: string;
  completionDate?: string;
  downloadLink?: string;
}

// Email template service class
export class EmailTemplateService {
  private static instance: EmailTemplateService;

  public static getInstance(): EmailTemplateService {
    EmailTemplateService.instance ??= new EmailTemplateService();
    return EmailTemplateService.instance;
  }

  /**
   * Send booking confirmation email
   */
  async sendBookingConfirmation(data: BookingTemplateData): Promise<boolean> {
    const { html, text, subject } = this.generateBookingConfirmationTemplate(data);
    
    const emailMessage: EmailMessage = {
      to: data.customerEmail,
      subject,
      html,
      text
    };

    const result = await sendEmail(emailMessage);
    return result.success;
  }

  /**
   * Send booking reminder email
   */
  async sendBookingReminder(data: BookingTemplateData): Promise<boolean> {
    const { html, text, subject } = this.generateBookingReminderTemplate(data);
    
    const emailMessage: EmailMessage = {
      to: data.customerEmail,
      subject,
      html,
      text
    };

    const result = await sendEmail(emailMessage);
    return result.success;
  }

  /**
   * Send booking cancellation email
   */
  async sendBookingCancelled(data: BookingTemplateData): Promise<boolean> {
    const { html, text, subject } = this.generateBookingCancelledTemplate(data);
    
    const emailMessage: EmailMessage = {
      to: data.customerEmail,
      subject,
      html,
      text
    };

    const result = await sendEmail(emailMessage);
    return result.success;
  }

  /**
   * Send booking modification email
   */
  async sendBookingModified(data: BookingTemplateData): Promise<boolean> {
    const { html, text, subject } = this.generateBookingModifiedTemplate(data);
    
    const emailMessage: EmailMessage = {
      to: data.customerEmail,
      subject,
      html,
      text
    };

    const result = await sendEmail(emailMessage);
    return result.success;
  }

  /**
   * Send welcome email
   */
  async sendWelcomeEmail(data: WelcomeTemplateData): Promise<boolean> {
    const { html, text, subject } = this.generateWelcomeTemplate(data);
    
    const emailMessage: EmailMessage = {
      to: data.customerEmail,
      subject,
      html,
      text
    };

    const result = await sendEmail(emailMessage);
    return result.success;
  }

  /**
   * Send password reset email
   */
  async sendPasswordReset(data: PasswordResetTemplateData): Promise<boolean> {
    const { html, text, subject } = this.generatePasswordResetTemplate(data);
    
    const emailMessage: EmailMessage = {
      to: data.customerEmail,
      subject,
      html,
      text
    };

    const result = await sendEmail(emailMessage);
    return result.success;
  }

  /**
   * Send admin notification email
   */
  async sendAdminNotification(data: AdminNotificationData): Promise<boolean> {
    const { html, text, subject } = this.generateAdminNotificationTemplate(data);
    
    const emailMessage: EmailMessage = {
      to: data.adminEmail,
      subject,
      html,
      text
    };

    const result = await sendEmail(emailMessage);
    return result.success;
  }

  /**
   * Send GDPR-related email
   */
  async sendGDPREmail(data: GDPRTemplateData): Promise<boolean> {
    const { html, text, subject } = this.generateGDPRTemplate(data);
    
    const emailMessage: EmailMessage = {
      to: data.customerEmail,
      subject,
      html,
      text
    };

    const result = await sendEmail(emailMessage);
    return result.success;
  }

  // Template generation methods
  private generateBookingConfirmationTemplate(
    data: BookingTemplateData
  ): { html: string; text: string; subject: string } {
    const subject = `Booking Confirmed - ${data.locationName}`;

    const instructionsHtml = data.instructions != null
      ? `<div class="booking-details">
          <h3>Important Instructions</h3>
          <p>${data.instructions}</p>
        </div>`
      : '';
    const cancellationHtml = data.cancellationPolicy != null
      ? `<div class="booking-details">
          <h3>Cancellation Policy</h3>
          <p>${data.cancellationPolicy}</p>
        </div>`
      : '';

    const instructionsText = data.instructions != null
      ? `Important Instructions:\n${data.instructions}\n\n`
      : '';
    const cancellationText = data.cancellationPolicy != null
      ? `Cancellation Policy:\n${data.cancellationPolicy}\n\n`
      : '';

    const html = `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Booking Confirmed</title>
        <style>
          body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
          .container { max-width: 600px; margin: 0 auto; padding: 20px; }
          .header { background: #4CAF50; color: white; padding: 20px; text-align: center; }
          .content { padding: 20px; background: #f9f9f9; }
          .booking-details { background: white; padding: 20px; margin: 20px 0; border-radius: 5px; }
          .button { display: inline-block; padding: 10px 20px; background: #4CAF50; color: white; text-decoration: none; border-radius: 5px; }
          .footer { text-align: center; padding: 20px; color: #666; font-size: 12px; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1>✅ Booking Confirmed</h1>
          </div>
          <div class="content">
            <p>Dear ${data.customerName},</p>
            <p>Your booking has been successfully confirmed! Here are the details:</p>
            <div class="booking-details">
              <h3>Booking Information</h3>
              <p><strong>Reference:</strong> ${data.reference}</p>
              <p><strong>Location:</strong> ${data.locationName}</p>
              <p><strong>Address:</strong> ${data.locationAddress}</p>
              <p><strong>Date & Time:</strong> ${new Date(data.startTime).toLocaleString()}</p>
              <p><strong>Duration:</strong> ${data.duration} hours</p>
              <p><strong>Total Amount:</strong> ${data.currency} ${data.totalAmount}</p>
              <p><strong>Status:</strong> ${data.status}</p>
            </div>
            ${instructionsHtml}
            ${cancellationHtml}
            <p>If you have any questions, please don't hesitate to contact us.</p>
            <p>Best regards,<br>The Vale Team</p>
          </div>
          <div class="footer">
            <p>This email was sent to ${data.customerEmail}</p>
            <p>© 2024 Vale Booking System. All rights reserved.</p>
          </div>
        </div>
      </body>
      </html>
    `;

    const text = `
Booking Confirmed - ${data.locationName}

Dear ${data.customerName},

Your booking has been successfully confirmed! Here are the details:

Booking Information:
- Reference: ${data.reference}
- Location: ${data.locationName}
- Address: ${data.locationAddress}
- Date & Time: ${new Date(data.startTime).toLocaleString()}
- Duration: ${data.duration} hours
- Total Amount: ${data.currency} ${data.totalAmount}
- Status: ${data.status}

${instructionsText}${cancellationText}If you have any questions, please don't hesitate to contact us.

Best regards,
The Vale Team

This email was sent to ${data.customerEmail}
© 2024 Vale Booking System. All rights reserved.
    `;

    return { html, text, subject };
  }

  private generateBookingReminderTemplate(data: BookingTemplateData): { html: string; text: string; subject: string } {
    const subject = `Reminder: Your booking at ${data.locationName} is tomorrow`;
    
    const html = `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Booking Reminder</title>
        <style>
          body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
          .container { max-width: 600px; margin: 0 auto; padding: 20px; }
          .header { background: #FF9800; color: white; padding: 20px; text-align: center; }
          .content { padding: 20px; background: #f9f9f9; }
          .booking-details { background: white; padding: 20px; margin: 20px 0; border-radius: 5px; }
          .reminder { background: #FFF3E0; padding: 15px; border-left: 4px solid #FF9800; margin: 20px 0; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1>⏰ Booking Reminder</h1>
          </div>
          <div class="content">
            <p>Dear ${data.customerName},</p>
            <p>This is a friendly reminder about your upcoming booking tomorrow:</p>
            
            <div class="booking-details">
              <h3>Booking Details</h3>
              <p><strong>Reference:</strong> ${data.reference}</p>
              <p><strong>Location:</strong> ${data.locationName}</p>
              <p><strong>Address:</strong> ${data.locationAddress}</p>
              <p><strong>Date & Time:</strong> ${new Date(data.startTime).toLocaleString()}</p>
              <p><strong>Duration:</strong> ${data.duration} hours</p>
            </div>

            <div class="reminder">
              <h3>📋 What to bring:</h3>
              <ul>
                <li>Valid ID</li>
                <li>Booking reference number</li>
                <li>Any required documents</li>
              </ul>
            </div>

            <p>We look forward to seeing you!</p>
            
            <p>Best regards,<br>The Vale Team</p>
          </div>
        </div>
      </body>
      </html>
    `;

    const text = `
Reminder: Your booking at ${data.locationName} is tomorrow

Dear ${data.customerName},

This is a friendly reminder about your upcoming booking tomorrow:

Booking Details:
- Reference: ${data.reference}
- Location: ${data.locationName}
- Address: ${data.locationAddress}
- Date & Time: ${new Date(data.startTime).toLocaleString()}
- Duration: ${data.duration} hours

What to bring:
- Valid ID
- Booking reference number
- Any required documents

We look forward to seeing you!

Best regards,
The Vale Team
    `;

    return { html, text, subject };
  }

  private generateBookingCancelledTemplate(data: BookingTemplateData): { html: string; text: string; subject: string } {
    const subject = `Booking Cancelled - ${data.locationName}`;
    
    const instructionsHtml = data.instructions != null
      ? `<div class="booking-details">
          <h3>Important Instructions</h3>
          <p>${data.instructions}</p>
        </div>`
      : '';
    const cancellationHtml = data.cancellationPolicy != null
      ? `<div class="booking-details">
          <h3>Cancellation Policy</h3>
          <p>${data.cancellationPolicy}</p>
        </div>`
      : '';

    const instructionsText = data.instructions != null
      ? `Important Instructions:\n${data.instructions}\n\n`
      : '';
    const cancellationText = data.cancellationPolicy != null
      ? `Cancellation Policy:\n${data.cancellationPolicy}\n\n`
      : '';

    const html = `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Booking Cancelled</title>
        <style>
          body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
          .container { max-width: 600px; margin: 0 auto; padding: 20px; }
          .header { background: #f44336; color: white; padding: 20px; text-align: center; }
          .content { padding: 20px; background: #f9f9f9; }
          .booking-details { background: white; padding: 20px; margin: 20px 0; border-radius: 5px; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1>❌ Booking Cancelled</h1>
          </div>
          <div class="content">
            <p>Dear ${data.customerName},</p>
            <p>Your booking has been cancelled. Here are the details:</p>
            
            <div class="booking-details">
              <h3>Cancelled Booking</h3>
              <p><strong>Reference:</strong> ${data.reference}</p>
              <p><strong>Location:</strong> ${data.locationName}</p>
              <p><strong>Date & Time:</strong> ${new Date(data.startTime).toLocaleString()}</p>
              <p><strong>Amount:</strong> ${data.currency} ${data.totalAmount}</p>
            </div>

            ${instructionsHtml}
            ${cancellationHtml}

            <p>If you have any questions about this cancellation, please contact us.</p>
            
            <p>Best regards,<br>The Vale Team</p>
          </div>
        </div>
      </body>
      </html>
    `;

    const text = `
Booking Cancelled - ${data.locationName}

Dear ${data.customerName},

Your booking has been cancelled. Here are the details:

Cancelled Booking:
- Reference: ${data.reference}
- Location: ${data.locationName}
- Date & Time: ${new Date(data.startTime).toLocaleString()}
- Amount: ${data.currency} ${data.totalAmount}

${instructionsText}${cancellationText}If you have any questions about this cancellation, please contact us.

Best regards,
The Vale Team
    `;

    return { html, text, subject };
  }

  private generateBookingModifiedTemplate(data: BookingTemplateData): { html: string; text: string; subject: string } {
    const subject = `Booking Modified - ${data.locationName}`;
    
    const instructionsHtml = data.instructions != null
      ? `<div class="booking-details">
          <h3>Important Instructions</h3>
          <p>${data.instructions}</p>
        </div>`
      : '';
    const cancellationHtml = data.cancellationPolicy != null
      ? `<div class="booking-details">
          <h3>Cancellation Policy</h3>
          <p>${data.cancellationPolicy}</p>
        </div>`
      : '';

    const instructionsText = data.instructions != null
      ? `Important Instructions:\n${data.instructions}\n\n`
      : '';
    const cancellationText = data.cancellationPolicy != null
      ? `Cancellation Policy:\n${data.cancellationPolicy}\n\n`
      : '';

    const html = `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Booking Modified</title>
        <style>
          body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
          .container { max-width: 600px; margin: 0 auto; padding: 20px; }
          .header { background: #2196F3; color: white; padding: 20px; text-align: center; }
          .content { padding: 20px; background: #f9f9f9; }
          .booking-details { background: white; padding: 20px; margin: 20px 0; border-radius: 5px; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1>✏️ Booking Modified</h1>
          </div>
          <div class="content">
            <p>Dear ${data.customerName},</p>
            <p>Your booking has been modified. Here are the updated details:</p>
            
            <div class="booking-details">
              <h3>Updated Booking Information</h3>
              <p><strong>Reference:</strong> ${data.reference}</p>
              <p><strong>Location:</strong> ${data.locationName}</p>
              <p><strong>Address:</strong> ${data.locationAddress}</p>
              <p><strong>Date & Time:</strong> ${new Date(data.startTime).toLocaleString()}</p>
              <p><strong>Duration:</strong> ${data.duration} hours</p>
              <p><strong>Total Amount:</strong> ${data.currency} ${data.totalAmount}</p>
              <p><strong>Status:</strong> ${data.status}</p>
            </div>

            ${instructionsHtml}
            ${cancellationHtml}

            <p>If you have any questions about these changes, please contact us.</p>
            
            <p>Best regards,<br>The Vale Team</p>
          </div>
        </div>
      </body>
      </html>
    `;

    const text = `
Booking Modified - ${data.locationName}

Dear ${data.customerName},

Your booking has been modified. Here are the updated details:

Updated Booking Information:
- Reference: ${data.reference}
- Location: ${data.locationName}
- Address: ${data.locationAddress}
- Date & Time: ${new Date(data.startTime).toLocaleString()}
- Duration: ${data.duration} hours
- Total Amount: ${data.currency} ${data.totalAmount}
- Status: ${data.status}

${instructionsText}${cancellationText}If you have any questions about these changes, please contact us.

Best regards,
The Vale Team
    `;

    return { html, text, subject };
  }

  private generateWelcomeTemplate(data: WelcomeTemplateData): { html: string; text: string; subject: string } {
    const subject = 'Welcome to Vale Booking System';
    
    const instructionsHtml = data.activationLink != null ? `<p>To get started, please activate your account:</p>
    <p><a href="${data.activationLink}" class="button">Activate Account</a></p>` : '';

    const instructionsText = data.activationLink != null ? `To get started, please activate your account:
    ${data.activationLink}

    ` : '';

    const html = `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Welcome to Vale</title>
        <style>
          body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
          .container { max-width: 600px; margin: 0 auto; padding: 20px; }
          .header { background: #4CAF50; color: white; padding: 20px; text-align: center; }
          .content { padding: 20px; background: #f9f9f9; }
          .button { display: inline-block; padding: 10px 20px; background: #4CAF50; color: white; text-decoration: none; border-radius: 5px; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1>🎉 Welcome to Vale!</h1>
          </div>
          <div class="content">
            <p>Dear ${data.customerName},</p>
            <p>Welcome to Vale Booking System! We're excited to have you on board.</p>
            
            <p>With Vale, you can:</p>
            <ul>
              <li>Book appointments easily and quickly</li>
              <li>Manage your bookings from anywhere</li>
              <li>Receive timely reminders</li>
              <li>Access your booking history</li>
            </ul>

            ${instructionsHtml}

            <p>If you have any questions, our support team is here to help at ${data.supportEmail}.</p>
            
            <p>Best regards,<br>The Vale Team</p>
          </div>
        </div>
      </body>
      </html>
    `;

    const text = `
Welcome to Vale Booking System

Dear ${data.customerName},

Welcome to Vale Booking System! We're excited to have you on board.

With Vale, you can:
- Book appointments easily and quickly
- Manage your bookings from anywhere
- Receive timely reminders
- Access your booking history

${data.activationLink != null ? `To get started, please activate your account:
${data.activationLink}

` : ''}If you have any questions, our support team is here to help at ${data.supportEmail}.

Best regards,
The Vale Team
    `;

    return { html, text, subject };
  }

  private generatePasswordResetTemplate(data: PasswordResetTemplateData): { html: string; text: string; subject: string } {
    const subject = 'Password Reset Request - Vale Booking System';

    const warningHtml = `<div class="warning">
      <p><strong>Important:</strong></p>
      <ul>
        <li>This link will expire on ${data.expiryTime}</li>
        <li>If you didn't request this reset, please ignore this email</li>
        <li>For security, this link can only be used once</li>
      </ul>
    </div>`;

    const warningText = `Important:\n- This link will expire on ${data.expiryTime}\n- If you didn't request this reset, please ignore this email\n- For security, this link can only be used once\n\n`;

    const html = `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Password Reset</title>
        <style>
          body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
          .container { max-width: 600px; margin: 0 auto; padding: 20px; }
          .header { background: #FF9800; color: white; padding: 20px; text-align: center; }
          .content { padding: 20px; background: #f9f9f9; }
          .button { display: inline-block; padding: 10px 20px; background: #FF9800; color: white; text-decoration: none; border-radius: 5px; }
          .warning { background: #FFF3E0; padding: 15px; border-left: 4px solid #FF9800; margin: 20px 0; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1>🔐 Password Reset</h1>
          </div>
          <div class="content">
            <p>Dear ${data.customerName},</p>
            <p>We received a request to reset your password for your Vale account.</p>
            <p>Click the button below to reset your password:</p>
            <p><a href="${data.resetLink}" class="button">Reset Password</a></p>
            ${warningHtml}
            <p>If you have any questions, please contact our support team at ${data.supportEmail}.</p>
            <p>Best regards,<br>The Vale Team</p>
          </div>
        </div>
      </body>
      </html>
    `;

    const text = `
Password Reset Request - Vale Booking System

Dear ${data.customerName},

We received a request to reset your password for your Vale account.

Click the link below to reset your password:
${data.resetLink}

${warningText}If you have any questions, please contact our support team at ${data.supportEmail}.

Best regards,
The Vale Team
    `;

    return { html, text, subject };
  }

  private generateAdminNotificationTemplate(data: AdminNotificationData): { html: string; text: string; subject: string } {
    const subject = `New Booking - ${data.locationName}`;
    
    const html = `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>New Booking Notification</title>
        <style>
          body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
          .container { max-width: 600px; margin: 0 auto; padding: 20px; }
          .header { background: #2196F3; color: white; padding: 20px; text-align: center; }
          .content { padding: 20px; background: #f9f9f9; }
          .booking-details { background: white; padding: 20px; margin: 20px 0; border-radius: 5px; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1>📋 New Booking Notification</h1>
          </div>
          <div class="content">
            <p>A new booking has been made:</p>
            
            <div class="booking-details">
              <h3>Booking Details</h3>
              <p><strong>Booking ID:</strong> ${data.bookingId}</p>
              <p><strong>Customer:</strong> ${data.customerName}</p>
              <p><strong>Location:</strong> ${data.locationName}</p>
              <p><strong>Date & Time:</strong> ${new Date(data.startTime).toLocaleString()}</p>
              <p><strong>Amount:</strong> ${data.currency} ${data.totalAmount}</p>
            </div>

            <p>Please review and process this booking accordingly.</p>
            
            <p>Best regards,<br>Vale Booking System</p>
          </div>
        </div>
      </body>
      </html>
    `;

    const text = `
New Booking - ${data.locationName}

A new booking has been made:

Booking Details:
- Booking ID: ${data.bookingId}
- Customer: ${data.customerName}
- Location: ${data.locationName}
- Date & Time: ${new Date(data.startTime).toLocaleString()}
- Amount: ${data.currency} ${data.totalAmount}

Please review and process this booking accordingly.

Best regards,
Vale Booking System
    `;

    return { html, text, subject };
  }

  private generateGDPRTemplate(data: GDPRTemplateData): { html: string; text: string; subject: string } {
    const subject = `GDPR ${data.requestType === 'export' ? 'Data Export' : 'Data Deletion'} - Vale Booking System`;

    const completionHtml = data.completionDate != null
      ? `<p><strong>Completion Date:</strong> ${data.completionDate}</p>`
      : '';
    const downloadHtml = data.requestType === 'export' && data.downloadLink != null
      ? `<div class="info-box">
          <h3>Your Data Export</h3>
          <p>Your data export is ready for download:</p>
          <p><a href="${data.downloadLink}">Download Your Data</a></p>
          <p><strong>Note:</strong> This download link will expire in 7 days for security reasons.</p>
        </div>`
      : '';
    const deletionHtml = data.requestType === 'deletion'
      ? `<div class="info-box">
          <h3>Data Deletion Process</h3>
          <p>Your data deletion request has been processed. All your personal data has been permanently removed from our systems.</p>
          <p>If you have any active bookings, they have been cancelled and refunded according to our cancellation policy.</p>
        </div>`
      : '';

    const completionText = data.completionDate != null
      ? `- Completion Date: ${data.completionDate}\n`
      : '';
    const downloadText = data.requestType === 'export' && data.downloadLink != null
      ? `Your Data Export:\nYour data export is ready for download:\n${data.downloadLink}\n\nNote: This download link will expire in 7 days for security reasons.\n\n`
      : '';
    const deletionText = data.requestType === 'deletion'
      ? 'Data Deletion Process:\nYour data deletion request has been processed. All your personal data has been permanently removed from our systems.\n\nIf you have any active bookings, they have been cancelled and refunded according to our cancellation policy.\n\n'
      : '';

    const html = `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>GDPR Request</title>
        <style>
          body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
          .container { max-width: 600px; margin: 0 auto; padding: 20px; }
          .header { background: #9C27B0; color: white; padding: 20px; text-align: center; }
          .content { padding: 20px; background: #f9f9f9; }
          .info-box { background: white; padding: 20px; margin: 20px 0; border-radius: 5px; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1>🔒 GDPR Request</h1>
          </div>
          <div class="content">
            <p>Dear ${data.customerName},</p>
            <p>We have received your GDPR ${data.requestType} request.</p>
            <div class="info-box">
              <h3>Request Details</h3>
              <p><strong>Request Type:</strong> ${data.requestType === 'export' ? 'Data Export' : 'Data Deletion'}</p>
              <p><strong>Request Date:</strong> ${data.requestDate}</p>
              ${completionHtml}
            </div>
            ${downloadHtml}
            ${deletionHtml}
            <p>If you have any questions about this request, please contact our data protection officer.</p>
            <p>Best regards,<br>The Vale Team</p>
          </div>
        </div>
      </body>
      </html>
    `;

    const text = `
GDPR ${data.requestType === 'export' ? 'Data Export' : 'Data Deletion'} - Vale Booking System

Dear ${data.customerName},

We have received your GDPR ${data.requestType} request.

Request Details:
- Request Type: ${data.requestType === 'export' ? 'Data Export' : 'Data Deletion'}
- Request Date: ${data.requestDate}
${completionText}
${downloadText}${deletionText}If you have any questions about this request, please contact our data protection officer.

Best regards,
The Vale Team
    `;

    return { html, text, subject };
  }
}

// Export singleton instance
export const emailTemplateService = EmailTemplateService.getInstance(); 