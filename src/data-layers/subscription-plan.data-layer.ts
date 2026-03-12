import { FilterQuery } from 'mongoose';

import CustomError from './../utils/custom-error.utils';

import { SubscriptionPlan, SubscriptionPlanDoc, ISubscriptionPlan } from './../models/subscription-plan.model';

export default class SubscriptionPlanDataLayer {

 private logContext = 'Subscription Plan Data Layer';

 public async create(data: Partial<ISubscriptionPlan>, logContext: string): Promise<SubscriptionPlanDoc> {
  logContext = `${logContext} -> ${this.logContext} -> create()`;

  const plan = await SubscriptionPlan.create(data)
   .catch(err => {
    throw new CustomError(500, err.message, `${logContext} -> data: ${JSON.stringify(data)}`);
   });

  return plan;
 }

 public async getByType(type: string, logContext: string): Promise<SubscriptionPlanDoc> {
  logContext = `${logContext} -> ${this.logContext} -> getByType()`;

  const plan = await SubscriptionPlan.findOne({ type })
   .catch(err => {
    throw new CustomError(500, err.message, `${logContext} -> type: ${type}`);
   });

  if (!plan) {
   throw new CustomError(404, `No subscription plan found with type: ${type}`);
  }

  return plan;
 }

 public async getByStripePriceId(stripePriceId: string, logContext: string): Promise<SubscriptionPlanDoc> {
  logContext = `${logContext} -> ${this.logContext} -> getByStripePriceId()`;

  const plan = await SubscriptionPlan.findOne({ stripePriceId })
   .catch(err => {
    throw new CustomError(500, err.message, `${logContext} -> stripePriceId: ${stripePriceId}`);
   });

  if (!plan) {
   throw new CustomError(404, `No subscription plan found with stripePriceId: ${stripePriceId}`);
  }

  return plan;
 }

 public async getActive(logContext: string): Promise<SubscriptionPlanDoc[]> {
  logContext = `${logContext} -> ${this.logContext} -> getActive()`;

  const plans = await SubscriptionPlan.find({ isActive: true })
   .catch(err => {
    throw new CustomError(500, err.message, logContext);
   });

  return plans;
 }

 private static instance: SubscriptionPlanDataLayer;

 public static getInstance(): SubscriptionPlanDataLayer {
  if (!SubscriptionPlanDataLayer.instance) {
   SubscriptionPlanDataLayer.instance = new SubscriptionPlanDataLayer();
  }

  return SubscriptionPlanDataLayer.instance;
 }

}
