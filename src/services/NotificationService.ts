import { 
  NotificationChannel, 
  NotificationDeliveryResult, 
  BookingNotificationData,
  ScheduledReminder,
  ReminderCancellation,
  DeliveryTracking,
  DeliveryStats,
  DeliveryStatsFilter,
  TemplateRenderResult,
  TemplateValidationResult,
  TemplateData,
  LanguageCode,
  ChannelDeliveryResult
} from '../types/notification';
import { logInfo, logError } from '../utils/logger';

// Mock imports - these services need to be implemented
// import { sendEmail } from './EmailService';
// import { scheduleJob, cancelJob } from './QueueService';
// import { sendSMS } from './SMSService';
// import { renderTemplate as renderTemplateFromService, 
//   validateTemplate as validateTemplateFromService } from './TemplateService';

// Mock implementations
const sendEmail = (_options: {
  to: string;
  subject: string;
  html: string;
  text: string;
}): Promise<{ messageId: string; success: boolean }> => 
  Promise.resolve({ 
    messageId: 'mock-id', 
    success: true 
  });

const sendSMS = (_options: {
  to: string;
  message: string;
}): Promise<{ messageId: string; success: boolean }> => Promise.resolve({ 
  messageId: 'mock-id', 
  success: true 
});

const scheduleJob = (
  _jobId: string, 
  _time: Date, 
  _type: string, 
  _data: unknown
): Promise<{ success: boolean }> => Promise.resolve({ success: true });

const cancelJob = (_jobId: string): Promise<boolean> => Promise.resolve(true);

const renderTemplateFromService = (
  _templateType: string, 
  _channel: string, 
  _data: TemplateData, 
  _language: LanguageCode
): Promise<TemplateRenderResult> => Promise.resolve({
  success: true,
  subject: 'Mock Subject',
  html: '<p>Mock HTML</p>',
  text: 'Mock Text',
  message: 'Mock Message',
  length: 100
});

const validateTemplateFromService = (_template: {
  name?: string;
}): Promise<TemplateValidationResult> => Promise.resolve({
  valid: true,
  errors: []
});

// Generate unique delivery ID
const generateDeliveryId = (): string => {
  return `delivery_${Date.now()}_${Math.random().toString(36).substring(2, 15)}`;
};

// Generate unique job ID
const generateJobId = (): string => {
  return `job_${Date.now()}_${Math.random().toString(36).substring(2, 15)}`;
};

// Create empty channels object with all required properties
const createEmptyChannels = (): Record<NotificationChannel, ChannelDeliveryResult> => {
  return {
    email: { status: 'failed', recipient: '', error: 'Not attempted' },
    sms: { status: 'failed', recipient: '', error: 'Not attempted' },
    push: { status: 'failed', recipient: '', error: 'Not attempted' }
  };
};

// Safe channel result setter to prevent object injection
const setChannelResult = (
  results: Record<NotificationChannel, ChannelDeliveryResult>,
  channel: NotificationChannel,
  result: ChannelDeliveryResult
): void => {
  switch (channel) {
  case 'email':
    results.email = result;
    break;
  case 'sms':
    results.sms = result;
    break;
  case 'push':
    results.push = result;
    break;
  default:
    // Only allow known channels
    break;
  }
};

// Validate booking data
const validateBookingData = (booking: BookingNotificationData): string[] => {
  const errors: string[] = [];
  
  if (booking.referenceNumber == null || booking.referenceNumber === '') errors.push('Reference number is required');
  if (booking.locationName == null || booking.locationName === '') errors.push('Location name is required');
  if (booking.bookingDate == null || booking.bookingDate === '') errors.push('Booking date is required');
  if (booking.bookingTime == null || booking.bookingTime === '') errors.push('Booking time is required');
  
  return errors;
};

// Validate channels and recipients
const validateChannels = (booking: BookingNotificationData, channels: NotificationChannel[]): string | null => {
  const email = booking.guestEmail ?? '';
  const phone = booking.guestPhone ?? '';
  for (const channel of channels) {
    if (channel === 'email' && email.trim() === '') {
      return 'Email address required for email notifications';
    }
    if (channel === 'sms' && phone.trim() === '') {
      return 'Phone number required for SMS notifications';
    }
  }
  return null;
};

