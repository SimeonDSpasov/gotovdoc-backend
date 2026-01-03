import mongoose, { ObjectId, Schema, Types } from 'mongoose';

import bcryptjs from 'bcryptjs';

import ErrorUtil from './../utils/error.util';
import Config from './../config';


export enum DocumentType {
  Speciment,
  Certificate,
  License,
  Passport,
  ID,
  BirthCertificate,
  MarriageCertificate,
  DivorceCertificate,
  DeathCertificate,
  OtherCertificate,
  OtherLicense,
  OtherPassport,
  OtherID,
  OtherBirthCertificate,
  OtherMarriageCertificate,
  OtherDivorceCertificate,
  OtherDeathCertificate,
  OtherOther,
  Other,
}

export interface DocumentData {
  [key: string]: any;
}

export interface DocumentOrder {
  userId?: ObjectId;
  email: string;
  cost: number;
  paid?: boolean;
  paymentLinkId?: string;
  paidAt?: Date;
  failedAt?: Date;
  amount?: number;
  currency?: string;
}

interface IDocument {
  type: DocumentType;
  data: DocumentData;
  orderData?: DocumentOrder;
  createdAt: Date;
}

const DocumentSchema = new mongoose.Schema<IDocument>({
  type: {
    type: Number,
    required: true,
    enum: DocumentType,
  },
  data: {
    type: Object,
    required: true,
  },
  orderData: {
    type: Object,
    required: false,
  },
},
{
  timestamps: true,
  collection: 'Documents'
})

DocumentSchema.set('toJSON', {
  virtuals: true,
  versionKey: false,
  transform: function (doc: any, ret: any) { delete ret._id; delete ret.password }
});

DocumentSchema.set('toObject', {
  virtuals: true,
  versionKey: false,
  transform: function (doc: any, ret: any) { delete ret._id; delete ret.password }
});

const db = mongoose.connection.useDb(Config.getInstance().databases.main);
const Document = db.model<IDocument>('Document', DocumentSchema);

type DocumentDoc = ReturnType<(typeof Document)['hydrate']>;

export { Document, DocumentDoc, IDocument };
