import { RequestHandler } from 'express';

import CustomError from './../utils/custom-error.utils';

import SubscriptionDataLayer from './../data-layers/subscription.data-layer';

import { ACTIVE_SUBSCRIPTION_STATUSES } from './../models/subscription.model';

export default class SubscriptionMiddleware {

 private logContext = 'Subscription Middleware';

 private subscriptionDataLayer = SubscriptionDataLayer.getInstance();

 /**
  * Middleware that checks if the authenticated user has an active subscription.
  * Returns 403 if no active subscription found.
  */
 public requireActiveSubscription: RequestHandler = async (req, res, next) => {
  const userId = req.user?._id?.toString();

  if (!userId) {
   return next(new CustomError(401, 'Unauthorized'));
  }

  const logContext = `${this.logContext} -> requireActiveSubscription()`;

  const subscription = await this.subscriptionDataLayer.getActiveByUserId(userId, logContext);

  if (!subscription) {
   return next(new CustomError(403, 'Active subscription required'));
  }

  next();
 };

 /**
  * Middleware that checks if the subscriber has remaining calls in the current period.
  * Returns 403 with usage info if cap is reached.
  */
 public requireAvailableCalls: RequestHandler = async (req, res, next) => {
  const userId = req.user?._id?.toString();

  if (!userId) {
   return next(new CustomError(401, 'Unauthorized'));
  }

  const logContext = `${this.logContext} -> requireAvailableCalls()`;

  const subscription = await this.subscriptionDataLayer.getActiveByUserId(userId, logContext);

  if (!subscription) {
   return next(new CustomError(403, 'Active subscription required'));
  }

  if (subscription.usage.currentPeriodCalls >= subscription.planCallsLimit) {
   return next(new CustomError(403, `Monthly call limit reached (${subscription.planCallsLimit}). Your limit resets on ${subscription.currentPeriodEnd.toISOString().split('T')[0]}.`));
  }

  next();
 };

 private static instance: SubscriptionMiddleware;

 public static getInstance(): SubscriptionMiddleware {
  if (!SubscriptionMiddleware.instance) {
   SubscriptionMiddleware.instance = new SubscriptionMiddleware();
  }

  return SubscriptionMiddleware.instance;
 }

}
