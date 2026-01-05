import { RequestHandler } from 'express';
import logger from '@ipi-soft/logger';
import mongoose from 'mongoose';

import CustomError from '../utils/custom-error.utils';
import MyPosCheckoutService from '../services/mypos-checkout.service';
import { Document } from '../models/document.model';
import Config from '../config';

/**
 * Controller for myPOS Checkout API v1.4
 */
export default class CheckoutController {
  
  private logContext = 'Checkout Controller';
  private checkoutService = MyPosCheckoutService.getInstance();
  private config = Config.getInstance();

  /**
   * Create a checkout session (returns form HTML or data for frontend to submit)
   */
  public createCheckout: RequestHandler = async (req, res) => {
    try {
      const { 
        orderId, 
        amount, 
        currency, 
        customerEmail, 
        customerPhone,
        customerFirstName,
        customerLastName,
        note 
      } = req.body;

      // Validate required fields
      if (!orderId || !amount || !currency) {
        throw new CustomError(400, 'Missing required fields: orderId, amount, currency');
      }

      // Validate order exists
      if (!mongoose.isValidObjectId(orderId)) {
        throw new CustomError(400, 'Invalid orderId format');
      }

      const document = await Document.findById(orderId);
      if (!document) {
        throw new CustomError(404, 'Order not found');
      }

      // Convert amount to minor units (cents)
      const amountInCents = Math.round(amount * 100);

      logger.info(`Creating checkout for order: ${orderId}`, this.logContext);

      // Build purchase form
      const formHTML = this.checkoutService.buildPurchaseForm({
        Amount: amountInCents,
        Currency: currency,
        OrderID: orderId,
        URL_OK: `${this.config.mypos.successUrl}?orderId=${orderId}`,
        URL_Cancel: `${this.config.mypos.cancelUrl}?orderId=${orderId}`,
        URL_Notify: `${this.config.frontendUrl}/api/checkout/webhook/notify`,
        CustomerEmail: customerEmail,
        CustomerPhone: customerPhone,
        CustomerFirstName: customerFirstName,
        CustomerLastName: customerLastName,
        Note: note || 'Document payment',
      });

      // Update document with checkout initiated
      await Document.findByIdAndUpdate(orderId, {
        $set: {
          'orderData.amount': amount,
          'orderData.currency': currency,
        },
      });

      logger.info(`Checkout form generated for order: ${orderId}`, this.logContext);

      // Return form HTML for frontend to render and auto-submit
      res.json({
        success: true,
        checkoutFormHTML: formHTML,
        orderId,
      });
    } catch (error: any) {
      logger.error(error.message, `${this.logContext} -> createCheckout`);
      throw error;
    }
  }

  /**
   * Handle webhook notification from myPOS (IPCPurchaseNotify)
   */
  public handleWebhookNotify: RequestHandler = async (req, res) => {
    try {
      const webhookData = req.body;
      logger.info(`Received webhook notification: ${JSON.stringify(webhookData)}`, this.logContext);

      // Process and verify webhook
      const result = this.checkoutService.processWebhookNotification(webhookData);

      if (!result.isValid) {
        logger.error('Invalid webhook signature', this.logContext);
        res.status(400).send('Invalid signature');
        return;
      }

      // Handle successful payment
      if (result.method === 'IPCPurchaseNotify' && result.status === '0') {
        const orderId = result.orderID;

        if (orderId && mongoose.isValidObjectId(orderId)) {
          await Document.findByIdAndUpdate(orderId, {
            $set: {
              'orderData.paid': true,
              'orderData.paidAt': new Date(),
              'orderData.paymentLinkId': result.transactionRef,
              'orderData.amount': result.amount ? result.amount / 100 : undefined,
              'orderData.currency': result.currency,
            },
          });

          logger.info(`Payment successful for order: ${orderId}`, this.logContext);
        }
      }

      // Handle canceled payment
      if (result.method === 'IPCPurchaseCancel') {
        const orderId = result.orderID;

        if (orderId && mongoose.isValidObjectId(orderId)) {
          await Document.findByIdAndUpdate(orderId, {
            $set: {
              'orderData.paid': false,
              'orderData.failedAt': new Date(),
            },
          });

          logger.info(`Payment canceled for order: ${orderId}`, this.logContext);
        }
      }

      // Return OK response (myPOS expects this)
      res.status(200).send('OK');
    } catch (error: any) {
      logger.error(error.message, `${this.logContext} -> handleWebhookNotify`);
      // Still return 200 to avoid webhook retry storms
      res.status(200).send('OK');
    }
  }

