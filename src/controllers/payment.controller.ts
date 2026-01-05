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

  public createPaymentButton: RequestHandler = async (req, res) => {
    try {
      logger.info('Creating payment button', this.logContext);

      // Create payment button via myPOS service
      const paymentButton = await this.myposService.createPaymentButton(req.body);

      logger.info('Payment button created successfully', this.logContext);

      res.json({
        success: true,
        data: paymentButton,
      });
    } catch (error: any) {
      logger.error(error.message, `${this.logContext} -> createPaymentButton`);
      throw error;
    }
  }

  public createPaymentLink: RequestHandler = async (req, res) => {
    try {
      const { amount, currency, order_id, customer_email, customer_name, note, success_url, cancel_url } = req.body;

      // Validate required fields
      if (!amount || !currency || !order_id || !customer_email) {
        throw new CustomError(400, 'Missing required fields: amount, currency, order_id, customer_email');
      }

      // Validate order_id is a valid MongoDB ObjectId
      if (!mongoose.isValidObjectId(order_id)) {
        throw new CustomError(400, 'Invalid order_id format');
      }

      // Verify order exists
      const document = await Document.findById(order_id);
      if (!document) {
        throw new CustomError(404, 'Order not found');
      }

      logger.info(`Creating payment link for order: ${order_id}`, this.logContext);

      // Create payment link via myPOS service
      const paymentLink = await this.myposService.createPaymentLink({
        amount,
        currency,
        order_id,
        customer_email,
        customer_name,
        note,
        success_url,
        cancel_url,
      });

      // Update document with payment link ID
      await Document.findByIdAndUpdate(
        order_id,
        {
          $set: {
            'orderData.paymentLinkId': paymentLink.payment_link_id,
            'orderData.amount': amount,
            'orderData.currency': currency,
          },
        }
      );

      logger.info(`Payment link created for order: ${order_id}`, this.logContext);

      res.json({
        success: true,
        payment_link_id: paymentLink.payment_link_id,
        payment_url: paymentLink.payment_url,
        status: paymentLink.status,
        order_id,
      });
    } catch (error: any) {
      logger.error(error.message, `${this.logContext} -> createPaymentLink`);
      throw error;
    }
  }

  public getAccounts: RequestHandler = async (req, res) => {
    try {
      logger.info('Fetching accounts from myPOS', this.logContext);

      // Get accounts from myPOS
      const accountsData = await this.myposService.getAccounts();

      logger.info('Accounts retrieved successfully', this.logContext);

      res.json({
        success: true,
        data: accountsData,
      });
    } catch (error: any) {
      logger.error(error.message, `${this.logContext} -> getAccounts`);
      throw error;
    }
  }

  public getSettlementData: RequestHandler = async (req, res) => {
    try {
      logger.info('Fetching settlement data from myPOS', this.logContext);

      // Get settlement data from myPOS
      const settlementData = await this.myposService.getSettlementData();

      logger.info('Settlement data retrieved successfully', this.logContext);

      res.json({
        success: true,
        data: settlementData,
      });
    } catch (error: any) {
      logger.error(error.message, `${this.logContext} -> getSettlementData`);
      throw error;
    }
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


