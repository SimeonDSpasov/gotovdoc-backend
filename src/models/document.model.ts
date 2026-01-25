import mongoose, { ObjectId, Schema, Types } from 'mongoose';

import bcryptjs from 'bcryptjs';

import ErrorUtil from './../utils/error.util';
import Config from './../config';

export enum DocumentType {
  Speciment,
  PowerOfAttorney,
  MpsPowerOfAttorney,
  LeaveRequest,
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

interface IDocument {
  type: DocumentType;
  data: DocumentData;
  orderId?: ObjectId;
  userId?: ObjectId;
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
  orderId: {
    type: Schema.Types.ObjectId,
    ref: 'Order',
    required: false,
    index: true,
  },
  userId: {
    type: Schema.Types.ObjectId,
    ref: 'User',
    required: false,
    index: true,
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
