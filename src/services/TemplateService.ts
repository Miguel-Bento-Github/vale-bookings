import { TemplateRenderResult, TemplateValidationResult, TemplateData, LanguageCode } from '../types/notification';
import { logInfo, logError } from '../utils/logger';

// Template variable pattern for mustache-style templates
const TEMPLATE_VARIABLE_PATTERN = /\{\{([^}]+)\}\}/g;

// Built-in templates for different types and languages
const BUILT_IN_TEMPLATES = {
  booking_confirmation: {
    email: {
      en: {
        subject: 'Booking Confirmed - {{referenceNumber}}',
        html: `
          <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
            <h2 style="color: #2563eb;">Booking Confirmed!</h2>
            <p>Dear {{guestName}},</p>
            <p>Your booking has been confirmed. Here are the details:</p>
            <div style="background: #f3f4f6; padding: 20px; border-radius: 8px; margin: 20px 0;">
              <h3 style="margin-top: 0;">Booking Details</h3>
              <p><strong>Reference Number:</strong> {{referenceNumber}}</p>
              <p><strong>Location:</strong> {{locationName}}</p>
              <p><strong>Date & Time:</strong> {{bookingDate}} at {{bookingTime}}</p>
              {{#duration}}<p><strong>Duration:</strong> {{duration}} minutes</p>{{/duration}}
              {{#serviceName}}<p><strong>Service:</strong> {{serviceName}}</p>{{/serviceName}}
            </div>
            <p>If you need to make changes or cancel your booking, please contact us.</p>
            <p>Best regards,<br>The Vale Team</p>
          </div>
        `,
        text: `Booking Confirmed!

Dear {{guestName}},

Your booking has been confirmed. Here are the details:

Reference Number: {{referenceNumber}}
Location: {{locationName}}
Date & Time: {{bookingDate}} at {{bookingTime}}
{{#duration}}Duration: {{duration}} minutes{{/duration}}
{{#serviceName}}Service: {{serviceName}}{{/serviceName}}

If you need to make changes or cancel your booking, please contact us.

Best regards,
The Vale Team`
      },
      es: {
        subject: 'Reserva Confirmada - {{referenceNumber}}',
        html: `
          <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
            <h2 style="color: #2563eb;">¡Reserva Confirmada!</h2>
            <p>Estimado/a {{guestName}},</p>
            <p>Su reserva ha sido confirmada. Aquí están los detalles:</p>
            <div style="background: #f3f4f6; padding: 20px; border-radius: 8px; margin: 20px 0;">
              <h3 style="margin-top: 0;">Detalles de la Reserva</h3>
              <p><strong>Número de Referencia:</strong> {{referenceNumber}}</p>
              <p><strong>Ubicación:</strong> {{locationName}}</p>
              <p><strong>Fecha y Hora:</strong> {{bookingDate}} a las {{bookingTime}}</p>
              {{#duration}}<p><strong>Duración:</strong> {{duration}} minutos</p>{{/duration}}
              {{#serviceName}}<p><strong>Servicio:</strong> {{serviceName}}</p>{{/serviceName}}
            </div>
            <p>Si necesita hacer cambios o cancelar su reserva, por favor contáctenos.</p>
            <p>Saludos cordiales,<br>El Equipo de Vale</p>
          </div>
        `,
        text: `¡Reserva Confirmada!

Estimado/a {{guestName}},

Su reserva ha sido confirmada. Aquí están los detalles:

Número de Referencia: {{referenceNumber}}
Ubicación: {{locationName}}
Fecha y Hora: {{bookingDate}} a las {{bookingTime}}
{{#duration}}Duración: {{duration}} minutos{{/duration}}
{{#serviceName}}Servicio: {{serviceName}}{{/serviceName}}

Si necesita hacer cambios o cancelar su reserva, por favor contáctenos.

Saludos cordiales,
El Equipo de Vale`
      },
      fr: {
        subject: 'Réservation Confirmée - {{referenceNumber}}',
        html: `
          <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
            <h2 style="color: #2563eb;">Réservation Confirmée!</h2>
            <p>Cher/Chère {{guestName}},</p>
            <p>Votre réservation a été confirmée. Voici les détails:</p>
            <div style="background: #f3f4f6; padding: 20px; border-radius: 8px; margin: 20px 0;">
              <h3 style="margin-top: 0;">Détails de la Réservation</h3>
              <p><strong>Numéro de Référence:</strong> {{referenceNumber}}</p>
              <p><strong>Lieu:</strong> {{locationName}}</p>
              <p><strong>Date et Heure:</strong> {{bookingDate}} à {{bookingTime}}</p>
              {{#duration}}<p><strong>Durée:</strong> {{duration}} minutes</p>{{/duration}}
              {{#serviceName}}<p><strong>Service:</strong> {{serviceName}}</p>{{/serviceName}}
            </div>
            <p>Si vous devez apporter des modifications ou annuler votre réservation, veuillez nous contacter.</p>
            <p>Cordialement,<br>L'Équipe Vale</p>
          </div>
        `,
        text: `Réservation Confirmée!

Cher/Chère {{guestName}},

Votre réservation a été confirmée. Voici les détails:

Numéro de Référence: {{referenceNumber}}
Lieu: {{locationName}}
Date et Heure: {{bookingDate}} à {{bookingTime}}
{{#duration}}Durée: {{duration}} minutes{{/duration}}
{{#serviceName}}Service: {{serviceName}}{{/serviceName}}

Si vous devez apporter des modifications ou annuler votre réservation, veuillez nous contacter.

Cordialement,
L'Équipe Vale`
      }
    },
    sms: {
      en: {
        text: 'Vale Booking Confirmed! Ref: {{referenceNumber}} | {{locationName}} | ' +
              '{{bookingDate}} {{bookingTime}} | Reply STOP to opt out'
      },
      es: {
        text: 'Reserva Vale Confirmada! Ref: {{referenceNumber}} | {{locationName}} | ' +
              '{{bookingDate}} {{bookingTime}} | Responda STOP para cancelar'
      },
      fr: {
        text: 'Réservation Vale Confirmée! Réf: {{referenceNumber}} | {{locationName}} | ' +
              '{{bookingDate}} {{bookingTime}} | Répondez STOP pour vous désabonner'
      }
    }
  },
  booking_reminder: {
    email: {
      en: {
        subject: 'Reminder: Your appointment {{#hoursUntil}}in {{hoursUntil}} hours{{/hoursUntil}}',
        html: `
          <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
            <h2 style="color: #f59e0b;">Appointment Reminder</h2>
            <p>Dear {{guestName}},</p>
            <p>This is a friendly reminder about your upcoming 
              appointment{{#hoursUntil}} in {{hoursUntil}} hours{{/hoursUntil}}:</p>
            <div style="background: #fef3c7; border-left: 4px solid #f59e0b; padding: 20px; margin: 20px 0;">
              <h3 style="margin-top: 0;">Appointment Details</h3>
              <p><strong>Reference:</strong> {{referenceNumber}}</p>
              <p><strong>Location:</strong> {{locationName}}</p>
              <p><strong>Date & Time:</strong> {{bookingDate}} at {{bookingTime}}</p>
              {{#serviceName}}<p><strong>Service:</strong> {{serviceName}}</p>{{/serviceName}}
            </div>
            <p>Please arrive 10 minutes early. If you need to reschedule or cancel, 
              please contact us as soon as possible.</p>
            <p>Best regards,<br>The Vale Team</p>
          </div>
        `,
        text: `Appointment Reminder

Dear {{guestName}},

This is a friendly reminder about your upcoming appointment{{#hoursUntil}} in {{hoursUntil}} hours{{/hoursUntil}}:

Reference: {{referenceNumber}}
Location: {{locationName}}
Date & Time: {{bookingDate}} at {{bookingTime}}
{{#serviceName}}Service: {{serviceName}}{{/serviceName}}

Please arrive 10 minutes early. If you need to reschedule or cancel, 
please contact us as soon as possible.

Best regards,
The Vale Team`
      }
    },
    sms: {
      en: {
        text: 'Reminder: Vale appointment {{#hoursUntil}}in {{hoursUntil}}h{{/hoursUntil}} | ' +
              '{{locationName}} | {{bookingDate}} {{bookingTime}} | Ref: {{referenceNumber}}'
      }
    }
  },
  cancellation_confirmation: {
    email: {
      en: {
        subject: 'Booking Cancelled - {{referenceNumber}}',
        html: `
          <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
            <h2 style="color: #dc2626;">Booking Cancelled</h2>
            <p>Dear {{guestName}},</p>
            <p>Your booking has been successfully cancelled.</p>
            <div style="background: #fee2e2; border-left: 4px solid #dc2626; padding: 20px; margin: 20px 0;">
              <h3 style="margin-top: 0;">Cancelled Booking Details</h3>
              <p><strong>Reference Number:</strong> {{referenceNumber}}</p>
              <p><strong>Location:</strong> {{locationName}}</p>
              <p><strong>Date & Time:</strong> {{bookingDate}} at {{bookingTime}}</p>
            </div>
            <p>If you'd like to book again in the future, we'd be happy to assist you.</p>
            <p>Best regards,<br>The Vale Team</p>
          </div>
        `,
        text: `Booking Cancelled

Dear {{guestName}},

Your booking has been successfully cancelled.

Reference Number: {{referenceNumber}}
Location: {{locationName}}
Date & Time: {{bookingDate}} at {{bookingTime}}

If you'd like to book again in the future, we'd be happy to assist you.

Best regards,
The Vale Team`
      }
    },
    sms: {
      en: {
        text: 'Vale booking cancelled | Ref: {{referenceNumber}} | {{locationName}} | {{bookingDate}} {{bookingTime}}'
      }
    }
  }
};

