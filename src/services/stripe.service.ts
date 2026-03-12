import logger from '@ipi-soft/logger';
import Stripe from 'stripe';

import CustomError from './../utils/custom-error.utils';

import SubscriptionDataLayer from './../data-layers/subscription.data-layer';
import SubscriptionPlanDataLayer from './../data-layers/subscription-plan.data-layer';
import UserDataLayer from './../data-layers/user.data-layer';

import { ISubscription, ACTIVE_SUBSCRIPTION_STATUSES } from './../models/subscription.model';

import Config from './../config';

export enum StripeSaleType {
 Order = 'order',
 Trademark = 'trademark',
 Subscription = 'subscription',
}

export default class StripeService {

 private logContext = 'Stripe Service';

 private config = Config.getInstance();
 private isProdEnv = this.config.env === 'prod';

 private stripe = new Stripe(this.config.stripeApiSecretKey);

 /**
 * Create a Stripe Checkout Session with embedded UI mode.
 * Returns the client_secret the frontend needs to mount the embedded checkout.
 */
 public async createCheckoutSession(params: {
  orderId: string;
  amount: number; // in EUR (e.g. 180.00)
  currency: string;
  customerEmail: string;
  orderType: StripeSaleType;
  description?: string;
  returnUrl: string;
 }, logContext: string): Promise<string | null> {
  logContext = `${logContext} -> ${this.logContext} -> createCheckoutSession()`;

  // Stripe expects amounts in the smallest currency unit (cents for EUR)
  const unitAmount = Math.round(params.amount * 100);

  const sessionParams: Stripe.Checkout.SessionCreateParams = {
   ui_mode: 'custom',
   mode: 'payment',
   payment_method_types: ['card'],
   line_items: [
    {
     quantity: 1,
     price_data: {
      currency: params.currency.toLowerCase(),
      product_data: {
       name: params.description || `Order ${params.orderId}`,
      },
      unit_amount: unitAmount,
     },
    },
   ],
   metadata: {
    orderId: params.orderId,
    orderType: params.orderType,
   },
   customer_email: params.customerEmail,
   return_url: params.returnUrl,
  };

  const session = await this.stripe.checkout.sessions.create(sessionParams)
   .catch(err => {
    throw new CustomError(
     500,
     err.message,
     `${logContext} -> stripe.checkout.sessions.create() -> orderId: ${params.orderId}`,
     this.isProdEnv
    );
   });

  return session.client_secret;
 }

 /**
 * Construct and verify a Stripe webhook event from the raw request body.
 */
 public constructWebhookEvent(rawBody: string, signature: string): Stripe.Event {
  return this.stripe.webhooks.constructEvent(
   rawBody,
   signature,
   this.config.stripeWebhookSigningSecret
  );
 }

 /**
 * Retrieve a checkout session with expanded payment intent and charge data.
 */
 public async retrieveSession(sessionId: string, logContext: string): Promise<Stripe.Checkout.Session> {
  logContext = `${logContext} -> ${this.logContext} -> retrieveSession()`;

  const session = await this.stripe.checkout.sessions.retrieve(sessionId, {
   expand: ['payment_intent.latest_charge'],
  }).catch(err => {
   throw new CustomError(
    500,
    err.message,
    `${logContext} -> stripe.checkout.sessions.retrieve() -> sessionId: ${sessionId}`,
    this.isProdEnv
   );
  });

  return session;
 }

 public getStripeInstance(): Stripe {
  return this.stripe;
 }

 /**
  * Create a Stripe customer and return the customer object.
  */
 public async createCustomer(email: string, name: string, metadata: Record<string, string>, logContext: string): Promise<Stripe.Customer> {
  logContext = `${logContext} -> ${this.logContext} -> createCustomer()`;

  const customer = await this.stripe.customers.create({
   email,
   name,
   metadata,
  }).catch(err => {
   throw new CustomError(500, err.message, `${logContext} -> email: ${email}`, this.isProdEnv);
  });

  return customer;
 }

 /**
  * Create a Stripe Checkout Session for a subscription.
  * Returns the client_secret for the embedded checkout UI.
  */
 public async createSubscriptionCheckoutSession(params: {
  customerId: string;
  priceId: string;
  userId: string;
  returnUrl: string;
 }, logContext: string): Promise<string | null> {
  logContext = `${logContext} -> ${this.logContext} -> createSubscriptionCheckoutSession()`;

  const sessionParams: Stripe.Checkout.SessionCreateParams = {
   ui_mode: 'custom',
   mode: 'subscription',
   payment_method_types: ['card'],
   customer: params.customerId,
   line_items: [{
    price: params.priceId,
    quantity: 1,
   }],
   metadata: {
    userId: params.userId,
    orderType: StripeSaleType.Subscription,
   },
   return_url: params.returnUrl,
  };

  const session = await this.stripe.checkout.sessions.create(sessionParams)
   .catch(err => {
    throw new CustomError(
     500,
     err.message,
     `${logContext} -> stripe.checkout.sessions.create() -> userId: ${params.userId}`,
     this.isProdEnv
    );
   });

  return session.client_secret;
 }

