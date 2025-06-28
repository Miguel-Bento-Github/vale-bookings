import { logInfo, logWarning, logError } from '../utils/logger';

// Email configuration
interface EmailConfig {
  provider: 'sendgrid' | 'ses' | 'smtp';
  apiKey?: string;
  region?: string;
  fromEmail: string;
  fromName: string;
  replyTo?: string;
}

// Email message interface
interface EmailMessage {
  to: string;
  subject: string;
  html: string;
  text: string;
  from?: string;
  replyTo?: string;
  attachments?: Array<{
    filename: string;
    content: Buffer | string;
    contentType?: string;
  }>;
}

// Email result interface
interface EmailResult {
  success: boolean;
  messageId?: string;
  error?: string;
  provider?: string;
}

// Get email configuration from environment
const getEmailConfig = (): EmailConfig => {
  return {
    provider: (process.env.EMAIL_PROVIDER as 'sendgrid' | 'ses' | 'smtp') ?? 'sendgrid',
    apiKey: process.env.EMAIL_API_KEY,
    region: process.env.EMAIL_REGION ?? 'us-east-1',
    fromEmail: process.env.EMAIL_FROM ?? 'noreply@vale.com',
    fromName: process.env.EMAIL_FROM_NAME ?? 'Vale Booking System',
    replyTo: process.env.EMAIL_REPLY_TO
  };
};

// Validate email address format
const validateEmail = (email: string): boolean => {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
};

// Mock SendGrid integration
const sendWithSendGrid = async (message: EmailMessage, _config: EmailConfig): Promise<EmailResult> => {
  try {
    logInfo('Sending email via SendGrid', { to: message.to, subject: message.subject });
    
    // Mock successful SendGrid response
    // In real implementation, you would use @sendgrid/mail
    const messageId = `sg_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
    
    // Simulate API call delay
    await new Promise(resolve => setTimeout(resolve, 100));
    
    logInfo('Email sent successfully via SendGrid', { messageId, to: message.to });
    
    return {
      success: true,
      messageId,
      provider: 'sendgrid'
    };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown SendGrid error';
    logError('SendGrid email failed', { error: errorMessage, to: message.to });
    
    return {
      success: false,
      error: errorMessage,
      provider: 'sendgrid'
    };
  }
};

// Mock AWS SES integration
const sendWithSES = async (message: EmailMessage, _config: EmailConfig): Promise<EmailResult> => {
  try {
    logInfo('Sending email via AWS SES', { to: message.to, subject: message.subject });
    
    // Mock successful SES response
    // In real implementation, you would use aws-sdk v3 SESv2Client
    const messageId = `ses_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
    
    // Simulate API call delay
    await new Promise(resolve => setTimeout(resolve, 120));
    
    logInfo('Email sent successfully via SES', { messageId, to: message.to });
    
    return {
      success: true,
      messageId,
      provider: 'ses'
    };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown SES error';
    logError('SES email failed', { error: errorMessage, to: message.to });
    
    return {
      success: false,
      error: errorMessage,
      provider: 'ses'
    };
  }
};

// Mock SMTP integration
const sendWithSMTP = async (message: EmailMessage, _config: EmailConfig): Promise<EmailResult> => {
  try {
    logInfo('Sending email via SMTP', { to: message.to, subject: message.subject });
    
    // Mock successful SMTP response
    // In real implementation, you would use nodemailer
    const messageId = `smtp_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
    
    // Simulate SMTP delay
    await new Promise(resolve => setTimeout(resolve, 200));
    
    logInfo('Email sent successfully via SMTP', { messageId, to: message.to });
    
    return {
      success: true,
      messageId,
      provider: 'smtp'
    };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown SMTP error';
    logError('SMTP email failed', { error: errorMessage, to: message.to });
    
    return {
      success: false,
      error: errorMessage,
      provider: 'smtp'
    };
  }
};

// Main email sending function
export const sendEmail = async (message: EmailMessage): Promise<EmailResult> => {
  try {
    const config = getEmailConfig();
    
    // Validate email address
    if (!validateEmail(message.to)) {
      logWarning('Invalid email address', { to: message.to });
      return {
        success: false,
        error: 'Invalid email address format'
      };
    }
    
    // Validate required fields
    if (!message.subject || message.subject.length === 0 || !message.text || message.text.length === 0) {
      return {
        success: false,
        error: 'Subject and text content are required'
      };
    }
    
    // Set from address if not provided
    const emailToSend: EmailMessage = {
      ...message,
      from: message.from ?? `${config.fromName} <${config.fromEmail}>`,
      replyTo: message.replyTo ?? config.replyTo
    };
    
    // Route to appropriate provider
    switch (config.provider) {
    case 'sendgrid':
      return await sendWithSendGrid(emailToSend, config);
    case 'ses':
      return await sendWithSES(emailToSend, config);
    case 'smtp':
      return await sendWithSMTP(emailToSend, config);
    default:
      logError('Unsupported email provider', { provider: config.provider });
      return {
        success: false,
        error: `Unsupported email provider: ${String(config.provider)}`
      };
    }
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown email error';
    logError('Email service error', { error: errorMessage, to: message.to });
    
    return {
      success: false,
      error: errorMessage
    };
  }
};

// Send bulk emails with rate limiting
export const sendBulkEmails = async (
  messages: EmailMessage[],
  batchSize: number = 10,
  delayMs: number = 1000
): Promise<EmailResult[]> => {
  const results: EmailResult[] = [];
  
  logInfo('Sending bulk emails', { count: messages.length, batchSize, delayMs });
  
  for (let i = 0; i < messages.length; i += batchSize) {
    const batch = messages.slice(i, i + batchSize);
    
    const batchResults = await Promise.all(
      batch.map(message => sendEmail(message))
    );
    
    results.push(...batchResults);
    
    // Add delay between batches to respect rate limits
    if (i + batchSize < messages.length) {
      await new Promise(resolve => setTimeout(resolve, delayMs));
    }
  }
  
  const successCount = results.filter(r => r.success).length;
  const failureCount = results.length - successCount;
  
  logInfo('Bulk email sending completed', { 
    total: results.length, 
    success: successCount, 
    failed: failureCount 
  });
  
  return results;
};

// Test email configuration
export const testEmailConfig = async (): Promise<EmailResult> => {
  const config = getEmailConfig();
  
  const testMessage: EmailMessage = {
    to: config.fromEmail, // Send test email to self
    subject: 'Vale Email Service Test',
    html: '<p>This is a test email from the Vale notification system.</p>',
    text: 'This is a test email from the Vale notification system.'
  };
  
  logInfo('Testing email configuration', { provider: config.provider });
  
  return await sendEmail(testMessage);
};

// Get email service status
export const getEmailServiceStatus = async (): Promise<{
  provider: string;
  healthy: boolean;
  lastTest?: Date;
  error?: string;
}> => {
  const config = getEmailConfig();
  
  try {
    const testResult = await testEmailConfig();
    
    return {
      provider: config.provider,
      healthy: testResult.success,
      lastTest: new Date(),
      error: testResult.error
    };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    
    return {
      provider: config.provider,
      healthy: false,
      lastTest: new Date(),
      error: errorMessage
    };
  }
}; 