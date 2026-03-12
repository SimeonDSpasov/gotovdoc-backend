import mongoose, { Schema } from 'mongoose';

import Config from './../config';

interface ISubscriptionPlan {
 type: string;
 label: string;
 cost: number;
 currency: string;
 callsLimit: number;
 billingPeriod: 'month' | 'year';
 billingIntervalCount: number;
 stripePriceId: string;
 stripeProductId: string;
 isActive: boolean;
 adminOnly: boolean;
 createdAt: Date;
 updatedAt: Date;
}

const SubscriptionPlanSchema = new Schema<ISubscriptionPlan>(
 {
  type: {
   type: String,
   required: true,
  },
  label: {
   type: String,
   required: true,
  },
  cost: {
   type: Number,
   required: true,
  },
  currency: {
   type: String,
   required: true,
   default: 'eur',
  },
  callsLimit: {
   type: Number,
   required: true,
   default: 30,
  },
  billingPeriod: {
   type: String,
   enum: ['month', 'year'],
   required: true,
   default: 'month',
  },
  billingIntervalCount: {
   type: Number,
   required: true,
   default: 1,
  },
  stripePriceId: {
   type: String,
   required: true,
  },
  stripeProductId: {
   type: String,
   required: true,
  },
  isActive: {
   type: Boolean,
   default: true,
  },
  adminOnly: {
   type: Boolean,
   default: false,
  },
 },
 {
  timestamps: true,
  collection: 'subscription-plans',
 }
);

SubscriptionPlanSchema.index({ type: 1 }, { unique: true });
SubscriptionPlanSchema.index({ stripePriceId: 1 }, { unique: true });

const db = mongoose.connection.useDb(Config.getInstance().databases.main);
const SubscriptionPlan = db.model<ISubscriptionPlan>('SubscriptionPlan', SubscriptionPlanSchema);

type SubscriptionPlanDoc = ReturnType<(typeof SubscriptionPlan)['hydrate']>;

export { SubscriptionPlan, SubscriptionPlanDoc, ISubscriptionPlan };
