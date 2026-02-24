import Stripe from 'stripe';

import CustomError from './../utils/custom-error.utils';

import Config from './../config';

export enum StripeSaleType {
 Order = 'order',
 Trademark = 'trademark',
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

 private static instance: StripeService;

 public static getInstance(): StripeService {
  if (!StripeService.instance) {
   StripeService.instance = new StripeService();
  }

  return StripeService.instance;
 }

}