// Basic template shape
interface BasicTemplate {
  subject?: string;
  html?: string;
  text: string;
}

type ChannelTemplates = Record<LanguageCode, BasicTemplate>;

type TemplateMap = Record<string, {
  email?: ChannelTemplates;
  sms?: ChannelTemplates;
}>;

// Cast built-in templates to TemplateMap once
const BUILT_IN: TemplateMap = BUILT_IN_TEMPLATES as unknown as TemplateMap;

// Utility guard to ensure only safe alphanumeric keys are accessed on dynamic objects
const isSafeKey = (key: string): key is keyof TemplateData => /^[a-zA-Z0-9_]+$/.test(key);

// Get value from data object safely
const getDataValue = (data: TemplateData, key: string): unknown => {
  // Only access known properties
  switch (key) {
  case 'guestName': return data.guestName;
  case 'referenceNumber': return data.referenceNumber;
  case 'locationName': return data.locationName;
  case 'locationAddress': return data.locationAddress;
  case 'bookingDate': return data.bookingDate;
  case 'bookingTime': return data.bookingTime;
  case 'duration': return data.duration;
  case 'serviceName': return data.serviceName;
  case 'hoursUntil': return data.hoursUntil;
  default: return undefined;
  }
};

// Simple template variable replacement
const replaceTemplateVariables = (template: string, data: TemplateData): string => {
  return template.replace(TEMPLATE_VARIABLE_PATTERN, (match, variableName: string): string => {
    const trimmedName = variableName.trim();
    
    // Handle conditional blocks (simplified version)
    if (trimmedName.startsWith('#')) {
      const propName = trimmedName.substring(1);
      const propValue = getDataValue(data, propName);
      return propValue != null && propValue !== '' && propValue !== 0 ? '' : match;
    }
    
    if (trimmedName.startsWith('/')) {
      return '';
    }
    
    // Regular variable replacement guarded against prototype pollution
    const value = getDataValue(data, trimmedName);
    if (value == null) {
      return '';
    }
    
    // Safe string conversion - avoid object stringification
    if (typeof value === 'object') {
      return JSON.stringify(value);
    }
    
    if (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') {
      return String(value);
    }
    
    return '';
  });
};

