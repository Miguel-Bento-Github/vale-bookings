import { Request, Response } from 'express';

import * as PaymentController from '../../../src/controllers/PaymentController';
import Location from '../../../src/models/Location';
import * as PaymentService from '../../../src/services/paymentService';
import { AuthenticatedRequest } from '../../../src/types/common';
import { UserRole } from '../../../src/types/user';
import { sendSuccess, sendError } from '../../../src/utils/responseHelpers';

jest.mock('../../../src/services/paymentService');
jest.mock('../../../src/utils/responseHelpers');
jest.mock('../../../src/models/Location');

const mockPaymentService = PaymentService as jest.Mocked<typeof PaymentService>;
const mockSendSuccess = sendSuccess as jest.Mock;
const mockSendError = sendError as jest.Mock;
const mockLocation = Location as jest.Mocked<typeof Location>;

describe('PaymentController', () => {
  let mockRequest: Partial<AuthenticatedRequest>;
  let mockResponse: Partial<Response>;

  beforeEach(() => {
    jest.clearAllMocks();
    mockRequest = {
      body: {},
      params: {},
      query: {},
      user: { 
        userId: 'user123',
        email: 'test@example.com',
        role: 'CUSTOMER' as UserRole
      }
    };
    mockResponse = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn().mockReturnThis()
    };
  });

  describe('calculatePrice', () => {
    it('should calculate price successfully', async () => {
      const priceData = {
        locationId: 'loc123',
        startTime: '2024-12-01T10:00:00Z',
        endTime: '2024-12-01T12:00:00Z'
      };
      mockRequest.body = priceData;

      // Mock Location.findById
      mockLocation.findById = jest.fn().mockResolvedValue({
        _id: 'loc123',
        name: 'Test Location',
        address: 'Test Address'
      });

      const mockResult = {
        baseAmount: 40,
        timeMultiplier: 1.0,
        dayMultiplier: 1.0,
        premiumMultiplier: 1.25,
        demandMultiplier: 1.0,
        totalAmount: 50
      };
      mockPaymentService.calculateDynamicPrice.mockReturnValue(mockResult);

      await PaymentController.calculatePrice(
        mockRequest as AuthenticatedRequest,
        mockResponse as Response
      );

      expect(mockPaymentService.calculateDynamicPrice).toHaveBeenCalledWith(
        {
          locationId: priceData.locationId,
          startTime: new Date(priceData.startTime),
          endTime: new Date(priceData.endTime)
        },
        expect.any(Object)
      );
      expect(mockSendSuccess).toHaveBeenCalledWith(
        mockResponse,
        mockResult,
        'Price calculated successfully'
      );
    });

    it('should return error for missing required fields', async () => {
      mockRequest.body = { locationId: 'loc123' };

      await PaymentController.calculatePrice(
        mockRequest as Request,
        mockResponse as Response
      );

      expect(mockSendError).toHaveBeenCalledWith(
        mockResponse,
        'Missing required fields',
        400
      );
    });

    it('should return error for invalid date format', async () => {
      mockRequest.body = {
        locationId: 'loc123',
        startTime: 'invalid-date',
        endTime: '2024-12-01T12:00:00Z'
      };

      await PaymentController.calculatePrice(
        mockRequest as Request,
        mockResponse as Response
      );

      expect(mockSendError).toHaveBeenCalledWith(
        mockResponse,
        'Invalid date format',
        400
      );
    });
  });

  describe('createPaymentIntent', () => {
    it('should create payment intent successfully', async () => {
      const paymentData = {
        bookingId: 'booking123',
        amount: 5000, // in cents
        currency: 'EUR',
        paymentMethod: 'CARD'
      };
      mockRequest.body = paymentData;

      const mockIntent = {
        paymentIntentId: 'pi_123',
        clientSecret: 'secret_123',
        amount: 5000,
        currency: 'eur'
      };
      (mockPaymentService.createPaymentIntent as jest.Mock) = jest.fn().mockResolvedValue(mockIntent);

      await PaymentController.createPaymentIntent(
        mockRequest as Request,
        mockResponse as Response
      );

      expect(mockPaymentService.createPaymentIntent).toHaveBeenCalledWith({
        bookingId: paymentData.bookingId,
        amount: paymentData.amount,
        currency: paymentData.currency,
        paymentMethod: paymentData.paymentMethod,
        customerId: 'user123',
        savePaymentMethod: false
      });
      expect(mockSendSuccess).toHaveBeenCalledWith(
        mockResponse,
        mockIntent,
        'Payment intent created successfully'
      );
    });

    it('should return error for missing amount', async () => {
      mockRequest.body = {
        bookingId: 'booking123',
        currency: 'EUR'
      };

      await PaymentController.createPaymentIntent(
        mockRequest as Request,
        mockResponse as Response
      );

      expect(mockSendError).toHaveBeenCalledWith(
        mockResponse,
        'Missing required fields',
        400
      );
    });
  });

  describe('handleWebhook', () => {
    it('should handle stripe webhook successfully', async () => {
      mockRequest.headers = { 'stripe-signature': 'sig_123' };
      mockRequest.body = { rawBody: 'webhook_payload' };

      (mockPaymentService.handleStripeWebhook as jest.Mock) = jest.fn().mockResolvedValue(undefined);

      await PaymentController.handleWebhook(
        mockRequest as Request,
        mockResponse as Response
      );

      expect(mockPaymentService.handleStripeWebhook).toHaveBeenCalledWith(
        'sig_123',
        'webhook_payload'
      );
      expect(mockResponse.json).toHaveBeenCalledWith({ received: true });
    });

    it('should return error for missing signature', async () => {
      mockRequest.headers = {};
      mockRequest.body = { rawBody: 'webhook_payload' };

      await PaymentController.handleWebhook(
        mockRequest as Request,
        mockResponse as Response
      );

      expect(mockSendError).toHaveBeenCalledWith(
        mockResponse,
        'Missing stripe signature',
        400
      );
    });
  });
}); 