import logger from '@ipi-soft/logger';

import { StripeEvent } from './../models/stripe-event.model';

export default class StripeEventDataLayer {

  private logContext = 'Stripe Event Data Layer';

  /**
   * Attempt to insert a new Stripe event for idempotency.
   * Returns true if the event is new (successfully inserted).
   * Returns false if the event was already processed (duplicate key error).
   */
  public async tryInsert(eventId: string, type: string, logContext: string): Promise<boolean> {
    logContext = `${logContext} -> ${this.logContext} -> tryInsert()`;

    try {
      await StripeEvent.create({ eventId, type });
      return true;
    } catch (err: any) {
      // Duplicate key error (code 11000) means already processed
      if (err.code === 11000) {
        return false;
      }

      logger.error(err.message, `${logContext} -> eventId: ${eventId}`);
      return false;
    }
  }

  private static instance: StripeEventDataLayer;

  public static getInstance(): StripeEventDataLayer {
    if (!StripeEventDataLayer.instance) {
      StripeEventDataLayer.instance = new StripeEventDataLayer();
    }

    return StripeEventDataLayer.instance;
  }

}
