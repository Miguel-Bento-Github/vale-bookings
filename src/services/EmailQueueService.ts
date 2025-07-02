import { logInfo, logWarning, logError } from '../utils/logger';

import { sendEmail, EmailMessage } from './EmailService';

export interface QueuedEmail extends EmailMessage {
  id: string;
  priority: 'high' | 'normal' | 'low';
  retryCount: number;
  maxRetries: number;
  createdAt: Date;
  scheduledFor?: Date;
}

export interface EmailQueueConfig {
  maxConcurrent: number;
  rateLimitPerSecond: number;
  retryDelays: number[]; // milliseconds
  maxRetries: number;
}

export class EmailQueueService {
  private queue: QueuedEmail[] = [];
  private processing = false;
  private config: EmailQueueConfig;
  private lastSentTime = 0;

  constructor(config: Partial<EmailQueueConfig> = {}) {
    this.config = {
      maxConcurrent: config.maxConcurrent ?? 1,
      rateLimitPerSecond: config.rateLimitPerSecond ?? 1.5, // Under Resend's 2/sec limit
      retryDelays: config.retryDelays ?? [1000, 2000, 5000], // 1s, 2s, 5s
      maxRetries: config.maxRetries ?? 3
    };
  }

  /**
   * Add email to queue
   */
  enqueue(email: Omit<EmailMessage, 'id'>, options: {
    priority?: 'high' | 'normal' | 'low';
    scheduledFor?: Date;
  } = {}): string {
    const queuedEmail: QueuedEmail = {
      ...email,
      id: this.generateId(),
      priority: options.priority ?? 'normal',
      retryCount: 0,
      maxRetries: this.config.maxRetries,
      createdAt: new Date(),
      scheduledFor: options.scheduledFor
    };

    // Insert based on priority
    const insertIndex = this.queue.findIndex(item => {
      if (queuedEmail.priority === 'high' && item.priority !== 'high') return true;
      if (queuedEmail.priority === 'normal' && item.priority === 'low') return true;
      return false;
    });

    if (insertIndex === -1) {
      this.queue.push(queuedEmail);
    } else {
      this.queue.splice(insertIndex, 0, queuedEmail);
    }

    logInfo('Email queued', { 
      id: queuedEmail.id, 
      priority: queuedEmail.priority,
      queueLength: this.queue.length 
    });

    // Start processing if not already running
    if (!this.processing) {
      void this.processQueue();
    }

    return queuedEmail.id;
  }

  /**
   * Process the email queue
   */
  private async processQueue(): Promise<void> {
    if (this.processing) return;

    this.processing = true;
    logInfo('Starting email queue processing', { queueLength: this.queue.length });

    while (this.queue.length > 0) {
      const now = new Date();
      const readyEmails = this.queue.filter(email => 
        !email.scheduledFor || email.scheduledFor <= now
      );

      if (readyEmails.length === 0) {
        // Wait for scheduled emails
        await this.delay(1000);
        continue;
      }

      const email = readyEmails[0];
      if (!email) continue;
      
      this.queue = this.queue.filter(e => e.id !== email.id);

      try {
        // Rate limiting
        await this.waitForRateLimit();

        logInfo('Processing queued email', { 
          id: email.id, 
          to: email.to,
          priority: email.priority 
        });

        const result = await sendEmail(email);

        if (result.success) {
          logInfo('Queued email sent successfully', { 
            id: email.id, 
            messageId: result.messageId 
          });
        } else {
          this.handleFailedEmail(email, result.error ?? 'Unknown error');
        }
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';
        this.handleFailedEmail(email, errorMessage);
      }
    }

    this.processing = false;
    logInfo('Email queue processing completed');
  }

  /**
   * Handle failed email sending
   */
  private handleFailedEmail(email: QueuedEmail, error: string): void {
    email.retryCount++;

    if (email.retryCount <= email.maxRetries) {
      const delay = this.config.retryDelays[email.retryCount - 1] ?? 
                   this.config.retryDelays[this.config.retryDelays.length - 1] ?? 5000;
      
      const retryAt = new Date(Date.now() + delay);
      
      logWarning('Email failed, scheduling retry', { 
        id: email.id, 
        retryCount: email.retryCount,
        retryAt: retryAt.toISOString(),
        error 
      });

      // Re-queue with delay
      email.scheduledFor = retryAt;
      this.queue.push(email);
    } else {
      logError('Email failed after max retries', { 
        id: email.id, 
        retryCount: email.retryCount,
        error 
      });
      
      // Could emit event or store in failed emails table
      // await this.storeFailedEmail(email, error);
    }
  }

  /**
   * Wait for rate limit
   */
  private async waitForRateLimit(): Promise<void> {
    const now = Date.now();
    const timeSinceLastSent = now - this.lastSentTime;
    const minInterval = 1000 / this.config.rateLimitPerSecond;

    if (timeSinceLastSent < minInterval) {
      const waitTime = minInterval - timeSinceLastSent;
      await this.delay(waitTime);
    }

    this.lastSentTime = Date.now();
  }

  /**
   * Get queue status
   */
  getStatus(): {
    queueLength: number;
    processing: boolean;
    config: EmailQueueConfig;
    } {
    return {
      queueLength: this.queue.length,
      processing: this.processing,
      config: this.config
    };
  }

  /**
   * Clear queue (useful for testing)
   */
  clear(): void {
    this.queue = [];
    logInfo('Email queue cleared');
  }

  /**
   * Generate unique ID for queued emails
   */
  private generateId(): string {
    return `email_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Utility delay function
   */
  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

// Export singleton instance
export const emailQueueService = new EmailQueueService(); 