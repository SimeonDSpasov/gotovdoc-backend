import mongoose, { Document, Schema } from 'mongoose';

import ConnectionManager from '../connection-manager';
import Config from './../config';

export interface IOrder extends Document {
  orderId: string;
  userId?: mongoose.Types.ObjectId;
  items: Array<{
    id: string;
    type: 'document' | 'package';
    name: string;
    description: string;
    price: number;
    formData: Record<string, any>;
    documentIds?: string[];
  }>;
  subtotal: number;
  vat: number;
  total: number;
  expectedAmount: number; // Amount we expect to receive (for validation)
  paidAmount?: number; // Actual amount paid
  currency: string;
  status: 'pending' | 'paid' | 'failed' | 'processing' | 'fraud_attempt' | 'cancelled';
  paymentMethod: 'mypos_embedded';
  paymentData?: {
    transactionRef?: string; // IPC_Trnref from myPOS
    cardMask?: string;
    authCode?: string;
    paymentReference?: string;
  };
  customerData: {
    email?: string;
    firstName?: string;
    lastName?: string;
    phone?: string;
    ip?: string;
  };
  documentsGenerated: boolean;
  documentsSent: boolean;
  createdAt: Date;
  updatedAt: Date;
  paidAt?: Date;
  failedAt?: Date;
  expiresAt?: Date;
}

const OrderSchema: Schema = new Schema(
  {
    orderId: {
      type: String,
      required: true,
      unique: true,
      index: true,
    },
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: false,
    },
    items: {
      type: [{
        id: { type: String, required: true },
        type: { type: String, enum: ['document', 'package'], required: true },
        name: { type: String, required: true },
        description: String,
        price: { type: Number, required: true },
        formData: { type: Schema.Types.Mixed, required: true },
        documentIds: [String],
      }],
      required: true,
    },
    subtotal: {
      type: Number,
      required: true,
    },
    vat: {
      type: Number,
      required: true,
    },
    total: {
      type: Number,
      required: true,
    },
    expectedAmount: {
      type: Number,
      required: true,
    },
    paidAmount: Number,
    currency: {
      type: String,
      required: true,
      default: 'EUR',
    },
    status: {
      type: String,
      enum: ['pending', 'paid', 'failed', 'processing', 'fraud_attempt', 'cancelled'],
      default: 'pending',
      index: true,
    },
    paymentMethod: {
      type: String,
      default: 'mypos_embedded',
    },
    paymentData: {
      transactionRef: String,
      cardMask: String,
      authCode: String,
      paymentReference: String,
    },
    customerData: {
      email: String,
      firstName: String,
      lastName: String,
      phone: String,
      ip: String,
    },
    documentsGenerated: {
      type: Boolean,
      default: false,
    },
    documentsSent: {
      type: Boolean,
      default: false,
    },
    paidAt: Date,
    failedAt: Date,
    expiresAt: {
      type: Date,
      default: () => new Date(Date.now() + 24 * 60 * 60 * 1000), // 24 hours
    },
  },
  {
    timestamps: true,
    collection: 'orders',
  }
);

// Index for cleanup of expired orders
OrderSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

// Index for user orders
OrderSchema.index({ userId: 1, createdAt: -1 });

// Get database connection
const db = mongoose.connection.useDb(Config.getInstance().databases.main);
const Order = db.model<IOrder>('Order', OrderSchema);

type OrderDoc = ReturnType<(typeof Order)['hydrate']>;

export { Order, OrderDoc, OrderSchema };