 /**
  * Retrieve a Stripe subscription by ID.
  */
 public async retrieveSubscription(subscriptionId: string, logContext: string): Promise<Stripe.Subscription> {
  logContext = `${logContext} -> ${this.logContext} -> retrieveSubscription()`;

  const subscription = await this.stripe.subscriptions.retrieve(subscriptionId)
   .catch(err => {
    throw new CustomError(500, err.message, `${logContext} -> subscriptionId: ${subscriptionId}`, this.isProdEnv);
   });

  return subscription;
 }

 /**
  * Update a Stripe subscription.
  */
 public async updateSubscription(subscriptionId: string, params: Stripe.SubscriptionUpdateParams, logContext: string): Promise<Stripe.Subscription> {
  logContext = `${logContext} -> ${this.logContext} -> updateSubscription()`;

  const subscription = await this.stripe.subscriptions.update(subscriptionId, params)
   .catch(err => {
    throw new CustomError(500, err.message, `${logContext} -> subscriptionId: ${subscriptionId}`, this.isProdEnv);
   });

  return subscription;
 }

 /**
  * Sync a Stripe subscription object to the local MongoDB subscription model.
  * Creates a new subscription record if one doesn't exist, otherwise updates it.
  */
 public async syncSubscriptionModel(stripeSubscription: Stripe.Subscription, logContext: string): Promise<void> {
  logContext = `${logContext} -> ${this.logContext} -> syncSubscriptionModel()`;

  const subscriptionDataLayer = SubscriptionDataLayer.getInstance();
  const subscriptionPlanDataLayer = SubscriptionPlanDataLayer.getInstance();

  const stripeSubId = stripeSubscription.id;
  const stripeCustomerId = typeof stripeSubscription.customer === 'string'
   ? stripeSubscription.customer
   : stripeSubscription.customer.id;

  // Get the price ID from the subscription items
  const priceId = stripeSubscription.items.data[0]?.price?.id;

  if (!priceId) {
   logger.error('No price ID found in Stripe subscription items', logContext);
   return;
  }

  // Look up the plan
  const plan = await subscriptionPlanDataLayer.getByStripePriceId(priceId, logContext).catch(err => {
   logger.error(`Plan not found for priceId: ${priceId} - ${err.message}`, logContext);
   return null;
  });

  if (!plan) return;

  const updateData: Partial<ISubscription> = {
   stripeCustomerId,
   stripeSubscriptionId: stripeSubId,
   status: stripeSubscription.status as ISubscription['status'],
   cancelAtPeriodEnd: stripeSubscription.cancel_at_period_end,
   currentPeriodStart: new Date(stripeSubscription.items.data[0].current_period_start * 1000),
   currentPeriodEnd: new Date(stripeSubscription.items.data[0].current_period_end * 1000),
   planType: plan.type,
   planLabel: plan.label,
   planCost: plan.cost,
   planCurrency: plan.currency,
   planCallsLimit: plan.callsLimit,
   planStripePriceId: plan.stripePriceId,
   planStripeProductId: plan.stripeProductId,
  };

  // Try to find existing subscription by Stripe subscription ID
  const existingSub = await subscriptionDataLayer.getByStripeSubscriptionId(stripeSubId, logContext);

  if (existingSub) {
   await subscriptionDataLayer.update(existingSub._id, { $set: updateData }, logContext);
  } else {
   // Try to find by customer ID (new subscription)
   const existingByCustomer = await subscriptionDataLayer.getByStripeCustomerId(stripeCustomerId, logContext);

   if (existingByCustomer) {
    await subscriptionDataLayer.update(existingByCustomer._id, { $set: updateData }, logContext);
   } else {
    // Try to find userId from the users collection by stripe.customerId
    const userDataLayer = UserDataLayer.getInstance();
    const user = await userDataLayer.getByStripeCustomerId(stripeCustomerId, logContext).catch(() => null);

    if (user) {
     await subscriptionDataLayer.create({
      userId: user._id,
      ...updateData as any,
      usage: { currentPeriodCalls: 0, totalCalls: 0 },
     }, logContext);
     logger.info(`Created subscription for user ${user._id} via sync fallback`, logContext);
    } else {
     logger.error(`Cannot create subscription without userId. stripeSubId: ${stripeSubId}`, logContext);
    }
   }
  }
 }

 private static instance: StripeService;

 public static getInstance(): StripeService {
  if (!StripeService.instance) {
   StripeService.instance = new StripeService();
  }

  return StripeService.instance;
 }

}
