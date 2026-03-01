import logger from '@ipi-soft/logger';
import { RequestHandler } from 'express';

import CustomError from './../utils/custom-error.utils';
import TawkService from './../services/tawk.service';
import TawkEventDataLayer from './../data-layers/tawk-event.data-layer';

export default class TawkController {

 private logContext = 'Tawk Controller';
 private tawkService = TawkService.getInstance();
 private tawkEventDataLayer = TawkEventDataLayer.getInstance();

 /**
 * GET /api/tawk/visitor-hash
 * Returns HMAC hash for the authenticated user's email (secure mode).
 */
 public getVisitorHash: RequestHandler = async (req, res) => {
  const logContext = `${this.logContext} -> getVisitorHash()`;

  const user = req.user;

  if (!user || !user.email) {
   throw new CustomError(400, 'User email not available', logContext);
  }

  const hash = this.tawkService.generateVisitorHash(user.email);

  res.status(200).json({
   hash,
   name: `${user.firstName} ${user.lastName}`,
   email: user.email,
  });
 };

 /**
 * POST /api/tawk/webhook
 * Handle tawk.to webhook events (chat transcript, new ticket).
 */
 public webhook: RequestHandler = async (req, res) => {
  const rawBody = (req as any).rawBody as string;
  const signature = req.headers['x-tawk-signature'] as string;
  const logContext = `${this.logContext} -> webhook()`;

  if (!signature) {
   throw new CustomError(400, 'Missing webhook signature', logContext);
  }

  const isValid = this.tawkService.verifyWebhookSignature(rawBody, signature);

  if (!isValid) {
   throw new CustomError(400, 'Invalid webhook signature', logContext);
  }

  const payload = req.body;
  const eventType = payload.event || 'unknown';

  // Generate a deterministic event ID for idempotency
  const eventId = payload.chatId
   ? `${payload.chatId}-${eventType}`
   : payload.ticketId
    ? `${payload.ticketId}-${eventType}`
    : `${Date.now()}-${eventType}`;

  const isNewEvent = await this.tawkEventDataLayer.tryInsert(eventId, eventType, payload, logContext);

  if (!isNewEvent) {
   res.status(200).json({ received: true });
   return;
  }

  switch (eventType) {
   case 'chat:transcript':
    logger.info(`Tawk.to chat transcript received: ${eventId}`, logContext);
    break;

   case 'ticket:create':
    logger.info(`Tawk.to new ticket received: ${eventId}`, logContext);
    break;

   default:
    logger.info(`Unhandled tawk.to event type: ${eventType}`, logContext);
  }

  res.status(200).json({ received: true });
 };

}
