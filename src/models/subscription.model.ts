import mongoose, { Schema } from 'mongoose';

import Config from './../config';

const ACTIVE_SUBSCRIPTION_STATUSES = ['active', 'past_due'] as const;

type SubscriptionStatus = 'active' | 'past_due' | 'canceled' | 'incomplete' | 'incomplete_expired' | 'unpaid';

interface ISubscription {
 userId: mongoose.Types.ObjectId;
 stripeCustomerId: string;
 stripeSubscriptionId: string;
 status: SubscriptionStatus;
 cancelAtPeriodEnd: boolean;
 currentPeriodStart: Date;
 currentPeriodEnd: Date;
 // Denormalized plan data
 planType: string;
 planLabel: string;
 planCost: number;
 planCurrency: string;
 planCallsLimit: number;
 planStripePriceId: string;
 planStripeProductId: string;
 // Usage tracking
 usage: {
  currentPeriodCalls: number;
  totalCalls: number;
  lastCallAt?: Date;
 };
 createdAt: Date;
 updatedAt: Date;
}

const SubscriptionSchema = new Schema<ISubscription>(
 {
  userId: {
   type: Schema.Types.ObjectId,
   ref: 'User',
   required: true,
  },
  stripeCustomerId: {
   type: String,
   required: true,
  },
  stripeSubscriptionId: {
   type: String,
   required: true,
  },
  status: {
   type: String,
   enum: ['active', 'past_due', 'canceled', 'incomplete', 'incomplete_expired', 'unpaid'],
   required: true,
   default: 'incomplete',
  },
  cancelAtPeriodEnd: {
   type: Boolean,
   default: false,
  },
  currentPeriodStart: {
   type: Date,
   required: false,
  },
  currentPeriodEnd: {
   type: Date,
   required: false,
  },
  // Denormalized plan data
  planType: {
   type: String,
   required: true,
  },
  planLabel: {
   type: String,
   required: true,
  },
  planCost: {
   type: Number,
   required: true,
  },
  planCurrency: {
   type: String,
   required: true,
   default: 'eur',
  },
  planCallsLimit: {
   type: Number,
   required: true,
   default: 30,
  },
  planStripePriceId: {
   type: String,
   required: true,
  },
  planStripeProductId: {
   type: String,
   required: true,
  },
  // Usage tracking
  usage: {
   currentPeriodCalls: {
    type: Number,
    default: 0,
   },
   totalCalls: {
    type: Number,
    default: 0,
   },
   lastCallAt: {
    type: Date,
    required: false,
   },
  },
 },
 {
  timestamps: true,
  collection: 'subscriptions',
 }
);

SubscriptionSchema.index({ userId: 1 });
SubscriptionSchema.index({ stripeSubscriptionId: 1 }, { unique: true, sparse: true });
SubscriptionSchema.index({ stripeCustomerId: 1 });

const db = mongoose.connection.useDb(Config.getInstance().databases.main);
const Subscription = db.model<ISubscription>('Subscription', SubscriptionSchema);

type SubscriptionDoc = ReturnType<(typeof Subscription)['hydrate']>;

export { Subscription, SubscriptionDoc, ISubscription, SubscriptionStatus, ACTIVE_SUBSCRIPTION_STATUSES };
