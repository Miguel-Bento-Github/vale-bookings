import { Router } from 'express';

import * as PaymentController from '../controllers/PaymentController';
import { authenticate } from '../middleware/auth';

const router = Router();

// Calculate price (public endpoint)
router.post('/calculate', (req, res, next) => {
  PaymentController.calculatePrice(req, res).catch(next);
});

// Create payment intent (authentication required)
router.post('/intent', authenticate, (req, res, next) => {
  PaymentController.createPaymentIntent(req, res).catch(next);
});

// Stripe webhook (no auth, uses signature header)
router.post('/webhook', (req, res, next) => {
  PaymentController.handleWebhook(req, res).catch(next);
});

export default router; 