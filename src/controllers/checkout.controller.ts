import { RequestHandler } from 'express';
import logger from '@ipi-soft/logger';
import mongoose from 'mongoose';

import CustomError from './../utils/custom-error.utils';
import MyPosCheckoutService from './../services/mypos-checkout.service';
import DocumentDataLayer from './../data-layers/document.data-layer';
import OrderDataLayer from './../data-layers/order.data-layer';
import { DocumentType } from './../models/document.model';
import Config from './../config';

/**
 * Controller for myPOS Checkout API v1.4
 */
export default class CheckoutController {
  
  private logContext = 'Checkout Controller';
  private checkoutService = MyPosCheckoutService.getInstance();
  private config = Config.getInstance();
  private documentDataLayer = DocumentDataLayer.getInstance();
  private orderDataLayer = OrderDataLayer.getInstance();

  /**
   * Create a checkout session (returns form HTML or data for frontend to submit)
   */
  public createCheckout: RequestHandler = async (req, res) => {
    const logContext = `${this.logContext} -> createCheckout()`;

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

      const order = await this.resolveOrder(orderId, logContext);

      // Convert amount to minor units (cents)
      const amountInCents = Math.round(amount * 100);


      // Build purchase form
      const formHTML = this.checkoutService.buildPurchaseForm({
        Amount: amountInCents,
        Currency: currency,
        OrderID: order.orderId,
        URL_OK: `${this.config.mypos.successUrl}?orderId=${order.orderId}`,
        URL_Cancel: `${this.config.mypos.cancelUrl}?orderId=${order.orderId}`,
        URL_Notify: `${this.config.frontendUrl}/api/checkout/webhook/notify`,
        CustomerEmail: customerEmail || 'noemail@gotovdoc.bg',
        CustomerFirstNames: customerFirstName || 'Customer', // Note: plural "Names"
        CustomerFamilyName: customerLastName || 'User', // Note: "FamilyName"
        CustomerPhone: customerPhone,
        Note: note || 'Document payment',
      });

      // Update order with checkout initiated
      await this.orderDataLayer.update(order._id, {
        $set: {
          paidAmount: amount,
          currency,
        },
      }, logContext);


      // Return form HTML for frontend to render and auto-submit
      res.json({
        success: true,
        checkoutFormHTML: formHTML,
        orderId,
      });
    } catch (error: any) {
      logger.error(error.message, logContext);
      throw error;
    }
  }

  /**
   * Handle webhook notification from myPOS (IPCPurchaseNotify)
   */
  public handleWebhookNotify: RequestHandler = async (req, res) => {
    const logContext = `${this.logContext} -> handleWebhookNotify()`;

    try {
      const webhookData = req.body;

      // Process and verify webhook
      const result = this.checkoutService.processWebhookNotification(webhookData);

      if (!result.isValid) {
        logger.error('Invalid webhook signature', logContext);
        res.status(400).send('Invalid signature');
        return;
      }

      // Handle successful payment
      if (result.isSuccess) {
        const orderId = result.orderID;

        if (orderId) {
          const order = await this.resolveOrder(orderId, logContext);
          await this.orderDataLayer.update(order._id, {
            $set: {
              status: 'paid',
              paidAt: new Date(),
              paidAmount: result.amount,
              currency: result.currency,
              paymentData: {
                transactionRef: result.transactionRef,
              },
            },
          }, logContext);
        }
      }

      // Handle canceled/failed payment
      if (!result.isSuccess) {
        const orderId = result.orderID;

        if (orderId) {
          const order = await this.resolveOrder(orderId, logContext);
          await this.orderDataLayer.update(order._id, {
            $set: {
              status: 'failed',
              failedAt: new Date(),
            },
          }, logContext);
        }
      }

      // Return OK response (myPOS expects this)
      res.status(200).send('OK');
    } catch (error: any) {
      logger.error(error.message, logContext);
      // Still return 200 to avoid webhook retry storms
      res.status(200).send('OK');
    }
  }

  /**
   * Get transaction status for an order
   */
  public getTransactionStatus: RequestHandler = async (req, res) => {
    const logContext = `${this.logContext} -> getTransactionStatus()`;

    try {
      const { orderId } = req.params;

      if (!orderId) {
        throw new CustomError(400, 'Invalid orderId');
      }

      const order = await this.resolveOrder(orderId, logContext);

      const status = await this.checkoutService.getTransactionStatus({
        OrderID: order.orderId,
        OutputFormat: 'json',
      });

      res.json({
        success: true,
        data: status,
      });
    } catch (error: any) {
      logger.error(error.message, logContext);
      throw error;
    }
  }

  /**
   * Create a refund for a transaction
   */
  public createRefund: RequestHandler = async (req, res) => {
    const logContext = `${this.logContext} -> createRefund()`;

    try {
      const { orderId, transactionRef, amount, currency } = req.body;

      if (!orderId || !transactionRef || !amount || !currency) {
        throw new CustomError(400, 'Missing required fields: orderId, transactionRef, amount, currency');
      }

      // Verify order exists
      const order = await this.resolveOrder(orderId, logContext);

      // Convert amount to minor units (cents)
      const amountInCents = Math.round(amount * 100);


      const refundResult = await this.checkoutService.createRefund({
        OrderID: order.orderId,
        IPC_Trnref: transactionRef,
        Amount: amountInCents,
        Currency: currency,
        OutputFormat: 'json',
      });

      // Update order with refund info
      if (refundResult.Status === '0') {
        await this.orderDataLayer.update(order._id, {
          $set: {
            status: 'cancelled',
            failedAt: new Date(),
          },
        }, logContext);
      }


      res.json({
        success: true,
        data: refundResult,
      });
    } catch (error: any) {
      logger.error(error.message, logContext);
      throw error;
    }
  }

  /**
   * TEST ENDPOINT: Create a test payment form (for production testing)
   * This should be removed or protected in production
   */
  public createTestPayment: RequestHandler = async (req, res) => {
    const logContext = `${this.logContext} -> createTestPayment()`;

    try {

      // Create a test document in the database
      const testDocument = await this.documentDataLayer.create({
        type: DocumentType.Speciment,
        data: { name: 'Test User', egn: '1234567890' },
      }, logContext);

      const orderId = `ORD-${Date.now()}-${Math.floor(Math.random() * 1000)}`;
      const testOrder = await this.orderDataLayer.create({
        orderId,
        documentId: testDocument._id,
        items: [{
          id: 'test-item',
          type: 'document',
          name: 'Test Document',
          description: 'Test order',
          price: 1.0,
          formData: {},
        }],
        subtotal: 1.0,
        vat: 0,
        total: 1.0,
        expectedAmount: 1.0,
        currency: 'EUR',
        status: 'pending',
        customerData: {
          email: 'test@gotovdoc.bg',
          firstName: 'Test',
          lastName: 'User',
        },
        documentsGenerated: false,
        documentsSent: false,
      }, logContext);

      await this.documentDataLayer.update(testDocument._id, { orderId: testOrder._id }, logContext);

      // Generate checkout form HTML
      const formHTML = this.checkoutService.buildPurchaseForm({
        Amount: 100, // 1.00 EUR in cents
        Currency: 'EUR',
        OrderID: testOrder.orderId,
        URL_OK: `https://gotovdoc.bg/payment/success?orderId=${testOrder.orderId}`,
        URL_Cancel: `https://gotovdoc.bg/payment/cancel?orderId=${testOrder.orderId}`,
        URL_Notify: `https://gotovdoc-backend-production.up.railway.app/api/checkout/webhook/notify`,
        CustomerEmail: 'test@gotovdoc.bg',
        CustomerFirstNames: 'Иван', // Note: plural "Names"
        CustomerFamilyName: 'Тестов', // Note: "FamilyName"
        Note: 'Тестово плащане - GotovDoc',
      });


      // Return HTML form that will auto-submit
      res.status(200).send(formHTML);
    } catch (error: any) {
      logger.error(error.message, logContext);
      throw error;
    }
  }

  private async resolveOrder(orderId: string, logContext: string) {
    if (mongoose.isValidObjectId(orderId)) {
      try {
        return await this.orderDataLayer.getById(orderId, logContext);
      } catch (err) {
        const document = await this.documentDataLayer.getById(orderId, logContext).catch(() => null);
        if (document?.orderId) {
          return await this.orderDataLayer.getById(document.orderId.toString(), logContext);
        }
      }
    }

    return await this.orderDataLayer.getByOrderId(orderId, logContext);
  }
}