// Send booking confirmation notification
export const sendBookingConfirmation = async (
  booking: BookingNotificationData,
  channels: NotificationChannel[],
  language: LanguageCode = 'en'
): Promise<NotificationDeliveryResult> => {
  try {
    logInfo('Sending booking confirmation', { 
      referenceNumber: booking.referenceNumber,
      channels,
      language 
    });

    // Validate booking data
    const validationErrors = validateBookingData(booking);
    if (validationErrors.length > 0) {
      return {
        success: false,
        error: `Missing required booking data: ${validationErrors.join(', ')}`,
        channels: createEmptyChannels()
      };
    }

    // Validate channels
    const channelError = validateChannels(booking, channels);
    if (channelError != null && channelError !== '') {
      return {
        success: false,
        error: channelError,
        channels: createEmptyChannels()
      };
    }

    const deliveryId = generateDeliveryId();
    const results: Record<NotificationChannel, ChannelDeliveryResult> = createEmptyChannels();
    let hasSuccess = false;

    // Process each channel
    for (const channel of channels) {
      try {
        if (channel === 'email' && booking.guestEmail != null && typeof booking.guestEmail === 'string') {
          const template = await renderTemplate('booking_confirmation', 'email', booking, language);
          if (template.success) {
            const emailResult = await sendEmail({
              to: booking.guestEmail,
              subject: template.subject ?? 'Booking Confirmation',
              html: template.html ?? '',
              text: template.text ?? ''
            });
            
            setChannelResult(results, channel, {
              status: 'sent',
              messageId: emailResult.messageId ?? generateDeliveryId(),
              recipient: booking.guestEmail
            });
            hasSuccess = true;
          } else {
            setChannelResult(results, channel, {
              status: 'failed',
              error: template.error,
              recipient: booking.guestEmail
            });
          }
        }
        
        if (channel === 'sms' && booking.guestPhone != null && typeof booking.guestPhone === 'string') {
          const template = await renderTemplate('booking_confirmation', 'sms', booking, language);
          if (template.success) {
            const smsResult = await sendSMS({
              to: booking.guestPhone,
              message: template.message ?? 'Booking confirmed'
            });
            
            setChannelResult(results, channel, {
              status: 'sent',
              messageId: smsResult.messageId ?? generateDeliveryId(),
              recipient: booking.guestPhone
            });
            hasSuccess = true;
          } else {
            setChannelResult(results, channel, {
              status: 'failed',
              error: template.error,
              recipient: booking.guestPhone
            });
          }
        }
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';
        logError(`Failed to send ${channel} notification`, { error: errorMessage });
        
        const recipient = channel === 'email' ? 
          (booking.guestEmail ?? 'unknown') : 
          (booking.guestPhone ?? 'unknown');
        setChannelResult(results, channel, {
          status: 'failed',
          error: errorMessage,
          recipient
        });
      }
    }

    return {
      success: hasSuccess,
      deliveryId: hasSuccess ? deliveryId : undefined,
      channels: results
    };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    logError('Error sending booking confirmation', { error: errorMessage });
    return {
      success: false,
      error: errorMessage,
      channels: createEmptyChannels()
    };
  }
};

