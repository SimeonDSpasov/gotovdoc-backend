import { RequestHandler } from 'express';
import logger from '@ipi-soft/logger';

import CustomError from '../utils/custom-error.utils';
import MyPosService from '../services/mypos.service';
import { Document } from '../models/document.model';
import mongoose from 'mongoose';

export default class PaymentController {
  
  private logContext = 'Payment Controller';
  private myposService = MyPosService.getInstance();

  public handleWebhook: RequestHandler = async (req, res) => {
    try {
      const webhookData = req.body;

      logger.info(`Received webhook: ${JSON.stringify(webhookData)}`, this.logContext);

      // Validate webhook signature if provided
      // TODO: Implement signature validation with MYPOS_WEBHOOK_SECRET

      const { event_type, payment_link_id, order_id, status, amount, currency } = webhookData;

      if (event_type === 'payment.completed' && status === 'success') {
        // Update document with payment success
        await this.updateDocumentPaymentStatus(order_id, {
          paid: true,
          paymentLinkId: payment_link_id,
          paidAt: new Date(),
          amount,
          currency,
        });

        logger.info(`Payment completed for order: ${order_id}`, this.logContext);
      } else if (event_type === 'payment.failed' || status === 'failed') {
        await this.updateDocumentPaymentStatus(order_id, {
          paid: false,
          paymentLinkId: payment_link_id,
          failedAt: new Date(),
        });

        logger.info(`Payment failed for order: ${order_id}`, this.logContext);
      }

      // Return 200 OK to acknowledge webhook receipt
      res.status(200).json({ received: true });
    } catch (error: any) {
      logger.error(error.message, `${this.logContext} -> handleWebhook`);
      // Still return 200 to prevent webhook retry storms
      res.status(200).json({ received: true, error: 'Processing error' });
    }
  }

  public getPaymentStatus: RequestHandler = async (req, res) => {
    const { orderId } = req.params;

    if (!orderId || !mongoose.isValidObjectId(orderId)) {
      throw new CustomError(400, 'Invalid order ID');
    }

    const document = await Document.findById(orderId);

    if (!document) {
      throw new CustomError(404, 'Order not found');
    }

    res.json({
      orderId,
      paid: (document.orderData as any)?.paid || false,
      amount: (document.orderData as any)?.amount,
      currency: (document.orderData as any)?.currency,
      paidAt: (document.orderData as any)?.paidAt,
    });
  }

  private async updateDocumentPaymentStatus(orderId: string, paymentData: any): Promise<void> {
    if (!mongoose.isValidObjectId(orderId)) {
      throw new Error('Invalid order ID');
    }

    await Document.findByIdAndUpdate(
      orderId,
      {
        $set: {
          'orderData.paid': paymentData.paid,
          'orderData.paymentLinkId': paymentData.paymentLinkId,
          'orderData.paidAt': paymentData.paidAt,
          'orderData.failedAt': paymentData.failedAt,
          'orderData.amount': paymentData.amount,
          'orderData.currency': paymentData.currency,
        },
      }
    );
  }
}


