import mongoose, { Schema } from 'mongoose';

import Config from './../../config';

// Individual action log
export interface IIgActionLog {
 accountUsername: string;
 date: string;
 action: 'follow' | 'unfollow' | 'like' | 'story_view' | 'profile_view';
 targetUsername: string;
 performedAt: Date;
 success: boolean;
 errorMessage: string | null;
 createdAt: Date;
 updatedAt: Date;
}

const IgActionLogSchema = new Schema<IIgActionLog>(
 {
  accountUsername: { type: String, required: true },
  date: { type: String, required: true },
  action: { type: String, required: true, enum: ['follow', 'unfollow', 'like', 'story_view', 'profile_view'] },
  targetUsername: { type: String, required: true },
  performedAt: { type: Date, required: true },
  success: { type: Boolean, default: true },
  errorMessage: { type: String, default: null },
 },
 {
  timestamps: true,
  collection: 'ig-action-logs',
 }
);

IgActionLogSchema.index({ accountUsername: 1, date: 1, action: 1 });
IgActionLogSchema.index({ performedAt: 1 }, { expireAfterSeconds: 30 * 24 * 60 * 60 }); // TTL 30 days

// Daily counter
export interface IIgDailyCounter {
 accountUsername: string;
 date: string;
 follows: number;
 unfollows: number;
 likes: number;
 storyViews: number;
 profileViews: number;
 createdAt: Date;
 updatedAt: Date;
}

const IgDailyCounterSchema = new Schema<IIgDailyCounter>(
 {
  accountUsername: { type: String, required: true },
  date: { type: String, required: true },
  follows: { type: Number, default: 0 },
  unfollows: { type: Number, default: 0 },
  likes: { type: Number, default: 0 },
  storyViews: { type: Number, default: 0 },
  profileViews: { type: Number, default: 0 },
 },
 {
  timestamps: true,
  collection: 'ig-daily-counters',
 }
);

IgDailyCounterSchema.index({ accountUsername: 1, date: 1 }, { unique: true });

const db = mongoose.connection.useDb(Config.getInstance().databases.main);
const IgActionLog = db.model<IIgActionLog>('IgActionLog', IgActionLogSchema);
const IgDailyCounter = db.model<IIgDailyCounter>('IgDailyCounter', IgDailyCounterSchema);

type IgActionLogDoc = ReturnType<(typeof IgActionLog)['hydrate']>;
type IgDailyCounterDoc = ReturnType<(typeof IgDailyCounter)['hydrate']>;

export { IgActionLog, IgActionLogDoc, IgDailyCounter, IgDailyCounterDoc };
