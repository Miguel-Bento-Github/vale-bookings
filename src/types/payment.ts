import { Document, Types } from 'mongoose';

export type PaymentStatus =
  | 'PENDING'
  | 'PROCESSING'
  | 'COMPLETED'
  | 'FAILED'
  | 'REFUNDED'
  | 'PARTIALLY_REFUNDED';

export type PaymentMethod =
  | 'CARD'
  | 'SEPA'
  | 'IDEAL'
  | 'BANCONTACT'
  | 'GIROPAY'
  | 'SOFORT';

export interface IPayment {
  readonly _id: Types.ObjectId;
  readonly bookingId: Types.ObjectId;
  readonly userId: Types.ObjectId;
  readonly stripePaymentIntentId: string;
  readonly stripeCustomerId?: string;
  readonly amount: number;
  readonly currency: string;
  readonly status: PaymentStatus;
  readonly paymentMethod: PaymentMethod;
  readonly description?: string;
  readonly metadata?: Record<string, string>;
  readonly failureReason?: string;
  readonly refundAmount?: number;
  readonly refundReason?: string;
  readonly processedAt?: Date;
  readonly refundedAt?: Date;
  readonly createdAt: Date;
  readonly updatedAt: Date;
}

export interface IPaymentDocument extends Document, Omit<IPayment, '_id'> {} 