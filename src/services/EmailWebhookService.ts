import { logInfo, logWarning, logError } from '../utils/logger';

export interface EmailWebhookEvent {
  type: 'email.delivered' | 'email.delivery_delayed' | 'email.bounced' | 'email.complained' | 'email.unsubscribed';
  data: {
    id: string;
    from: string;
    to: string;
    subject: string;
    created_at: string;
    // Bounce specific
    bounce_type?: 'hard_bounce' | 'soft_bounce';
    bounce_data?: {
      type: string;
      description: string;
    };
    // Complaint specific
    complaint_data?: {
      type: string;
      description: string;
    };
  };
}

export interface WebhookHandlerResult {
  success: boolean;
  action?: 'remove_from_list' | 'mark_as_bounced' | 'mark_as_complained' | 'retry_later';
  message?: string;
}

export class EmailWebhookService {
  /**
   * Handle incoming webhook events from Resend
   */
  static handleWebhookEvent(event: EmailWebhookEvent): WebhookHandlerResult {
    try {
      logInfo('Processing email webhook event', { 
        type: event.type, 
        emailId: event.data.id,
        to: event.data.to 
      });

      switch (event.type) {
      case 'email.delivered':
        return this.handleDelivered(event);
      
      case 'email.delivery_delayed':
        return this.handleDeliveryDelayed(event);
      
      case 'email.bounced':
        return this.handleBounced(event);
      
      case 'email.complained':
        return this.handleComplained(event);
      
      case 'email.unsubscribed':
        return this.handleUnsubscribed(event);
      
      default:
        logWarning('Unknown webhook event type', { type: event.type });
        return { success: false, message: 'Unknown event type' };
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      logError('Webhook event processing failed', { 
        error: errorMessage, 
        eventType: event.type 
      });
      return { success: false, message: errorMessage };
    }
  }

  /**
   * Handle successful email delivery
   */
  private static handleDelivered(event: EmailWebhookEvent): WebhookHandlerResult {
    logInfo('Email delivered successfully', { 
      emailId: event.data.id, 
      to: event.data.to 
    });

    // Update email status in database
    // await updateEmailStatus(event.data.id, 'delivered');

    return { 
      success: true, 
      message: 'Email delivered successfully' 
    };
  }

  /**
   * Handle delayed email delivery
   */
  private static handleDeliveryDelayed(event: EmailWebhookEvent): WebhookHandlerResult {
    logWarning('Email delivery delayed', { 
      emailId: event.data.id, 
      to: event.data.to 
    });

    // Update email status in database
    // await updateEmailStatus(event.data.id, 'delayed');

    return { 
      success: true, 
      action: 'retry_later',
      message: 'Email delivery delayed, will retry' 
    };
  }

  /**
   * Handle bounced emails
   */
  private static handleBounced(event: EmailWebhookEvent): WebhookHandlerResult {
    const bounceType = event.data.bounce_type ?? 'unknown';
    const bounceData = event.data.bounce_data;

    logError('Email bounced', { 
      emailId: event.data.id, 
      to: event.data.to,
      bounceType,
      bounceDescription: bounceData?.description 
    });

    // Handle hard bounces - remove from mailing list
    if (bounceType === 'hard_bounce') {
      // await removeFromMailingList(event.data.to);
      // await updateEmailStatus(event.data.id, 'bounced_hard');
      
      return { 
        success: true, 
        action: 'remove_from_list',
        message: 'Hard bounce - removed from mailing list' 
      };
    }

    // Handle soft bounces - mark for retry
    if (bounceType === 'soft_bounce') {
      // await updateEmailStatus(event.data.id, 'bounced_soft');
      
      return { 
        success: true, 
        action: 'retry_later',
        message: 'Soft bounce - will retry later' 
      };
    }

    return { 
      success: true, 
      action: 'mark_as_bounced',
      message: 'Email bounced' 
    };
  }

  /**
   * Handle spam complaints
   */
  private static handleComplained(event: EmailWebhookEvent): WebhookHandlerResult {
    const complaintData = event.data.complaint_data;

    logError('Email marked as spam', { 
      emailId: event.data.id, 
      to: event.data.to,
      complaintType: complaintData?.type,
      complaintDescription: complaintData?.description 
    });

    // Remove from mailing list immediately
    // await removeFromMailingList(event.data.to);
    // await updateEmailStatus(event.data.id, 'complained');

    return { 
      success: true, 
      action: 'remove_from_list',
      message: 'Spam complaint - removed from mailing list' 
    };
  }

  /**
   * Handle unsubscribe requests
   */
  private static handleUnsubscribed(event: EmailWebhookEvent): WebhookHandlerResult {
    logInfo('User unsubscribed', { 
      emailId: event.data.id, 
      to: event.data.to 
    });

    // Remove from mailing list
    // await removeFromMailingList(event.data.to);
    // await updateEmailStatus(event.data.id, 'unsubscribed');

    return { 
      success: true, 
      action: 'remove_from_list',
      message: 'User unsubscribed' 
    };
  }

  /**
   * Validate webhook signature (if Resend provides one)
   */
  static validateWebhookSignature(_payload: string, _signature: string, _secret: string): boolean {
    // TODO: Implement signature validation when Resend provides webhook signing
    // For now, return true as Resend doesn't seem to sign webhooks yet
    return true;
  }

  /**
   * Get webhook endpoint URL for Resend configuration
   */
  static getWebhookUrl(): string {
    const baseUrl = process.env.API_BASE_URL ?? 'http://localhost:3000';
    return `${baseUrl}/api/webhooks/email`;
  }
}

// Export singleton instance
export const emailWebhookService = new EmailWebhookService(); 