// Send booking reminder notification
export const sendBookingReminder = async (
  booking: BookingNotificationData,
  channels: NotificationChannel[],
  language: LanguageCode = 'en'
): Promise<NotificationDeliveryResult> => {
  try {
    logInfo('Sending booking reminder', { 
      referenceNumber: booking.referenceNumber,
      hoursUntil: booking.hoursUntil,
      channels,
      language 
    });

    // Check if booking is in the past
    if (typeof booking.hoursUntil === 'number' && booking.hoursUntil < 0) {
      return {
        success: false,
        error: 'Cannot send reminder for past booking',
        channels: createEmptyChannels()
      };
    }

    // Validate booking data
    const validationErrors = validateBookingData(booking);
    if (validationErrors.length > 0) {
      return {
        success: false,
        error: `Missing required booking data: ${validationErrors.join(', ')}`,
        channels: createEmptyChannels()
      };
    }

    // Validate channels
    const channelError = validateChannels(booking, channels);
    if (channelError != null && channelError !== '') {
      return {
        success: false,
        error: channelError,
        channels: createEmptyChannels()
      };
    }

    const deliveryId = generateDeliveryId();
    const results: Record<NotificationChannel, ChannelDeliveryResult> = createEmptyChannels();
    let hasSuccess = false;

    // Process each channel
    for (const channel of channels) {
      try {
        if (channel === 'email' && booking.guestEmail != null && typeof booking.guestEmail === 'string') {
          const template = await renderTemplate('booking_reminder', 'email', booking, language);
          if (template.success) {
            const emailResult = await sendEmail({
              to: booking.guestEmail,
              subject: template.subject ?? 'Booking Reminder',
              html: template.html ?? '',
              text: template.text ?? ''
            });
            
            setChannelResult(results, channel, {
              status: 'sent',
              messageId: emailResult.messageId ?? generateDeliveryId(),
              recipient: booking.guestEmail
            });
            hasSuccess = true;
          }
        }
        
        if (channel === 'sms' && booking.guestPhone != null && typeof booking.guestPhone === 'string') {
          const template = await renderTemplate('booking_reminder', 'sms', booking, language);
          if (template.success) {
            const smsResult = await sendSMS({
              to: booking.guestPhone,
              message: template.message ?? 'Booking reminder'
            });
            
            setChannelResult(results, channel, {
              status: 'sent',
              messageId: smsResult.messageId ?? generateDeliveryId(),
              recipient: booking.guestPhone
            });
            hasSuccess = true;
          }
        }
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';
        logError(`Failed to send ${channel} reminder`, { error: errorMessage });
      }
    }

    return {
      success: hasSuccess,
      deliveryId: hasSuccess ? deliveryId : undefined,
      channels: results
    };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    logError('Error sending booking reminder', { error: errorMessage });
    return {
      success: false,
      error: errorMessage,
      channels: createEmptyChannels()
    };
  }
};

// Send cancellation confirmation
export const sendCancellationConfirmation = async (
  booking: BookingNotificationData,
  channels: NotificationChannel[],
  language: LanguageCode = 'en'
): Promise<NotificationDeliveryResult> => {
  try {
    logInfo('Sending cancellation confirmation', { 
      referenceNumber: booking.referenceNumber,
      channels,
      language 
    });

    // Similar implementation to booking confirmation but with cancellation template
    const deliveryId = generateDeliveryId();
    const results: Record<NotificationChannel, ChannelDeliveryResult> = createEmptyChannels();
    let hasSuccess = false;

    for (const channel of channels) {
      try {
        if (channel === 'email' && booking.guestEmail != null && typeof booking.guestEmail === 'string') {
          const template = await renderTemplate('cancellation_confirmation', 'email', booking, language);
          if (template.success) {
            const emailResult = await sendEmail({
              to: booking.guestEmail,
              subject: template.subject ?? 'Booking Cancelled',
              html: template.html ?? '',
              text: template.text ?? ''
            });
            
            setChannelResult(results, channel, {
              status: 'sent',
              messageId: emailResult.messageId ?? generateDeliveryId(),
              recipient: booking.guestEmail
            });
            hasSuccess = true;
          }
        }
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';
        logError(`Failed to send ${channel} cancellation confirmation`, { error: errorMessage });
      }
    }

    return {
      success: hasSuccess,
      deliveryId: hasSuccess ? deliveryId : undefined,
      channels: results
    };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    logError('Error sending cancellation confirmation', { error: errorMessage });
    return {
      success: false,
      error: errorMessage,
      channels: createEmptyChannels()
    };
  }
};

