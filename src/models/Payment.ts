import mongoose, { Schema } from 'mongoose';

import { IPaymentDocument } from '../types/payment';

const PaymentSchema: Schema<IPaymentDocument> = new Schema(
  {
    bookingId: {
      type: Schema.Types.ObjectId,
      ref: 'Booking',
      required: [true, 'Booking ID is required']
    },
    userId: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: [true, 'User ID is required']
    },
    stripePaymentIntentId: {
      type: String,
      required: true,
      index: true
    },
    stripeCustomerId: {
      type: String
    },
    amount: {
      type: Number,
      required: true,
      min: [0, 'Amount must be positive']
    },
    currency: {
      type: String,
      required: true,
      uppercase: true,
      minlength: 3,
      maxlength: 3
    },
    status: {
      type: String,
      enum: ['PENDING', 'PROCESSING', 'COMPLETED', 'FAILED', 'REFUNDED', 'PARTIALLY_REFUNDED'],
      default: 'PENDING'
    },
    paymentMethod: {
      type: String,
      enum: ['CARD', 'SEPA', 'IDEAL', 'BANCONTACT', 'GIROPAY', 'SOFORT'],
      required: true
    },
    description: {
      type: String,
      trim: true,
      maxlength: 255
    },
    metadata: {
      type: Schema.Types.Mixed,
      default: {}
    },
    failureReason: String,
    refundAmount: Number,
    refundReason: String,
    processedAt: Date,
    refundedAt: Date
  },
  {
    timestamps: true
  }
);

// Indexes for queries
PaymentSchema.index({ userId: 1, createdAt: -1 });
PaymentSchema.index({ bookingId: 1 });

export default mongoose.model<IPaymentDocument>('Payment', PaymentSchema); 