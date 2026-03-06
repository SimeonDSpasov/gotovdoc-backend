import mongoose, { Schema } from 'mongoose';

import Config from './../../config';

export interface IIgTarget {
 accountUsername: string;
 targetUsername: string;
 source: string;
 qualityScore: number;
 status: 'pending' | 'processed' | 'skipped' | 'filtered';
 followerCount: number | null;
 followingCount: number | null;
 postCount: number | null;
 isPrivate: boolean;
 processedAt: Date | null;
 createdAt: Date;
 updatedAt: Date;
}

const IgTargetSchema = new Schema<IIgTarget>(
 {
  accountUsername: { type: String, required: true },
  targetUsername: { type: String, required: true },
  source: { type: String, default: '' },
  qualityScore: { type: Number, default: 0 },
  status: { type: String, default: 'pending', enum: ['pending', 'processed', 'skipped', 'filtered'] },
  followerCount: { type: Number, default: null },
  followingCount: { type: Number, default: null },
  postCount: { type: Number, default: null },
  isPrivate: { type: Boolean, default: false },
  processedAt: { type: Date, default: null },
 },
 {
  timestamps: true,
  collection: 'ig-targets',
 }
);

IgTargetSchema.index({ accountUsername: 1, targetUsername: 1 }, { unique: true });
IgTargetSchema.index({ accountUsername: 1, status: 1, qualityScore: -1 });

const db = mongoose.connection.useDb(Config.getInstance().databases.main);
const IgTarget = db.model<IIgTarget>('IgTarget', IgTargetSchema);

type IgTargetDoc = ReturnType<(typeof IgTarget)['hydrate']>;

export { IgTarget, IgTargetDoc };