// Schedule reminder notification
export const scheduleReminder = async (
  booking: BookingNotificationData,
  hoursBeforeBooking: number,
  language: LanguageCode = 'en'
): Promise<ScheduledReminder> => {
  try {
    logInfo('Scheduling reminder', { 
      referenceNumber: booking.referenceNumber,
      hoursBeforeBooking,
      language 
    });

    // Validate booking data
    const validationErrors = validateBookingData(booking);
    if (validationErrors.length > 0) {
      return {
        success: false,
        error: `Invalid booking data: ${validationErrors.join(', ')}`,
        jobId: null
      };
    }

    // Calculate scheduled time
    const bookingDateTime = new Date(`${booking.bookingDate}T${booking.bookingTime}`);
    const reminderTime = new Date(bookingDateTime.getTime() - (hoursBeforeBooking * 60 * 60 * 1000));

    // Check if reminder time is in the past
    if (reminderTime <= new Date()) {
      return {
        success: false,
        error: 'Reminder time is in the past',
        jobId: null
      };
    }

    const jobId = generateJobId();
    
    // Schedule the job
    await scheduleJob(jobId, reminderTime, 'booking_reminder', {
      booking,
      channels: booking.channels ?? ['email'],
      language
    });

    return {
      success: true,
      jobId,
      scheduledFor: reminderTime,
      channels: booking.channels ?? ['email']
    };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    logError('Error scheduling reminder', { error: errorMessage });
    return {
      success: false,
      error: errorMessage,
      jobId: null
    };
  }
};

// Cancel scheduled reminder
export const cancelReminder = async (jobId: string): Promise<ReminderCancellation> => {
  try {
    logInfo('Cancelling reminder', { jobId });
    
    const cancelled = await cancelJob(jobId);
    
    if (cancelled) {
      return {
        success: true,
        jobId,
        cancelledAt: new Date()
      };
    } else {
      return {
        success: false,
        error: 'Reminder job not found',
        jobId
      };
    }
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    logError('Error cancelling reminder', { error: errorMessage });
    return {
      success: false,
      error: errorMessage,
      jobId
    };
  }
};

// Track delivery status
export const trackDelivery = (deliveryId: string): Promise<DeliveryTracking> => {
  try {
    logInfo('Tracking delivery', { deliveryId });
    
    // Mock implementation - in reality this would query a database
    // and integrate with webhook data from email/SMS providers
    return Promise.resolve({
      deliveryId,
      channels: {
        email: {
          status: 'delivered',
          deliveredAt: new Date(),
          recipient: 'test@example.com'
        }
      },
      createdAt: new Date(),
      updatedAt: new Date()
    });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    logError('Error tracking delivery', { error: errorMessage });
    return Promise.reject(new Error(errorMessage));
  }
};

// Get delivery statistics
export const getDeliveryStats = (filter: DeliveryStatsFilter): Promise<DeliveryStats> => {
  try {
    logInfo('Getting delivery stats', filter);
    
    // Mock implementation - in reality this would query analytics database
    return Promise.resolve({
      totalSent: 1250,
      delivered: 1180,
      bounced: 45,
      complaints: 12,
      opened: 890,
      clicked: 234,
      deliveryRate: 94.4,
      openRate: 75.4,
      clickRate: 26.3,
      period: {
        startDate: filter.startDate,
        endDate: filter.endDate
      }
    });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    logError('Error getting delivery stats', { error: errorMessage });
    return Promise.reject(new Error(errorMessage));
  }
};

// Render template
export const renderTemplate = async (
  templateType: string,
  channel: string,
  data: TemplateData,
  language: LanguageCode = 'en'
): Promise<TemplateRenderResult> => {
  try {
    logInfo('Rendering template', { templateType, channel, language });
    
    return await renderTemplateFromService(templateType, channel, data, language);
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    logError('Error rendering template', { error: errorMessage });
    return {
      success: false,
      error: errorMessage
    };
  }
};

// Validate template
export const validateTemplate = async (template: Record<string, unknown>): Promise<TemplateValidationResult> => {
  try {
    logInfo('Validating template', { name: template.name });
    
    return await validateTemplateFromService(template);
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    logError('Error validating template', { error: errorMessage });
    return {
      valid: false,
      errors: [errorMessage]
    };
  }
}; 