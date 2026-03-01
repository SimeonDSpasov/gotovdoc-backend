import logger from '@ipi-soft/logger';

import { TawkEvent } from './../models/tawk-event.model';

export default class TawkEventDataLayer {

 private logContext = 'Tawk Event Data Layer';

 /**
 * Attempt to insert a new tawk.to event for idempotency.
 * Returns true if the event is new (successfully inserted).
 * Returns false if the event was already processed (duplicate key error).
 */
 public async tryInsert(eventId: string, type: string, payload: object, logContext: string): Promise<boolean> {
  logContext = `${logContext} -> ${this.logContext} -> tryInsert()`;

  return TawkEvent.create({ eventId, type, payload })
   .then(() => true)
   .catch((err: any) => {
    if (err.code === 11000) {
     return false;
    }
    logger.error(err.message, `${logContext} -> eventId: ${eventId}`);
    return false;
   });
 }

 private static instance: TawkEventDataLayer;

 public static getInstance(): TawkEventDataLayer {
  if (!TawkEventDataLayer.instance) {
   TawkEventDataLayer.instance = new TawkEventDataLayer();
  }

  return TawkEventDataLayer.instance;
 }

}
