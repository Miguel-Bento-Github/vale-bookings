import { Response } from 'express';

import Location from '../models/Location';
import * as PaymentService from '../services/paymentService';
import { AuthenticatedRequest } from '../types';
import { sendSuccess, sendError } from '../utils/responseHelpers';

export async function calculatePrice(req: AuthenticatedRequest, res: Response): Promise<void> {
  try {
    const { locationId, startTime, endTime } = req.body as {
      locationId?: string;
      startTime?: string;
      endTime?: string;
    };

    // Validate required fields
    if (locationId === undefined || locationId === '' ||
        startTime === undefined || startTime === '' ||
        endTime === undefined || endTime === '') {
      sendError(res, 'Missing required fields', 400);
      return;
    }

    // Validate date format
    const startDate = new Date(startTime);
    const endDate = new Date(endTime);
    
    if (isNaN(startDate.getTime()) || isNaN(endDate.getTime())) {
      sendError(res, 'Invalid date format', 400);
      return;
    }

    // Get location details
    const location = await Location.findById(locationId);
    if (!location) {
      sendError(res, 'Location not found', 404);
      return;
    }

    // Calculate price
    const priceResult = PaymentService.calculateDynamicPrice(
      {
        locationId,
        startTime: startDate,
        endTime: endDate
      },
      {
        baseRate: 15, // Default base rate $15/hour
        isPremium: false // TODO: Add premium field to Location model
      }
    );

    sendSuccess(res, priceResult, 'Price calculated successfully');
  } catch {
    sendError(res, 'Failed to calculate price', 500);
  }
}

export async function createPaymentIntent(req: AuthenticatedRequest, res: Response): Promise<void> {
  try {
    const { bookingId, amount, currency, paymentMethod, savePaymentMethod } = req.body as {
      bookingId?: string;
      amount?: number;
      currency?: string;
      paymentMethod?: string;
      savePaymentMethod?: boolean;
    };
    const userId = req.user?.userId;

    // Validate required fields
    if (bookingId === undefined || bookingId === '' ||
        amount === undefined || amount === 0 ||
        currency === undefined || currency === '' ||
        userId === undefined || userId === '') {
      sendError(res, 'Missing required fields', 400);
      return;
    }

    const paymentIntent = await PaymentService.createPaymentIntent({
      bookingId,
      amount,
      currency,
      paymentMethod: paymentMethod ?? 'CARD',
      customerId: userId,
      savePaymentMethod: savePaymentMethod ?? false
    });

    sendSuccess(res, paymentIntent, 'Payment intent created successfully');
  } catch {
    sendError(res, 'Failed to create payment intent', 500);
  }
}

export async function handleWebhook(req: AuthenticatedRequest, res: Response): Promise<void> {
  try {
    const signature = req.headers['stripe-signature'] as string | undefined;
    const { rawBody } = req.body as { rawBody?: string };

    if (signature === undefined || signature === '') {
      sendError(res, 'Missing stripe signature', 400);
      return;
    }

    if (rawBody === undefined || rawBody === '') {
      sendError(res, 'Missing webhook payload', 400);
      return;
    }

    await PaymentService.handleStripeWebhook(signature, rawBody);
    res.json({ received: true });
  } catch {
    sendError(res, 'Webhook processing failed', 500);
  }
} 