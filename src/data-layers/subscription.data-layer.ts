import mongoose, { FilterQuery, UpdateQuery } from 'mongoose';

import CustomError from './../utils/custom-error.utils';

import { Subscription, SubscriptionDoc, ISubscription, ACTIVE_SUBSCRIPTION_STATUSES } from './../models/subscription.model';

export default class SubscriptionDataLayer {

 private logContext = 'Subscription Data Layer';

 public async create(data: Partial<ISubscription>, logContext: string): Promise<SubscriptionDoc> {
  logContext = `${logContext} -> ${this.logContext} -> create()`;

  const subscription = await Subscription.create(data)
   .catch(err => {
    throw new CustomError(500, err.message, `${logContext} -> data: ${JSON.stringify(data)}`);
   });

  return subscription;
 }

 public async getByUserId(userId: string | mongoose.Types.ObjectId, logContext: string): Promise<SubscriptionDoc | null> {
  logContext = `${logContext} -> ${this.logContext} -> getByUserId()`;

  const subscription = await Subscription.findOne({ userId })
   .sort({ createdAt: -1 })
   .catch(err => {
    throw new CustomError(500, err.message, `${logContext} -> userId: ${userId.toString()}`);
   });

  return subscription;
 }

 public async getActiveByUserId(userId: string | mongoose.Types.ObjectId, logContext: string): Promise<SubscriptionDoc | null> {
  logContext = `${logContext} -> ${this.logContext} -> getActiveByUserId()`;

  const subscription = await Subscription.findOne({
   userId,
   status: { $in: ACTIVE_SUBSCRIPTION_STATUSES },
  })
   .sort({ createdAt: -1 })
   .catch(err => {
    throw new CustomError(500, err.message, `${logContext} -> userId: ${userId.toString()}`);
   });

  return subscription;
 }

 public async getByStripeSubscriptionId(stripeSubscriptionId: string, logContext: string): Promise<SubscriptionDoc | null> {
  logContext = `${logContext} -> ${this.logContext} -> getByStripeSubscriptionId()`;

  const subscription = await Subscription.findOne({ stripeSubscriptionId })
   .catch(err => {
    throw new CustomError(500, err.message, `${logContext} -> stripeSubscriptionId: ${stripeSubscriptionId}`);
   });

  return subscription;
 }

 public async getByStripeCustomerId(stripeCustomerId: string, logContext: string): Promise<SubscriptionDoc | null> {
  logContext = `${logContext} -> ${this.logContext} -> getByStripeCustomerId()`;

  const subscription = await Subscription.findOne({ stripeCustomerId })
   .sort({ createdAt: -1 })
   .catch(err => {
    throw new CustomError(500, err.message, `${logContext} -> stripeCustomerId: ${stripeCustomerId}`);
   });

  return subscription;
 }

 public async update(id: string | mongoose.Types.ObjectId, update: UpdateQuery<ISubscription>, logContext: string): Promise<SubscriptionDoc> {
  logContext = `${logContext} -> ${this.logContext} -> update()`;

  const subscription = await Subscription.findByIdAndUpdate(id, update, { new: true })
   .catch(err => {
    throw new CustomError(500, err.message, `${logContext} -> id: ${id.toString()} | update: ${JSON.stringify(update)}`);
   });

  if (!subscription) {
   throw new CustomError(404, 'No subscription found');
  }

  return subscription;
 }

 public async updateByStripeSubscriptionId(stripeSubscriptionId: string, update: UpdateQuery<ISubscription>, logContext: string): Promise<SubscriptionDoc> {
  logContext = `${logContext} -> ${this.logContext} -> updateByStripeSubscriptionId()`;

  const subscription = await Subscription.findOneAndUpdate({ stripeSubscriptionId }, update, { new: true })
   .catch(err => {
    throw new CustomError(500, err.message, `${logContext} -> stripeSubscriptionId: ${stripeSubscriptionId}`);
   });

  if (!subscription) {
   throw new CustomError(404, `No subscription found with stripeSubscriptionId: ${stripeSubscriptionId}`);
  }

  return subscription;
 }

 public async incrementUsage(userId: string | mongoose.Types.ObjectId, logContext: string): Promise<SubscriptionDoc> {
  logContext = `${logContext} -> ${this.logContext} -> incrementUsage()`;

  const subscription = await Subscription.findOneAndUpdate(
   { userId, status: { $in: ACTIVE_SUBSCRIPTION_STATUSES } },
   {
    $inc: {
     'usage.currentPeriodCalls': 1,
     'usage.totalCalls': 1,
    },
    $set: {
     'usage.lastCallAt': new Date(),
    },
   },
   { new: true, sort: { createdAt: -1 } }
  )
   .catch(err => {
    throw new CustomError(500, err.message, `${logContext} -> userId: ${userId.toString()}`);
   });

  if (!subscription) {
   throw new CustomError(404, 'No active subscription found');
  }

  return subscription;
 }

 public async resetPeriodUsage(stripeSubscriptionId: string, logContext: string): Promise<SubscriptionDoc> {
  logContext = `${logContext} -> ${this.logContext} -> resetPeriodUsage()`;

  const subscription = await Subscription.findOneAndUpdate(
   { stripeSubscriptionId },
   { $set: { 'usage.currentPeriodCalls': 0 } },
   { new: true }
  )
   .catch(err => {
    throw new CustomError(500, err.message, `${logContext} -> stripeSubscriptionId: ${stripeSubscriptionId}`);
   });

  if (!subscription) {
   throw new CustomError(404, `No subscription found with stripeSubscriptionId: ${stripeSubscriptionId}`);
  }

  return subscription;
 }

 private static instance: SubscriptionDataLayer;

 public static getInstance(): SubscriptionDataLayer {
  if (!SubscriptionDataLayer.instance) {
   SubscriptionDataLayer.instance = new SubscriptionDataLayer();
  }

  return SubscriptionDataLayer.instance;
 }

}
