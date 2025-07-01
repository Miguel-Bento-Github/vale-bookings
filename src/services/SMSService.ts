import { logInfo, logWarning, logError } from '../utils/logger';

// SMS configuration
interface SMSConfig {
  provider: 'twilio' | 'sns';
  accountSid?: string;
  authToken?: string;
  apiKey?: string;
  region?: string;
  fromNumber: string;
}

// SMS message interface
interface SMSMessage {
  to: string;
  message: string;
  from?: string;
}

// SMS result interface
interface SMSResult {
  success: boolean;
  messageId?: string;
  error?: string;
  provider?: string;
  cost?: number;
  segments?: number;
}

// Get SMS configuration from environment
const getSMSConfig = (): SMSConfig => {
  return {
    provider: (process.env.SMS_PROVIDER as 'twilio' | 'sns') ?? 'twilio',
    accountSid: process.env.TWILIO_ACCOUNT_SID,
    authToken: process.env.TWILIO_AUTH_TOKEN,
    apiKey: process.env.AWS_ACCESS_KEY_ID,
    region: process.env.SMS_REGION ?? 'us-east-1',
    fromNumber: process.env.SMS_FROM_NUMBER ?? '+1234567890'
  };
};

// Validate phone number format (basic E.164 validation)
const validatePhoneNumber = (phoneNumber: string): boolean => {
  // Remove any non-digit characters except +
  const cleaned = phoneNumber.replace(/[^\d+]/g, '');
  
  // Check if it starts with + and has 10-15 digits
  const e164Regex = /^\+[1-9]\d{9,14}$/;
  return e164Regex.test(cleaned);
};

// Normalize phone number to E.164 format
const normalizePhoneNumber = (phoneNumber: string): string => {
  // Remove all non-digit characters except +
  let cleaned = phoneNumber.replace(/[^\d+]/g, '');
  
  // If no + at the beginning, add +1 for US numbers (basic assumption)
  if (!cleaned.startsWith('+')) {
    // If it's 10 digits, assume US number
    if (cleaned.length === 10) {
      cleaned = '+1' + cleaned;
    } else if (cleaned.length === 11 && cleaned.startsWith('1')) {
      cleaned = '+' + cleaned;
    } else {
      // For other cases, just add +
      cleaned = '+' + cleaned;
    }
  }
  
  return cleaned;
};

// Calculate SMS segments (each SMS can be up to 160 characters)
const calculateSMSSegments = (message: string): number => {
  // Standard SMS is 160 characters for GSM 7-bit encoding
  // Unicode messages are 70 characters per segment
  const hasUnicode = /[\u0080-\uFFFF]/.test(message);
  const maxLength = hasUnicode ? 70 : 160;
  
  return Math.ceil(message.length / maxLength);
};

// Mock Twilio integration
const sendWithTwilio = async (message: SMSMessage, _config: SMSConfig): Promise<SMSResult> => {
  try {
    logInfo('Sending SMS via Twilio', { to: message.to, length: message.message.length });
    
    // Mock successful Twilio response
    // In real implementation, you would use twilio SDK
    const messageId = `tw_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
    const segments = calculateSMSSegments(message.message);
    
    // Simulate API call delay
    await new Promise(resolve => setTimeout(resolve, 150));
    
    logInfo('SMS sent successfully via Twilio', { messageId, to: message.to, segments });
    
    return Promise.resolve({
      success: true,
      messageId,
      provider: 'twilio',
      segments,
      cost: segments * 0.0075 // Mock cost calculation
    });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown Twilio error';
    logError('Twilio SMS failed', { error: errorMessage, to: message.to });
    
    return Promise.resolve({
      success: false,
      error: errorMessage,
      provider: 'twilio'
    });
  }
};

// Mock AWS SNS integration
const sendWithSNS = async (message: SMSMessage, _config: SMSConfig): Promise<SMSResult> => {
  try {
    logInfo('Sending SMS via AWS SNS', { to: message.to, length: message.message.length });
    
    // Mock successful SNS response
    // In real implementation, you would use aws-sdk v3 SNSClient
    const messageId = `sns_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
    const segments = calculateSMSSegments(message.message);
    
    // Simulate API call delay
    await new Promise(resolve => setTimeout(resolve, 180));
    
    logInfo('SMS sent successfully via SNS', { messageId, to: message.to, segments });
    
    return Promise.resolve({
      success: true,
      messageId,
      provider: 'sns',
      segments,
      cost: segments * 0.008 // Mock cost calculation
    });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown SNS error';
    logError('SNS SMS failed', { error: errorMessage, to: message.to });
    
    return Promise.resolve({
      success: false,
      error: errorMessage,
      provider: 'sns'
    });
  }
};

