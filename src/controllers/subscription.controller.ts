import logger from '@ipi-soft/logger';
import { RequestHandler } from 'express';

import CustomError from './../utils/custom-error.utils';

import StripeService, { StripeSaleType } from './../services/stripe.service';

import SubscriptionDataLayer from './../data-layers/subscription.data-layer';
import SubscriptionPlanDataLayer from './../data-layers/subscription-plan.data-layer';
import UserDataLayer from './../data-layers/user.data-layer';

import { ACTIVE_SUBSCRIPTION_STATUSES } from './../models/subscription.model';
import { UserRole } from './../models/user.model';

import Config from './../config';

export default class SubscriptionController {

 private logContext = 'Subscription Controller';
 private stripeService = StripeService.getInstance();
 private subscriptionDataLayer = SubscriptionDataLayer.getInstance();
 private subscriptionPlanDataLayer = SubscriptionPlanDataLayer.getInstance();
 private userDataLayer = UserDataLayer.getInstance();
 private config = Config.getInstance();

 /**
  * POST /api/subscription/create-session/checkout
  * Create a Stripe subscription checkout session
  */
 public createCheckoutSession: RequestHandler = async (req, res) => {
  const logContext = `${this.logContext} -> createCheckoutSession()`;

  const userId = req.user!._id.toString();
  const { planType, returnUrl } = req.body;

  if (!planType) {
   throw new CustomError(400, 'Missing required field: planType');
  }

  // Look up the plan
  const plan = await this.subscriptionPlanDataLayer.getByType(planType, logContext);

  if (!plan.isActive) {
   throw new CustomError(400, 'This subscription plan is no longer available');
  }

  // Block non-admin users from admin-only plans
  if (plan.adminOnly && req.user!.role !== UserRole.Admin) {
   throw new CustomError(403, 'This plan is only available to administrators');
  }

  // Check if user already has an active subscription
  const existingSub = await this.subscriptionDataLayer.getActiveByUserId(userId, logContext);

  if (existingSub) {
   throw new CustomError(400, 'User already has an active subscription');
  }

  // Get or create Stripe customer
  let user = await this.userDataLayer.getById(userId, logContext);
  let stripeCustomerId = user.stripe?.customerId;

  if (!stripeCustomerId) {
   const fullName = `${user.firstName} ${user.lastName}`;
   const customer = await this.stripeService.createCustomer(
    user.email,
    fullName,
    { userId },
    logContext
   );

   stripeCustomerId = customer.id;

   await this.userDataLayer.update(userId, {
    $set: { 'stripe.customerId': stripeCustomerId },
   }, logContext);
  }

  const frontendUrl = this.config.frontendUrl;

  const clientSecret = await this.stripeService.createSubscriptionCheckoutSession({
   customerId: stripeCustomerId,
   priceId: plan.stripePriceId,
   userId,
   returnUrl: returnUrl || `${frontendUrl}/subscription/success`,
  }, logContext);

  res.json({ clientSecret });
 };

 /**
  * POST /api/subscription/cancel
  * Soft cancel subscription at period end
  */
 public cancel: RequestHandler = async (req, res) => {
  const logContext = `${this.logContext} -> cancel()`;

  const userId = req.user!._id.toString();

  const subscription = await this.subscriptionDataLayer.getActiveByUserId(userId, logContext);

  if (!subscription) {
   throw new CustomError(404, 'No active subscription found');
  }

  if (subscription.cancelAtPeriodEnd) {
   throw new CustomError(400, 'Subscription is already set to cancel at period end');
  }

  // Update in Stripe
  await this.stripeService.updateSubscription(
   subscription.stripeSubscriptionId,
   { cancel_at_period_end: true },
   logContext
  );

  // Update locally
  const updated = await this.subscriptionDataLayer.update(
   subscription._id,
   { $set: { cancelAtPeriodEnd: true } },
   logContext
  );

  logger.info(`Subscription cancelled at period end for user: ${userId}`, logContext);

  res.json({
   success: true,
   subscription: updated,
  });
 };

 /**
  * POST /api/subscription/resume
  * Resume a subscription that was set to cancel at period end
  */
 public resume: RequestHandler = async (req, res) => {
  const logContext = `${this.logContext} -> resume()`;

  const userId = req.user!._id.toString();

  const subscription = await this.subscriptionDataLayer.getActiveByUserId(userId, logContext);

  if (!subscription) {
   throw new CustomError(404, 'No active subscription found');
  }

  if (!subscription.cancelAtPeriodEnd) {
   throw new CustomError(400, 'Subscription is not set to cancel');
  }

  // Update in Stripe
  await this.stripeService.updateSubscription(
   subscription.stripeSubscriptionId,
   { cancel_at_period_end: false },
   logContext
  );

  // Update locally
  const updated = await this.subscriptionDataLayer.update(
   subscription._id,
   { $set: { cancelAtPeriodEnd: false } },
   logContext
  );

  logger.info(`Subscription resumed for user: ${userId}`, logContext);

  res.json({
   success: true,
   subscription: updated,
  });
 };

 /**
  * GET /api/subscription/status
  * Get current subscription status and usage
  */
 public getStatus: RequestHandler = async (req, res) => {
  const logContext = `${this.logContext} -> getStatus()`;

  const userId = req.user!._id.toString();

  const subscription = await this.subscriptionDataLayer.getByUserId(userId, logContext);

  if (!subscription) {
   res.json({
    isActive: false,
    subscription: null,
   });
   return;
  }

  const isActive = (ACTIVE_SUBSCRIPTION_STATUSES as readonly string[]).includes(subscription.status);

  res.json({
   isActive,
   subscription: {
    status: subscription.status,
    cancelAtPeriodEnd: subscription.cancelAtPeriodEnd,
    currentPeriodStart: subscription.currentPeriodStart,
    currentPeriodEnd: subscription.currentPeriodEnd,
    planType: subscription.planType,
    planLabel: subscription.planLabel,
    planCost: subscription.planCost,
    planCurrency: subscription.planCurrency,
    planCallsLimit: subscription.planCallsLimit,
    usage: subscription.usage,
   },
  });
 };

 /**
  * GET /api/subscription/plans
  * Get available subscription plans
  */
 public getPlans: RequestHandler = async (req, res) => {
  const logContext = `${this.logContext} -> getPlans()`;

  const isAdmin = req.user?.role === UserRole.Admin;
  const plans = await this.subscriptionPlanDataLayer.getActive(logContext);

  // Filter out admin-only plans for non-admin users
  const filteredPlans = isAdmin ? plans : plans.filter(p => !p.adminOnly);

  res.json({ plans: filteredPlans });
 };
}
