import mongoose, { Document, Schema } from 'mongoose';

import ConnectionManager from './../connection-manager';
import Config from './../config';

export interface IOrder {
  orderId: string;
  documentId?: mongoose.Types.ObjectId; // Reference to the Document collection
  userId?: mongoose.Types.ObjectId;
  userUploadedFiles?: Array<{
    fileId: mongoose.Types.ObjectId;
    filename: string;
    mimetype: string;
    size: number;
    uploadedAt?: Date;
  }>;
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
  status: 'pending' | 'paid' | 'finished' | 'failed' | 'processing' | 'fraud_attempt' | 'cancelled';
  paymentMethod: 'stripe';
  paymentData?: {
    transactionRef?: string;
    checkoutSessionId?: string;
    paymentIntentId?: string;
    receiptUrl?: string;
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
  deliveryMethod?: 'upload' | 'physical' | 'download';
  finishedFiles?: Array<{
    fileId: mongoose.Types.ObjectId;
    filename: string;
    mimetype: string;
    size: number;
    uploadedAt?: Date;
  }>;
  createdAt: Date;
  updatedAt: Date;
  paidAt?: Date;
  failedAt?: Date;
}

const OrderSchema: Schema = new Schema(
  {
    orderId: {
      type: String,
      required: true,
      unique: true,
      index: true,
    },
    documentId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Document',
      required: false,
      index: true,
    },
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: false,
    },
    userUploadedFiles: {
      type: [{
        fileId: { type: mongoose.Schema.Types.ObjectId, required: true },
        filename: { type: String, required: true },
        mimetype: { type: String, required: true },
        size: { type: Number, required: true },
        uploadedAt: { type: Date, default: () => new Date() },
      }],
      required: false,
      default: [],
    },
    items: {
      type: [{
        id: { type: String, required: true },
        type: { type: String, enum: ['document', 'package'], required: true },
        name: { type: String, required: true },
        description: String,
        price: { type: Number, required: true },
        formData: { type: Schema.Types.Mixed, default: {} },
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
      enum: ['pending', 'paid', 'finished', 'failed', 'processing', 'fraud_attempt', 'cancelled'],
      default: 'pending',
      index: true,
    },
    paymentMethod: {
      type: String,
      default: 'stripe',
    },
    paymentData: {
      transactionRef: String,
      checkoutSessionId: String,
      paymentIntentId: String,
      receiptUrl: String,
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
    deliveryMethod: {
      type: String,
      enum: ['upload', 'physical', 'download'],
      required: false
    },
    finishedFiles: {
      type: [{
        fileId: { type: mongoose.Schema.Types.ObjectId, required: true },
        filename: { type: String, required: true },
        mimetype: { type: String, required: true },
        size: { type: Number, required: true },
        uploadedAt: { type: Date, default: () => new Date() },
      }],
      required: false,
      default: [],
    },
    paidAt: Date,
    failedAt: Date,
  },
  {
    timestamps: true,
    collection: 'orders',
  }
);

// Index for user orders
OrderSchema.index({ userId: 1, createdAt: -1 });

// Get database connection
const db = mongoose.connection.useDb(Config.getInstance().databases.main);
const Order = db.model<IOrder>('Order', OrderSchema);

type OrderDoc = ReturnType<(typeof Order)['hydrate']>;

export { Order, OrderDoc, OrderSchema };
