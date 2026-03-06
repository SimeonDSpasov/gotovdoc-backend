import mongoose, { Schema } from 'mongoose';

import Config from './../../config';

export interface IIgAccount {
 username: string;
 cookies: string;
 localStorage: string;
 userAgent: string;
 viewport: { width: number; height: number };
 timezone: string;
 locale: string;
 warmupDays: number;
 status: 'active' | 'challenge' | 'suspended' | 'banned';
 lastLoginAt: Date | null;
 lastActionAt: Date | null;
 createdAt: Date;
 updatedAt: Date;
}

const IgAccountSchema = new Schema<IIgAccount>(
 {
  username: { type: String, required: true },
  cookies: { type: String, default: '' },
  localStorage: { type: String, default: '' },
  userAgent: { type: String, default: '' },
  viewport: {
   width: { type: Number, default: 1280 },
   height: { type: Number, default: 800 },
  },
  timezone: { type: String, default: 'Europe/Sofia' },
  locale: { type: String, default: 'bg-BG' },
  warmupDays: { type: Number, default: 0 },
  status: { type: String, default: 'active', enum: ['active', 'challenge', 'suspended', 'banned'] },
  lastLoginAt: { type: Date, default: null },
  lastActionAt: { type: Date, default: null },
 },
 {
  timestamps: true,
  collection: 'ig-accounts',
 }
);

IgAccountSchema.index({ username: 1 }, { unique: true });

const db = mongoose.connection.useDb(Config.getInstance().databases.main);
const IgAccount = db.model<IIgAccount>('IgAccount', IgAccountSchema);

type IgAccountDoc = ReturnType<(typeof IgAccount)['hydrate']>;

export { IgAccount, IgAccountDoc };
