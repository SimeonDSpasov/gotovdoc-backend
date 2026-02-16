import mongoose, { Schema } from 'mongoose';

import Config from './../config';

export interface ITrademarkOrder {
  orderId: string;
  status: 'pending' | 'paid' | 'processing' | 'submitted_to_bpo' | 'published' | 'registered' | 'rejected' | 'cancelled';
  customerData: {
    email: string;
    firstName: string;
    lastName: string;
    phone: string;
    address?: string;
    city?: string;
    postalCode?: string;
    isCompany: boolean;
    companyName?: string;
    companyEik?: string;
    companyAddress?: string;
    ip?: string;
  };
  trademarkData: {
    markType: 'word' | 'combined' | 'figurative' | 'other';
    markText?: string;
    markImageFileId?: mongoose.Types.ObjectId;
    goodsAndServices: string;
    niceClasses: number[];
    priorityDocument?: string;
  };
  deliveryMethod: 'email' | 'address';
  paymentData?: {
    method: 'stripe';
    transactionRef?: string;
    paidAmount?: number;
    paidAt?: Date;
    checkoutSessionId?: string;
    paymentIntentId?: string;
    receiptUrl?: string;
  };
  pricing: {
    subtotal: number;
    vat: number;
    total: number;
    currency: string;
  };
  documentId?: mongoose.Types.ObjectId;
  userId?: mongoose.Types.ObjectId;
  userUploadedFiles: Array<{
    fileId: mongoose.Types.ObjectId;
    filename: string;
    mimetype: string;
    size: number;
    uploadedAt?: Date;
  }>;
  adminNotes?: string;
  finishedFiles?: Array<{
    filename: string;
    originalName: string;
    path: string;
    size: number;
    mimetype: string;
    uploadedAt?: Date;
  }>;
  paidAt?: Date;
  failedAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

const TrademarkOrderSchema: Schema = new Schema(
  {
    orderId: {
      type: String,
      required: true,
      unique: true,
      index: true,
    },
    status: {
      type: String,
      enum: ['pending', 'paid', 'processing', 'submitted_to_bpo', 'published', 'registered', 'rejected', 'cancelled'],
      default: 'pending',
      index: true,
    },
    customerData: {
      email: { type: String, required: true },
      firstName: { type: String, required: true },
      lastName: { type: String, required: true },
      phone: { type: String, required: true },
      address: String,
      city: String,
      postalCode: String,
      isCompany: { type: Boolean, default: false },
      companyName: String,
      companyEik: String,
      companyAddress: String,
      ip: String,
    },
    trademarkData: {
      markType: {
        type: String,
        enum: ['word', 'combined', 'figurative', 'other'],
        required: true,
      },
      markText: String,
      markImageFileId: {
        type: mongoose.Schema.Types.ObjectId,
        required: false,
      },
      goodsAndServices: { type: String, required: true },
      niceClasses: {
        type: [Number],
        required: true,
        validate: {
          validator: (v: number[]) => v.length > 0,
          message: 'At least one Nice class is required',
        },
      },
      priorityDocument: String,
    },
    deliveryMethod: {
      type: String,
      enum: ['email', 'address'],
      default: 'email',
    },
    paymentData: {
      method: { type: String, default: 'stripe' },
      transactionRef: String,
      paidAmount: Number,
      paidAt: Date,
      checkoutSessionId: String,
      paymentIntentId: String,
      receiptUrl: String,
    },
    pricing: {
      subtotal: { type: Number, required: true },
      vat: { type: Number, required: true },
      total: { type: Number, required: true },
      currency: { type: String, required: true, default: 'EUR' },
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
    adminNotes: {
      type: String,
      default: '',
    },
    finishedFiles: {
      type: [{
        filename: { type: String, required: true },
        originalName: { type: String, required: true },
        path: { type: String, required: true },
        size: { type: Number, required: true },
        mimetype: { type: String, required: true },
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
    collection: 'trademark_orders',
  }
);

// Index for user orders
TrademarkOrderSchema.index({ userId: 1, createdAt: -1 });

// Get database connection
const db = mongoose.connection.useDb(Config.getInstance().databases.main);
const TrademarkOrder = db.model<ITrademarkOrder>('TrademarkOrder', TrademarkOrderSchema);

type TrademarkOrderDoc = ReturnType<(typeof TrademarkOrder)['hydrate']>;

export { TrademarkOrder, TrademarkOrderDoc, TrademarkOrderSchema };
