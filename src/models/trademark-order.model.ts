import mongoose, { Schema } from 'mongoose';

import Config from './../config';

// ── Reusable sub-schema for file references stored in GridFS ──

const fileRefFields = {
  fileId: { type: mongoose.Schema.Types.ObjectId, required: true },
  filename: { type: String, required: true },
  mimetype: { type: String, required: true },
  size: { type: Number, required: true },
  uploadedAt: { type: Date, default: () => new Date() },
};

// ── File reference interface ──

interface IFileRef {
  fileId: mongoose.Types.ObjectId;
  filename: string;
  mimetype: string;
  size: number;
  uploadedAt?: Date;
}

// ── Main interface ──

export interface ITrademarkOrder {
  orderId: string;
  status: 'draft' | 'pending' | 'paid' | 'processing' | 'submitted_to_bpo' | 'published' | 'registered' | 'rejected' | 'cancelled';
  lastStep?: number;

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
    markType: 'word' | 'figurative' | 'combined' | '3d' | 'color' | 'sound'
      | 'hologram' | 'position' | 'pattern' | 'motion' | 'multimedia' | 'other';
    markText?: string;
    markImageFileId?: mongoose.Types.ObjectId;
    description?: string;
    isCollective: boolean;
    isCertified: boolean;
    goodsAndServices: string;
    niceClasses: number[];
    customTerms: Record<string, string>;
    selectedTerms: Record<string, Array<{
      text: string;
      classNumber: number;
      conceptId?: string;
      status: string;
    }>>;
    priorityClaims: Array<{
      country: string;
      applicationDate: string;
      applicationNumber: string;
      certificateAttached: boolean;
      partialPriority: boolean;
    }>;
    exhibitionPriorities: Array<{
      exhibitionName: string;
      firstShowingDate: string;
      documentAttached: boolean;
    }>;
    hasInternationalTransformation: boolean;
    internationalRegistrationNumber?: string;
    hasEuConversion: boolean;
    euConversion?: {
      euTrademarkNumber: string;
      manualEntry: boolean;
      applicationDate?: string;
      priorityDate?: string;
    };
  };

  correspondenceAddress: {
    fullName: string;
    streetAddress: string;
    city: string;
    postalCode: string;
    country: string;
  };

  powerOfAttorneyData?: {
    managerFullName: string;
    managerEgn: string;
    managerAddress: string;
    companyName: string;
    companyType: string;
    city: string;
  };

  powerOfAttorneyDelivery?: 'upload' | 'physical';
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
  claimToken?: string;

  // Categorized file references
  markFile?: IFileRef;
  collectiveFile?: IFileRef;
  certifiedFile?: IFileRef;
  poaFiles: IFileRef[];
  conventionCertificateFiles: IFileRef[];
  exhibitionDocumentFiles: IFileRef[];
  additionalFiles: IFileRef[];

  // Backward-compatible flat list of all uploaded files
  userUploadedFiles: IFileRef[];

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

// ── Schema ──

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
      enum: ['draft', 'pending', 'paid', 'processing', 'submitted_to_bpo', 'published', 'registered', 'rejected', 'cancelled'],
      default: 'pending',
      index: true,
    },
    lastStep: {
      type: Number,
      required: false,
    },

    // ── Customer Data ──
    customerData: {
      email: { type: String },
      firstName: { type: String },
      lastName: { type: String },
      phone: { type: String },
      address: String,
      city: String,
      postalCode: String,
      isCompany: { type: Boolean, default: false },
      companyName: String,
      companyEik: String,
      companyAddress: String,
      ip: String,
    },

    // ── Trademark Data ──
    trademarkData: {
      markType: {
        type: String,
        enum: ['word', 'figurative', 'combined', '3d', 'color', 'sound',
               'hologram', 'position', 'pattern', 'motion', 'multimedia', 'other'],
      },
      markText: String,
      markImageFileId: {
        type: mongoose.Schema.Types.ObjectId,
        required: false,
      },
      description: String,
      isCollective: { type: Boolean, default: false },
      isCertified: { type: Boolean, default: false },
      goodsAndServices: { type: String, default: '' },
      niceClasses: {
        type: [Number],
        default: [],
      },
      customTerms: { type: Schema.Types.Mixed, default: {} },
      selectedTerms: { type: Schema.Types.Mixed, default: {} },
      priorityClaims: {
        type: [{
          country: { type: String, required: true },
          applicationDate: { type: String, required: true },
          applicationNumber: { type: String, required: true },
          certificateAttached: { type: Boolean, default: false },
          partialPriority: { type: Boolean, default: false },
        }],
        default: [],
      },
      exhibitionPriorities: {
        type: [{
          exhibitionName: { type: String, required: true },
          firstShowingDate: { type: String, required: true },
          documentAttached: { type: Boolean, default: false },
        }],
        default: [],
      },
      hasInternationalTransformation: { type: Boolean, default: false },
      internationalRegistrationNumber: String,
      hasEuConversion: { type: Boolean, default: false },
      euConversion: {
        euTrademarkNumber: String,
        manualEntry: { type: Boolean, default: false },
        applicationDate: String,
        priorityDate: String,
      },
    },

    // ── Correspondence Address ──
    correspondenceAddress: {
      fullName: { type: String },
      streetAddress: { type: String },
      city: { type: String },
      postalCode: { type: String },
      country: { type: String },
    },

    // ── Power of Attorney ──
    powerOfAttorneyData: {
      managerFullName: String,
      managerEgn: String,
      managerAddress: String,
      companyName: String,
      companyType: String,
      city: String,
    },
    powerOfAttorneyDelivery: {
      type: String,
      enum: ['upload', 'physical'],
    },

    deliveryMethod: {
      type: String,
      enum: ['email', 'address'],
      default: 'email',
    },

    // ── Payment ──
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
      subtotal: { type: Number, default: 0 },
      vat: { type: Number, default: 0 },
      total: { type: Number, default: 0 },
      currency: { type: String, default: 'EUR' },
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
    claimToken: {
      type: String,
      required: false,
      index: true,
    },

    // ── Categorized Files ──
    markFile: { type: fileRefFields, required: false },
    collectiveFile: { type: fileRefFields, required: false },
    certifiedFile: { type: fileRefFields, required: false },
    poaFiles: { type: [fileRefFields], default: [] },
    conventionCertificateFiles: { type: [fileRefFields], default: [] },
    exhibitionDocumentFiles: { type: [fileRefFields], default: [] },
    additionalFiles: { type: [fileRefFields], default: [] },

    // ── Backward-compatible flat file list ──
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
