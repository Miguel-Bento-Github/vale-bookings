import { EmailWebhookService, EmailWebhookEvent } from '../../../src/services/EmailWebhookService';

describe('EmailWebhookService', () => {
  describe('handleWebhookEvent', () => {
    it('should handle email delivered event', async () => {
      const event: EmailWebhookEvent = {
        type: 'email.delivered',
        data: {
          id: 'email-123',
          from: 'test@vale.com',
          to: 'customer@example.com',
          subject: 'Test Email',
          created_at: '2024-01-15T10:00:00Z'
        }
      };

      const result = await EmailWebhookService.handleWebhookEvent(event);

      expect(result.success).toBe(true);
      expect(result.message).toBe('Email delivered successfully');
    });

    it('should handle email bounced event', async () => {
      const event: EmailWebhookEvent = {
        type: 'email.bounced',
        data: {
          id: 'email-123',
          from: 'test@vale.com',
          to: 'customer@example.com',
          subject: 'Test Email',
          created_at: '2024-01-15T10:00:00Z',
          bounce_type: 'hard_bounce',
          bounce_data: {
            type: 'hard_bounce',
            description: 'User not found'
          }
        }
      };

      const result = await EmailWebhookService.handleWebhookEvent(event);

      expect(result.success).toBe(true);
      expect(result.action).toBe('remove_from_list');
      expect(result.message).toContain('Hard bounce');
    });

    it('should handle soft bounce event', async () => {
      const event: EmailWebhookEvent = {
        type: 'email.bounced',
        data: {
          id: 'email-123',
          from: 'test@vale.com',
          to: 'customer@example.com',
          subject: 'Test Email',
          created_at: '2024-01-15T10:00:00Z',
          bounce_type: 'soft_bounce',
          bounce_data: {
            type: 'soft_bounce',
            description: 'Mailbox full'
          }
        }
      };

      const result = await EmailWebhookService.handleWebhookEvent(event);

      expect(result.success).toBe(true);
      expect(result.action).toBe('retry_later');
      expect(result.message).toContain('Soft bounce');
    });

    it('should handle spam complaint event', async () => {
      const event: EmailWebhookEvent = {
        type: 'email.complained',
        data: {
          id: 'email-123',
          from: 'test@vale.com',
          to: 'customer@example.com',
          subject: 'Test Email',
          created_at: '2024-01-15T10:00:00Z',
          complaint_data: {
            type: 'spam',
            description: 'User marked as spam'
          }
        }
      };

      const result = await EmailWebhookService.handleWebhookEvent(event);

      expect(result.success).toBe(true);
      expect(result.action).toBe('remove_from_list');
      expect(result.message).toContain('Spam complaint');
    });

    it('should handle unsubscribe event', async () => {
      const event: EmailWebhookEvent = {
        type: 'email.unsubscribed',
        data: {
          id: 'email-123',
          from: 'test@vale.com',
          to: 'customer@example.com',
          subject: 'Test Email',
          created_at: '2024-01-15T10:00:00Z'
        }
      };

      const result = await EmailWebhookService.handleWebhookEvent(event);

      expect(result.success).toBe(true);
      expect(result.action).toBe('remove_from_list');
      expect(result.message).toContain('unsubscribed');
    });

    it('should handle delivery delayed event', async () => {
      const event: EmailWebhookEvent = {
        type: 'email.delivery_delayed',
        data: {
          id: 'email-123',
          from: 'test@vale.com',
          to: 'customer@example.com',
          subject: 'Test Email',
          created_at: '2024-01-15T10:00:00Z'
        }
      };

      const result = await EmailWebhookService.handleWebhookEvent(event);

      expect(result.success).toBe(true);
      expect(result.action).toBe('retry_later');
      expect(result.message).toContain('delayed');
    });

    it('should handle unknown event type', async () => {
      const event = {
        type: 'unknown.event' as any,
        data: {
          id: 'email-123',
          from: 'test@vale.com',
          to: 'customer@example.com',
          subject: 'Test Email',
          created_at: '2024-01-15T10:00:00Z'
        }
      } as EmailWebhookEvent;

      const result = await EmailWebhookService.handleWebhookEvent(event);

      expect(result.success).toBe(false);
      expect(result.message).toBe('Unknown event type');
    });

    it('should handle errors gracefully', async () => {
      // Mock a function that throws an error
      const originalHandleDelivered = EmailWebhookService['handleDelivered'];
      EmailWebhookService['handleDelivered'] = jest.fn().mockImplementation(() => {
        throw new Error('Test error');
      });

      const event: EmailWebhookEvent = {
        type: 'email.delivered',
        data: {
          id: 'email-123',
          from: 'test@vale.com',
          to: 'customer@example.com',
          subject: 'Test Email',
          created_at: '2024-01-15T10:00:00Z'
        }
      };

      const result = EmailWebhookService.handleWebhookEvent(event);

      expect(result.success).toBe(false);
      expect(result.message).toBe('Test error');

      // Restore original function
      EmailWebhookService['handleDelivered'] = originalHandleDelivered;
    });
  });

  describe('validateWebhookSignature', () => {
    it('should return true for now (placeholder)', () => {
      const result = EmailWebhookService.validateWebhookSignature(
        'payload',
        'signature',
        'secret'
      );

      expect(result).toBe(true);
    });
  });

  describe('getWebhookUrl', () => {
    it('should return webhook URL with default base URL', () => {
      delete process.env.API_BASE_URL;
      
      const url = EmailWebhookService.getWebhookUrl();
      
      expect(url).toBe('http://localhost:3000/api/webhooks/email');
    });

    it('should return webhook URL with custom base URL', () => {
      process.env.API_BASE_URL = 'https://api.vale.com';
      
      const url = EmailWebhookService.getWebhookUrl();
      
      expect(url).toBe('https://api.vale.com/api/webhooks/email');
    });
  });
}); 