import nodemailer from 'nodemailer';
import { Resend } from 'resend';

import { logInfo, logWarning, logError } from '../utils/logger';

// Email configuration
interface EmailConfig {
  provider: 'smtp' | 'resend';
  apiKey?: string;
  fromEmail: string;
  fromName: string;
  replyTo?: string;
  // SMTP specific config
  smtp?: {
    host: string;
    port: number;
    secure: boolean;
    auth: {
      user: string;
      pass: string;
    };
  };
}

// Email message interface
export interface EmailMessage {
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
  const emailDomain = process.env.EMAIL_DOMAIN ?? 'valebooking.com';
  const defaultFromEmail = `noreply@${emailDomain}`;
  
  return {
    provider: (process.env.EMAIL_PROVIDER as 'smtp' | 'resend') ?? 'resend',
    apiKey: process.env.RESEND_KEY ?? process.env.EMAIL_API_KEY,
    fromEmail: process.env.EMAIL_FROM ?? defaultFromEmail,
    fromName: process.env.EMAIL_FROM_NAME ?? 'Vale Booking System',
    replyTo: process.env.EMAIL_REPLY_TO,
    smtp: {
      host: process.env.SMTP_HOST ?? 'localhost',
      port: parseInt(process.env.SMTP_PORT ?? '587'),
      secure: process.env.SMTP_SECURE === 'true',
      auth: {
        user: process.env.SMTP_USER ?? '',
        pass: process.env.SMTP_PASS ?? ''
      }
    }
  };
};

// Validate email address format
const validateEmail = (email: string): boolean => {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
};





// Real SMTP integration using Nodemailer
const sendWithSMTP = async (message: EmailMessage, config: EmailConfig): Promise<EmailResult> => {
  try {
    if (config.smtp == null) {
      throw new Error('SMTP configuration is required');
    }

    logInfo('Sending email via SMTP', { to: message.to, subject: message.subject });

    // Create transporter
    const transporter = nodemailer.createTransport({
      host: config.smtp.host,
      port: config.smtp.port,
      secure: config.smtp.secure,
      auth: config.smtp.auth,
      // Additional options for better reliability
      pool: true,
      maxConnections: 5,
      maxMessages: 100,
      rateLimit: 14, // Max 14 emails per second
      rateDelta: 1000 // Per second
    });

    // Verify connection
    await transporter.verify();

    const mailOptions = {
      from: message.from ?? `${config.fromName} <${config.fromEmail}>`,
      to: message.to,
      subject: message.subject,
      text: message.text,
      html: message.html,
      replyTo: message.replyTo,
      attachments: message.attachments?.map(att => ({
        filename: att.filename,
        content: typeof att.content === 'string' ? Buffer.from(att.content, 'base64') : att.content,
        contentType: att.contentType
      }))
    };

    const info = await transporter.sendMail(mailOptions);
    
    logInfo('Email sent successfully via SMTP', { 
      messageId: info.messageId, 
      to: message.to 
    });

    // Close the connection pool
    transporter.close();

    return {
      success: true,
      messageId: info.messageId,
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

// Real Resend integration with rate limiting
const sendWithResend = async (message: EmailMessage, config: EmailConfig): Promise<EmailResult> => {
  try {
    if (config.apiKey == null || config.apiKey === '') {
      throw new Error('Resend API key is required');
    }

    const resend = new Resend(config.apiKey);

    logInfo('Sending email via Resend', { to: message.to, subject: message.subject });

    const emailData = {
      from: message.from ?? `${config.fromName} <${config.fromEmail}>`,
      to: message.to,
      subject: message.subject,
      html: message.html,
      text: message.text,
      replyTo: message.replyTo,
      attachments: message.attachments?.map(att => ({
        filename: att.filename,
        content: typeof att.content === 'string' ? att.content : att.content.toString('base64'),
        type: att.contentType
      }))
    };

    // Add retry logic for rate limiting
    let lastError: Error | null = null;
    const maxRetries = 3;
    const baseDelay = 1000; // 1 second

    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        const response = await resend.emails.send(emailData);
        
        logInfo('Email sent successfully via Resend', { 
          messageId: response.data?.id, 
          to: message.to 
        });

        return {
          success: true,
          messageId: response.data?.id,
          provider: 'resend'
        };
      } catch (error) {
        lastError = error as Error;
        
        // Check if it's a rate limit error
        if (error != null && typeof error === 'object' && 'statusCode' in error && error.statusCode === 429) {
          const errorObj = error as { headers?: { 'retry-after'?: string } };
          const retryAfterStr = errorObj.headers?.['retry-after'] ?? baseDelay.toString();
          const retryAfter = parseInt(retryAfterStr, 10) || baseDelay;
          const delay = Math.min(retryAfter * 1000, baseDelay * Math.pow(2, attempt - 1));
          
          logWarning('Resend rate limit hit, retrying', { 
            attempt, 
            maxRetries, 
            delay: `${delay}ms`,
            to: message.to 
          });
          
          if (attempt < maxRetries) {
            await new Promise(resolve => setTimeout(resolve, delay));
            continue;
          }
        }
        
        // For non-rate-limit errors or after max retries, break
        break;
      }
    }

    // If we get here, all retries failed
    const errorMessage = lastError?.message ?? 'Unknown Resend error';
    logError('Resend email failed after retries', { 
      error: errorMessage, 
      to: message.to,
      attempts: maxRetries 
    });
    
    return {
      success: false,
      error: errorMessage,
      provider: 'resend'
    };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown Resend error';
    logError('Resend email failed', { error: errorMessage, to: message.to });
    
    return {
      success: false,
      error: errorMessage,
      provider: 'resend'
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
    if (message.subject == null || message.subject.length === 0 || message.text == null || message.text.length === 0) {
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
    case 'smtp':
      return await sendWithSMTP(emailToSend, config);
    case 'resend':
      return await sendWithResend(emailToSend, config);
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