  /**
   * Get transaction status for an order
   */
  public getTransactionStatus: RequestHandler = async (req, res) => {
    try {
      const { orderId } = req.params;

      if (!orderId || !mongoose.isValidObjectId(orderId)) {
        throw new CustomError(400, 'Invalid orderId');
      }

      logger.info(`Getting transaction status for order: ${orderId}`, this.logContext);

      const status = await this.checkoutService.getTransactionStatus({
        OrderID: orderId,
        OutputFormat: 'json',
      });

      res.json({
        success: true,
        data: status,
      });
    } catch (error: any) {
      logger.error(error.message, `${this.logContext} -> getTransactionStatus`);
      throw error;
    }
  }

  /**
   * Create a refund for a transaction
   */
  public createRefund: RequestHandler = async (req, res) => {
    try {
      const { orderId, transactionRef, amount, currency } = req.body;

      if (!orderId || !transactionRef || !amount || !currency) {
        throw new CustomError(400, 'Missing required fields: orderId, transactionRef, amount, currency');
      }

      if (!mongoose.isValidObjectId(orderId)) {
        throw new CustomError(400, 'Invalid orderId format');
      }

      // Verify order exists
      const document = await Document.findById(orderId);
      if (!document) {
        throw new CustomError(404, 'Order not found');
      }

      // Convert amount to minor units (cents)
      const amountInCents = Math.round(amount * 100);

      logger.info(`Creating refund for order: ${orderId}`, this.logContext);

      const refundResult = await this.checkoutService.createRefund({
        OrderID: orderId,
        IPC_Trnref: transactionRef,
        Amount: amountInCents,
        Currency: currency,
        OutputFormat: 'json',
      });

      // Update document with refund info
      if (refundResult.Status === '0') {
        await Document.findByIdAndUpdate(orderId, {
          $set: {
            'orderData.refunded': true,
            'orderData.refundedAt': new Date(),
          },
        });
      }

      logger.info(`Refund processed for order: ${orderId}`, this.logContext);

      res.json({
        success: true,
        data: refundResult,
      });
    } catch (error: any) {
      logger.error(error.message, `${this.logContext} -> createRefund`);
      throw error;
    }
  }

  /**
   * TEST ENDPOINT: Create a test payment form (for production testing)
   * This should be removed or protected in production
   */
  public createTestPayment: RequestHandler = async (req, res) => {
    try {
      logger.info('Creating test payment form', this.logContext);

      // Create a test document in the database
      const testDocument = await Document.create({
        type: 0, // DocumentType.Speciment
        data: { name: 'Test User', egn: '1234567890' },
        orderData: {
          email: 'test@gotovdoc.bg',
          cost: 1.0,
          amount: 100, // 1.00 EUR in cents
          currency: 'EUR',
        },
      });

      // Generate checkout form HTML
      const formHTML = this.checkoutService.buildPurchaseForm({
        Amount: 100, // 1.00 EUR in cents
        Currency: 'EUR',
        OrderID: testDocument._id.toString(),
        URL_OK: `https://gotovdoc.bg/payment/success?orderId=${testDocument._id}`,
        URL_Cancel: `https://gotovdoc.bg/payment/cancel?orderId=${testDocument._id}`,
        URL_Notify: `https://gotovdoc-backend-production.up.railway.app/api/checkout/webhook/notify`,
        CustomerEmail: 'test@gotovdoc.bg',
        CustomerFirstName: 'Иван',
        CustomerLastName: 'Тестов',
        Note: 'Тестово плащане - GotovDoc',
      });

      logger.info(`Test payment form created for order: ${testDocument._id}`, this.logContext);

      // Return HTML form that will auto-submit
      res.status(200).send(formHTML);
    } catch (error: any) {
      logger.error(error.message, `${this.logContext} -> createTestPayment`);
      throw error;
    }
  }
}

