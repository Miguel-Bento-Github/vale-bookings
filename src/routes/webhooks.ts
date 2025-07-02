import { Router, Request, Response } from 'express';

import { EmailWebhookService, EmailWebhookEvent } from '../services/EmailWebhookService';
import { logInfo, logError } from '../utils/logger';

const router = Router();

/**
 * Email webhook endpoint for Resend
 * Handles email delivery events, bounces, complaints, etc.
 */
router.post('/email', (req: Request, res: Response): void => {
  void (async () => {
    try {
      logInfo('Email webhook received', {
        headers: req.headers,
        body: req.body,
        ip: req.ip
      });

      // Validate webhook payload
      if (req.body == null || typeof req.body !== 'object') {
        logError('Invalid webhook payload', { body: req.body });
        res.status(400).json({
          success: false,
          error: 'Invalid webhook payload'
        });
        return;
      }

      // Extract webhook event
      const event = req.body as Record<string, unknown>;
      
      if (event.type == null || event.data == null) {
        logError('Missing webhook event data', { event });
        res.status(400).json({
          success: false,
          error: 'Missing webhook event data'
        });
        return;
      }

      // Process the webhook event
      const result = await EmailWebhookService.handleWebhookEvent(event as unknown as EmailWebhookEvent);

      if (result.success) {
        logInfo('Webhook processed successfully', {
          type: event.type,
          action: result.action,
          message: result.message
        });

        res.json({
          success: true,
          message: result.message,
          action: result.action
        });
      } else {
        logError('Webhook processing failed', {
          type: event.type,
          error: result.message
        });

        res.status(500).json({
          success: false,
          error: result.message
        });
      }

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      logError('Webhook endpoint error', { error: errorMessage });
      
      res.status(500).json({
        success: false,
        error: 'Internal server error'
      });
    }
  })();
});

/**
 * Webhook health check endpoint
 */
router.get('/email/health', (req: Request, res: Response) => {
  res.json({
    success: true,
    message: 'Email webhook endpoint is healthy',
    timestamp: new Date().toISOString(),
    webhookUrl: EmailWebhookService.getWebhookUrl()
  });
});

export default router; 