// Remove conditional block syntax for simple rendering
const simplifyTemplate = (template: string, data: TemplateData): string => {
  // Remove conditional blocks where the condition is false
  let result = template;
  
  // Handle {{#variable}}...{{/variable}} blocks
  const conditionalPattern = /\{\{#(\w+)\}\}(.*?)\{\{\/\1\}\}/gs;
  result = result.replace(conditionalPattern, (match, variableName, content) => {
    const value = getDataValue(data, typeof variableName === 'string' ? variableName : '');
    if (value !== undefined && value !== null && value !== '' && value !== 0) {
      return typeof content === 'string' ? content : '';
    }
    return '';
  });
  
  return result;
};

// Safe accessor for template types
const getSafeTemplateType = (templateType: string): { email?: ChannelTemplates; sms?: ChannelTemplates; } | null => {
  if (Object.prototype.hasOwnProperty.call(BUILT_IN, templateType)) {
    const result = (BUILT_IN as Record<string, { email?: ChannelTemplates; sms?: ChannelTemplates; }>)[templateType];
    return result ?? null;
  }
  return null;
};

// Safe accessor for channel groups
const getSafeChannelGroup = (
  typeGroup: { email?: ChannelTemplates; sms?: ChannelTemplates; }, 
  channel: 'email' | 'sms'
): ChannelTemplates | null => {
  switch (channel) {
  case 'email':
    return typeGroup.email ?? null;
  case 'sms':
    return typeGroup.sms ?? null;
  default:
    return null;
  }
};

// Safe accessor for language templates
const getSafeLanguageTemplate = (
  channelGroup: ChannelTemplates, 
  language: LanguageCode
): BasicTemplate | null => {
  switch (language) {
  case 'en':
    return channelGroup.en ?? null;
  case 'es':
    return channelGroup.es ?? null;
  case 'fr':
    return channelGroup.fr ?? null;
  default:
    return null;
  }
};

// Get template for specific type, channel, and language
const getTemplate = (
  templateType: string,
  channel: 'email' | 'sms',
  language: LanguageCode
): BasicTemplate | null => {
  // Validate templateType is safe
  if (!isSafeKey(templateType) || !Object.prototype.hasOwnProperty.call(BUILT_IN, templateType)) {
    return null;
  }
  
  const typeGroup = getSafeTemplateType(templateType);
  if (!typeGroup) return null;
  
  // Validate channel is safe
  if (channel !== 'email' && channel !== 'sms') return null;
  if (!Object.prototype.hasOwnProperty.call(typeGroup, channel)) return null;
  
  const channelGroup = getSafeChannelGroup(typeGroup, channel);
  if (!channelGroup) return null;
  
  // Safe language access with fallback
  if (Object.prototype.hasOwnProperty.call(channelGroup, language)) {
    return getSafeLanguageTemplate(channelGroup, language);
  }
  
  return channelGroup['en'] ?? null;
};

// Extract variables from template
const extractVariablesFromTemplate = (template: string): string[] => {
  const variables = new Set<string>();
  let execResult: RegExpExecArray | null;
  
  // Reset regex lastIndex
  TEMPLATE_VARIABLE_PATTERN.lastIndex = 0;

  while ((execResult = TEMPLATE_VARIABLE_PATTERN.exec(template)) !== null) {
    if (execResult[1] != null && execResult[1] !== '') {
      const variableName = execResult[1].trim();
      
      // Skip conditional syntax
      if (!variableName.startsWith('#') && !variableName.startsWith('/')) {
        variables.add(variableName);
      }
    }
  }
  
  return Array.from(variables);
};

// Validate template syntax
const validateTemplateSyntax = (template: string): string[] => {
  const errors: string[] = [];
  
  // Check for unclosed variable tags
  const openBraces = (template.match(/\{\{/g) ?? []).length;
  const closeBraces = (template.match(/\}\}/g) ?? []).length;
  
  if (openBraces !== closeBraces) {
    errors.push('Unclosed variable tag');
  }
  
  // Check for malformed conditional blocks
  const conditionalOpenPattern = /\{\{#(\w+)\}\}/g;
  const conditionalClosePattern = /\{\{\/(\w+)\}\}/g;
  
  const openConditionals: string[] = [];
  let match: RegExpExecArray | null;
  
  while ((match = conditionalOpenPattern.exec(template)) !== null) {
    if (match[1] != null && match[1] !== '') {
      openConditionals.push(match[1]);
    }
  }
  
  const closeConditionals: string[] = [];
  while ((match = conditionalClosePattern.exec(template)) !== null) {
    if (match[1] != null && match[1] !== '') {
      closeConditionals.push(match[1]);
    }
  }
  
  if (openConditionals.length !== closeConditionals.length) {
    errors.push('Unmatched conditional blocks');
  }
  
  return errors;
};

// Main template rendering function
export const renderTemplate = async (
  templateType: string,
  channel: string,
  data: TemplateData,
  language: LanguageCode = 'en'
): Promise<TemplateRenderResult> => {
  // Satisfy require-await rule
  await Promise.resolve();
  
  try {
    logInfo('Rendering template', { templateType, channel, language });
    
    // Get template
    const template = getTemplate(templateType, channel as 'email' | 'sms', language);
    if (!template) {
      return {
        success: false,
        error: `Template not found: ${templateType}`
      };
    }
    
    // Validate required variables
    const requiredVars = ['guestName', 'referenceNumber', 'locationName', 'bookingDate', 'bookingTime'];
    const missingVars = requiredVars.filter(varName => {
      const value = getDataValue(data, varName);
      return value == null || value === '';
    });
    
    if (missingVars.length > 0) {
      return {
        success: false,
        error: `Missing required variables: ${missingVars.join(', ')}`
      };
    }
    
    if (channel === 'email') {
      // Render email template
      const processedSubject = simplifyTemplate(template.subject ?? '', data);
      const processedHtml = simplifyTemplate(template.html ?? '', data);
      const processedText = simplifyTemplate(template.text, data);
      
      const subject = replaceTemplateVariables(processedSubject, data);
      const html = replaceTemplateVariables(processedHtml, data);
      const text = replaceTemplateVariables(processedText, data);
      
      return {
        success: true,
        subject,
        html,
        text
      };
    } else if (channel === 'sms') {
      // Render SMS template
      const processedText = simplifyTemplate(template.text, data);
      const message = replaceTemplateVariables(processedText, data);
      
      return {
        success: true,
        message,
        length: message.length
      };
    } else {
      return {
        success: false,
        error: `Unsupported channel: ${channel}`
      };
    }
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown template error';
    logError('Template rendering failed', { error: errorMessage, templateType, channel });
    
    return {
      success: false,
      error: errorMessage
    };
  }
};

// Validate template
export const validateTemplate = async (
  template: Record<string, unknown>
): Promise<TemplateValidationResult> => {
  // Satisfy require-await rule
  await Promise.resolve();
  
  try {
    logInfo('Validating template', { name: template.name });
    
    const errors: string[] = [];
    
    // Validate template structure
    if (template.name == null || typeof template.name !== 'string' || template.name === '') {
      errors.push('Template name is required');
    }
    
    // Validate syntax for each field
    if (typeof template.subject === 'string') {
      const subjectErrors = validateTemplateSyntax(template.subject);
      errors.push(...subjectErrors.map(err => `Invalid template syntax in subject: ${err}`));
    }
    
    if (typeof template.html === 'string') {
      const htmlErrors = validateTemplateSyntax(template.html);
      errors.push(...htmlErrors.map(err => `Invalid template syntax in html: ${err}`));
    }
    
    if (typeof template.text === 'string') {
      const textErrors = validateTemplateSyntax(template.text);
      errors.push(...textErrors.map(err => `Invalid template syntax in text: ${err}`));
    }
    
    // Check for required variables usage
    if (template.requiredVariables != null && Array.isArray(template.requiredVariables)) {
      const joinedParts = [template.subject, template.html, template.text]
        .filter((part): part is string => typeof part === 'string')
        .join(' ');
      
      const templateVars = extractVariablesFromTemplate(joinedParts);
      
      for (const requiredVar of template.requiredVariables) {
        const varName = typeof requiredVar === 'string' ? requiredVar : String(requiredVar);
        if (!templateVars.includes(varName)) {
          errors.push(`Required variable "${varName}" not found in template`);
        }
      }
    }
    
    return {
      valid: errors.length === 0,
      errors
    };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown validation error';
    logError('Template validation failed', { error: errorMessage });
    
    return {
      valid: false,
      errors: [errorMessage]
    };
  }
};

// Get available templates
export const getAvailableTemplates = (): string[] => {
  return Object.keys(BUILT_IN_TEMPLATES);
};

// Get supported languages for a template
export const getSupportedLanguages = (templateType: string, channel: string): LanguageCode[] => {
  // Validate inputs
  if (!isSafeKey(templateType) || !Object.prototype.hasOwnProperty.call(BUILT_IN, templateType)) {
    return [];
  }
  
  const typeTemplates = getSafeTemplateType(templateType);
  if (!typeTemplates || (channel !== 'email' && channel !== 'sms')) {
    return [];
  }
  
  if (!Object.prototype.hasOwnProperty.call(typeTemplates, channel)) {
    return [];
  }
  
  const channelTemplates = getSafeChannelGroup(typeTemplates, channel);
  if (!channelTemplates) {
    return [];
  }
  
  return Object.keys(channelTemplates) as LanguageCode[];
};

// Preview template with sample data
export const previewTemplate = async (
  templateType: string,
  channel: string,
  language: LanguageCode = 'en'
): Promise<TemplateRenderResult> => {
  // Satisfy require-await rule
  await Promise.resolve();
  
  const sampleData: TemplateData = {
    guestName: 'John Doe',
    referenceNumber: 'W12345678',
    locationName: 'Downtown Office',
    locationAddress: '123 Main St, City, State 12345',
    bookingDate: '2024-07-15',
    bookingTime: '10:00',
    duration: 60,
    serviceName: 'Consultation',
    hoursUntil: 24
  };
  
  logInfo('Previewing template', { templateType, channel, language });
  
  return renderTemplate(templateType, channel, sampleData, language);
}; 