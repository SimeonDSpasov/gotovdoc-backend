import mongoose, { Schema } from 'mongoose';

import Config from './../../config';

export interface IIgFollow {
 accountUsername: string;
 targetUsername: string;
 followedAt: Date;
 unfollowAfter: Date;
 followedBack: boolean;
 unfollowedAt: Date | null;
 source: string;
 status: 'following' | 'unfollowed' | 'skipped';
 createdAt: Date;
 updatedAt: Date;
}

const IgFollowSchema = new Schema<IIgFollow>(
 {
  accountUsername: { type: String, required: true },
  targetUsername: { type: String, required: true },
  followedAt: { type: Date, required: true },
  unfollowAfter: { type: Date, required: true },
  followedBack: { type: Boolean, default: false },
  unfollowedAt: { type: Date, default: null },
  source: { type: String, default: '' },
  status: { type: String, default: 'following', enum: ['following', 'unfollowed', 'skipped'] },
 },
 {
  timestamps: true,
  collection: 'ig-follows',
 }
);

IgFollowSchema.index({ accountUsername: 1, targetUsername: 1 }, { unique: true });
IgFollowSchema.index({ accountUsername: 1, status: 1, unfollowAfter: 1 });
IgFollowSchema.index({ accountUsername: 1, followedAt: -1 });

const db = mongoose.connection.useDb(Config.getInstance().databases.main);
const IgFollow = db.model<IIgFollow>('IgFollow', IgFollowSchema);

type IgFollowDoc = ReturnType<(typeof IgFollow)['hydrate']>;

export { IgFollow, IgFollowDoc };