// Main SMS sending function
export const sendSMS = async (message: SMSMessage): Promise<SMSResult> => {
  try {
    const config = getSMSConfig();
    
    // Normalize and validate phone number
    const normalizedNumber = normalizePhoneNumber(message.to);
    if (!validatePhoneNumber(normalizedNumber)) {
      logWarning('Invalid phone number', { to: message.to, normalized: normalizedNumber });
      return {
        success: false,
        error: 'Invalid phone number format'
      };
    }
    
    // Validate message content
    if (!message.message || typeof message.message !== 'string' || message.message.trim().length === 0) {
      return {
        success: false,
        error: 'Message content is required'
      };
    }
    
    // Check message length (warn if too long)
    const segments = calculateSMSSegments(message.message);
    if (segments > 3) {
      logWarning('SMS message is very long', { 
        to: normalizedNumber, 
        length: message.message.length, 
        segments 
      });
    }
    
    // Set from number if not provided
    const smsToSend: SMSMessage = {
      ...message,
      to: normalizedNumber,
      from: message.from ?? config.fromNumber
    };
    
    // Route to appropriate provider
    switch (config.provider) {
    case 'twilio':
      return await sendWithTwilio(smsToSend, config);
    case 'sns':
      return await sendWithSNS(smsToSend, config);
    default:
      logError('Unsupported SMS provider', { provider: config.provider });
      return {
        success: false,
        error: `Unsupported SMS provider: ${String(config.provider)}`
      };
    }
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown SMS error';
    logError('SMS service error', { error: errorMessage, to: message.to });
    
    return {
      success: false,
      error: errorMessage
    };
  }
};

// Send bulk SMS with rate limiting
export const sendBulkSMS = async (
  messages: SMSMessage[],
  batchSize: number = 5,
  delayMs: number = 1000
): Promise<SMSResult[]> => {
  const results: SMSResult[] = [];
  
  logInfo('Sending bulk SMS', { count: messages.length, batchSize, delayMs });
  
  for (let i = 0; i < messages.length; i += batchSize) {
    const batch = messages.slice(i, i + batchSize);
    
    const batchResults = await Promise.all(
      batch.map(message => sendSMS(message))
    );
    
    results.push(...batchResults);
    
    // Add delay between batches to respect rate limits
    if (i + batchSize < messages.length) {
      await new Promise(resolve => setTimeout(resolve, delayMs));
    }
  }
  
  const successCount = results.filter(r => r.success).length;
  const failureCount = results.length - successCount;
  const totalCost = results.reduce((sum, r) => sum + (r.cost ?? 0), 0);
  
  logInfo('Bulk SMS sending completed', { 
    total: results.length, 
    success: successCount, 
    failed: failureCount,
    totalCost: String(totalCost.toFixed(4))
  });
  
  return results;
};

// Test SMS configuration
export const testSMSConfig = async (testNumber?: string): Promise<SMSResult> => {
  const config = getSMSConfig();
  
  const testMessage: SMSMessage = {
    to: testNumber ?? config.fromNumber, // Send test SMS to provided number or self
    message: 'Test message from Vale notification system. Reply STOP to opt out.'
  };
  
  logInfo('Testing SMS configuration', { provider: config.provider, to: testMessage.to });
  
  return await sendSMS(testMessage);
};

// Get SMS service status
export const getSMSServiceStatus = (): Promise<{
  provider: string;
  healthy: boolean;
  lastTest?: Date;
  error?: string;
}> => {
  const config = getSMSConfig();
  
  try {
    // For testing, we'll just validate configuration rather than sending a real SMS
    const hasFromNumber = config.fromNumber != null && config.fromNumber !== '';
    const isTwilioValid = config.provider === 'twilio' && 
      config.accountSid != null && config.accountSid !== '' && 
      config.authToken != null && config.authToken !== '';
    const isSnsValid = config.provider === 'sns' && 
      config.apiKey != null && config.apiKey !== '' && 
      config.region != null && config.region !== '';
    const isConfigValid = !!(hasFromNumber && (isTwilioValid || isSnsValid));
    
    return Promise.resolve({
      provider: config.provider,
      healthy: isConfigValid,
      lastTest: new Date(),
      error: isConfigValid ? undefined : 'Invalid SMS configuration'
    });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    
    return Promise.resolve({
      provider: config.provider,
      healthy: false,
      lastTest: new Date(),
      error: errorMessage
    });
  }
};

// Opt-out management
export const handleOptOut = (phoneNumber: string, message: string): Promise<boolean> => {
  const normalizedNumber = normalizePhoneNumber(phoneNumber);
  const messageLower = message.toLowerCase().trim();
  
  // Check for opt-out keywords
  const optOutKeywords = ['stop', 'unsubscribe', 'quit', 'cancel', 'end', 'opt out'];
  const isOptOut = optOutKeywords.some(keyword => messageLower.includes(keyword));
  
  if (isOptOut) {
    logInfo('SMS opt-out detected', { phoneNumber: normalizedNumber, message: messageLower });
    
    // In real implementation, you would:
    // 1. Add the number to an opt-out database
    // 2. Send confirmation message
    // 3. Update notification preferences
    
    return Promise.resolve(true);
  }
  
  return Promise.resolve(false);
};

// Check if phone number has opted out
export const isOptedOut = (phoneNumber: string): Promise<boolean> => {
  const normalizedNumber = normalizePhoneNumber(phoneNumber);
  
  // In real implementation, you would check against opt-out database
  // For now, return false (mock implementation)
  logInfo('Checking opt-out status', { phoneNumber: normalizedNumber });
  
  return Promise.resolve(false);
}; 