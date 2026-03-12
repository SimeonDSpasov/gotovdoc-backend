import Stripe from 'stripe';
import logger from '@ipi-soft/logger';

import CustomError from './../utils/custom-error.utils';

import SubscriptionPlanDataLayer from './../data-layers/subscription-plan.data-layer';
import StripeService from './../services/stripe.service';

import { ISubscriptionPlan } from './../models/subscription-plan.model';

interface SeedPlan extends Partial<ISubscriptionPlan> {
 stripeProductName: string;
}

const subscriptionPlans: SeedPlan[] = [
 {
  type: 'starter',
  label: 'Месечен абонамент',
  cost: 10000, // 100 EUR
  currency: 'eur',
  callsLimit: 30,
  billingPeriod: 'month',
  billingIntervalCount: 1,
  stripePriceId: '',
  stripeProductId: '',
  isActive: true,
  adminOnly: false,
  stripeProductName: 'GotovDoc Subscription',
 },
 {
  type: 'admin',
  label: 'Админ абонамент',
  cost: 100, // 1 EUR
  currency: 'eur',
  callsLimit: 999999,
  billingPeriod: 'month',
  billingIntervalCount: 1,
  stripePriceId: '',
  stripeProductId: '',
  isActive: true,
  adminOnly: true,
  stripeProductName: 'GotovDoc Admin Subscription',
 },
];

export default class SubscriptionPlansSeedScript {

 private logContext = 'Subscription Plans Seed Script';

 private stripeService = StripeService.getInstance();
 private subscriptionPlanDataLayer = SubscriptionPlanDataLayer.getInstance();

 private stripe = this.stripeService.getStripeInstance();

 // 1 - Create a stripe product (subscription) or use an existing one
 // 2 - For each plan, create stripe price associated with the subscription product
 // 3 - Add the stripe price id to the plan object
 // 4 - Save each plan to the DB

 public async seedPlans(): Promise<void> {
  const logContext = `${this.logContext} -> seedPlans()`;

  for (const plan of subscriptionPlans) {
   // Skip if plan already exists in DB
   const existing = await this.subscriptionPlanDataLayer.getByType(plan.type!, logContext).catch(() => null);

   if (existing) {
    logger.info(`${logContext} Plan "${plan.type}" already exists, skipping`);
    continue;
   }

   const product = await this.getOrCreateStripeSubscriptionProduct(plan.stripeProductName, logContext);
   const stripePlanPrice = await this.createStripeSubscriptionPlanPrice(plan as ISubscriptionPlan, product.id, logContext);

   plan.stripePriceId = stripePlanPrice.id;
   plan.stripeProductId = product.id;

   const { stripeProductName, ...planData } = plan;
   await this.subscriptionPlanDataLayer.create(planData, logContext);
  }

  logger.info('Subscription Plans Seeding Completed');
 }

 private async getOrCreateStripeSubscriptionProduct(stripeSubscriptionName: string, logContext: string): Promise<Stripe.Product> {
  logContext = `${logContext} -> getOrCreateStripeSubscriptionProduct()`;

  const searchParams: Stripe.ProductSearchParams = {
   query: `name:'${stripeSubscriptionName}'`,
   limit: 1,
  };

  const existingSubscriptionProduct = await this.stripe.products.search(searchParams)
   .catch(err => {
    throw new CustomError(500, err.message, `${logContext} -> stripe.products.search() -> params: ${JSON.stringify(searchParams)}`);
   });

  if (existingSubscriptionProduct.data.length > 0) {
   if (existingSubscriptionProduct.has_more) {
    throw new CustomError(500, 'More than one subscription exists with the given name', logContext);
   }

   return existingSubscriptionProduct.data[0];
  }

  const subscriptionProduct = await this.stripe.products.create({ name: stripeSubscriptionName })
   .catch(err => {
    throw new CustomError(500, err.message, `${logContext} -> stripe.products.create() -> name: ${stripeSubscriptionName}`);
   });

  return subscriptionProduct;
 }

 private async createStripeSubscriptionPlanPrice(plan: ISubscriptionPlan, subscriptionProductId: string, logContext: string): Promise<Stripe.Price> {
  logContext = `${logContext} -> createStripeSubscriptionPlanPrice()`;

  const priceParams: Stripe.PriceCreateParams = {
   unit_amount: plan.cost,
   currency: plan.currency,
   recurring: {
    interval: plan.billingPeriod,
    interval_count: plan.billingIntervalCount,
   },
   nickname: plan.label,
   product: subscriptionProductId,
   metadata: {
    label: plan.label,
   },
  };

  const price = await this.stripe.prices.create(priceParams)
   .catch(err => {
    throw new CustomError(500, err.message, `${logContext} -> stripe.prices.create() -> params: ${JSON.stringify(priceParams)}`);
   });

  return price;
 }

}
