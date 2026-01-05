import { RequestHandler } from 'express';
import logger from '@ipi-soft/logger';
import crypto from 'crypto';

import CustomError from '../utils/custom-error.utils';
import MyPosService from '../services/mypos.service';
import MyPosCheckoutService, { CartItem } from '../services/mypos-checkout.service';
import { Document, DocumentType } from '../models/document.model';
import DocumentDataLayer from '../data-layers/document.data-layer';
import OrderDataLayer from '../data-layers/order.data-layer';
import mongoose from 'mongoose';
import Config from '../config';

export default class PaymentController {
  
  private logContext = 'Payment Controller';
  private myposService = MyPosService.getInstance();
  private myposCheckoutService = MyPosCheckoutService.getInstance();
  private documentDataLayer = DocumentDataLayer.getInstance();
  private orderDataLayer = OrderDataLayer.getInstance();
  private config = Config.getInstance();

  /**
   * Create order and return signed payment parameters
   * POST /api/payment/create-order
   */
  public createOrder: RequestHandler = async (req, res) => {
    try {
      const { items, userId } = req.body;

      if (!items || !Array.isArray(items) || items.length === 0) {
        throw new CustomError(400, 'Missing or invalid items');
      }

      logger.info(`Creating order for ${items.length} items`);

      // Map items to match Order schema requirements
      const mappedItems = items.map((item: any) => ({
        id: item.id || `item-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
        type: item.type || 'package', // Default to 'package' if not specified
        name: item.name || 'Item',
        description: item.description || '',
        price: item.price || 0,
        formData: item.formData || {},
        documentIds: item.documentIds || [],
      }));

      // Calculate totals from BACKEND (never trust frontend!)
      let subtotal = 0;
      for (const item of mappedItems) {
        subtotal += item.price || 0;
      }

      const vat = subtotal * 0.2; // 20% VAT
      const total = subtotal + vat;

      // Generate unique order ID
      const orderId = this.generateOrderId();

      // Get customer data from authenticated user or request
      const customerData = {
        email: req.body.customerEmail || '',
        firstName: req.body.customerFirstName || '',
        lastName: req.body.customerLastName || '',
        phone: req.body.customerPhone,
        ip: req.ip || req.connection.remoteAddress,
      };

      // Create a Document for this order (package)
      // Even if it's a package with multiple items, we save it as one document
      logger.info(`Creating document for order: ${orderId}`);
      
      const documentData = {
        orderId,
        items: mappedItems,
        customerData,
        subtotal,
        vat,
        total,
        currency: 'EUR',
      };

      const document = await this.documentDataLayer.create({
        type: DocumentType.Other, // Use "Other" type for packages/orders
        data: documentData,
        orderData: {
          userId: userId ? (mongoose.Types.ObjectId.isValid(userId) ? new mongoose.Types.ObjectId(userId) as any : undefined) : undefined,
          email: customerData.email,
          cost: total,
          paid: false,
          amount: total,
          currency: 'EUR',
        },
      }, this.logContext);

      logger.info(`Document created: ${document._id}`);

      // Create order in database using data layer
      logger.info(`Saving order: ${orderId}`);
      
      const order = await this.orderDataLayer.create({
        orderId,
        userId: userId || undefined,
        items: mappedItems,
        subtotal,
        vat,
        total,
        expectedAmount: total,
        currency: 'EUR',
        status: 'pending',
        customerData,
      }, this.logContext);

      logger.info(`Order saved: ${orderId}`);

      logger.info(`Order created: ${orderId}, Total: €${total.toFixed(2)}`);

      // Prepare cart items for myPOS
      const cartItems: CartItem[] = mappedItems.map((item) => ({
        article: item.name,
        quantity: 1,
        price: item.price,
        amount: item.price,
        currency: 'EUR',
      }));

      // Add VAT as separate line item
      cartItems.push({
        article: 'ДДС (20%)',
        quantity: 1,
        price: vat,
        amount: vat,
        currency: 'EUR',
      });

      // Create payment parameters with signature
      // URLs must be HTTPS, no ports, publicly accessible
      const backendUrl = this.config.env === 'dev' 
        ? 'https://gotovdoc-backend-production.up.railway.app'
        : this.config.frontendUrl;
      
      const frontendUrl = this.config.env === 'dev'
        ? 'https://gotovdoc.bg'
        : this.config.frontendUrl;

      const paymentParams = this.myposCheckoutService.createPurchaseParams({
        Amount: total,
        Currency: 'EUR',
        OrderID: orderId,
        URL_OK: `${frontendUrl}/checkout/success?orderId=${orderId}`,
        URL_Cancel: `${frontendUrl}/checkout/cancel`,
        URL_Notify: `${backendUrl}/api/payment/notify`, // Must be HTTPS backend URL
        CustomerEmail: customerData.email || 'noemail@gotovdoc.bg',
        CustomerFirstNames: customerData.firstName || 'Customer', // Note: plural "Names"
        CustomerFamilyName: customerData.lastName || 'User', // Note: "FamilyName"
        CustomerPhone: customerData.phone,
        CustomerIP: customerData.ip,
        Note: `Order ${orderId}`,
        CartItems: cartItems,
      });

      res.json({
        orderId,
        documentId: document._id.toString(),
        amount: subtotal,
        vat,
        total,
        paymentParams,
      });
    } catch (error: any) {
      logger.error(error.message, `${this.logContext} -> createOrder`);
      throw error;
    }
  }

  /**
   * Handle myPOS IPC notification
   * POST /api/payment/notify
   */
  public handleIPCNotification: RequestHandler = async (req, res) => {
    try {
      logger.info('=== myPOS IPC Notification START ===');
      logger.info(`Headers: ${JSON.stringify(req.headers)}`);
      logger.info(`Body type: ${typeof req.body}`);
      logger.info(`Body content: ${JSON.stringify(req.body)}`);
      logger.info(`Body keys: ${req.body ? Object.keys(req.body).join(', ') : 'NO KEYS (body is undefined)'}`);

      // Check if body is empty or undefined
      if (!req.body || Object.keys(req.body).length === 0) {
        logger.error('Request body is empty or undefined!', this.logContext);
        // IMPORTANT: Always return 200 OK to myPOS (per their documentation)
        res.status(200).send('OK');
        return;
      }

      // Process and verify webhook
      logger.info('Processing webhook notification...');
      const webhookResult = this.myposCheckoutService.processWebhookNotification(req.body);
      logger.info(`Webhook verification result: ${JSON.stringify(webhookResult)}`);

      if (!webhookResult.isValid) {
        logger.error(`Invalid signature in IPC notification. Method: ${webhookResult.method}`, this.logContext);
        // IMPORTANT: Always return 200 OK to myPOS (per their documentation)
        // Returning 400 causes transaction reversal!
        res.status(200).send('OK');
        return;
      }

      const { orderID, amount, currency, transactionRef, status, statusMsg } = webhookResult;
      logger.info(`Parsed webhook data - OrderID: ${orderID}, Amount: ${amount}, Currency: ${currency}, Status: ${status}, StatusMsg: ${statusMsg}`);

      if (!orderID) {
        logger.error('No OrderID in notification', this.logContext);
        // IMPORTANT: Always return 200 OK to myPOS (per their documentation)
        res.status(200).send('OK');
        return;
      }

      // Find order in database
      logger.info(`Looking up order: ${orderID}`);
      const order = await this.orderDataLayer.getByOrderId(orderID, this.logContext).catch((err) => {
        logger.error(`Error fetching order: ${err.message}`, this.logContext);
        return null;
      });

      if (!order) {
        logger.error(`Order not found in database: ${orderID}`, this.logContext);
        // IMPORTANT: Always return 200 OK to myPOS (per their documentation)
        res.status(200).send('OK');
        return;
      }

      logger.info(`Order found: ${orderID}, Expected amount: ${order.expectedAmount}, Status: ${order.status}`);

      // CRITICAL: Verify amount matches expected amount
      if (amount && Math.abs(amount - order.expectedAmount) > 0.01) {
        logger.error(`FRAUD ATTEMPT! Amount mismatch for order ${orderID}! Expected: ${order.expectedAmount}, Got: ${amount}`, this.logContext);
        
        order.status = 'fraud_attempt';
        order.paidAmount = amount;
        await order.save();

        // IMPORTANT: Always return 200 OK to myPOS (per their documentation)
        // Log the fraud attempt but acknowledge receipt
        res.status(200).send('OK');
        return;
      }

      logger.info(`Amount verification passed for order ${orderID}`);

      // Check payment status
      if (status === '0') {
        // Payment successful!
        logger.info(`✅ Payment SUCCESSFUL for order ${orderID}`);

        logger.info(`Updating order ${orderID} to PAID status...`);
        order.status = 'paid';
        order.paidAmount = amount;
        order.paidAt = new Date();
        order.paymentData = {
          transactionRef,
          paymentReference: req.body.IPC_Trnref,
        };

        await order.save();
        logger.info(`Order ${orderID} saved with status: paid`);

        // Update the corresponding document
        try {
          logger.info(`Updating document for order ${orderID}...`);
          const updateResult = await this.documentDataLayer.updateByFilter(
            { 'data.orderId': orderID },
            {
              $set: {
                'orderData.paid': true,
                'orderData.paidAt': new Date(),
                'orderData.paymentLinkId': transactionRef,
                'orderData.amount': amount,
                'orderData.currency': currency,
              },
            },
            this.logContext
          );
          logger.info(`Document updated successfully for order ${orderID}`);
        } catch (docError: any) {
          logger.error(`Failed to update document for order ${orderID}: ${docError.message}`, this.logContext);
        }

        // TODO: Generate and send documents
        // await this.generateDocuments(order);
        // await this.sendDocumentsToCustomer(order);

        logger.info(`✅ Order ${orderID} marked as PAID - Transaction complete!`);
      } else {
        // Payment failed
        logger.info(`❌ Payment FAILED for order ${orderID}: ${statusMsg} (Status code: ${status})`);

        logger.info(`Updating order ${orderID} to FAILED status...`);
        order.status = 'failed';
        order.failedAt = new Date();
        await order.save();
        logger.info(`Order ${orderID} saved with status: failed`);

        // Update the corresponding document
        try {
          logger.info(`Updating document for failed order ${orderID}...`);
          await this.documentDataLayer.updateByFilter(
            { 'data.orderId': orderID },
            {
              $set: {
                'orderData.paid': false,
                'orderData.failedAt': new Date(),
              },
            },
            this.logContext
          );
          logger.info(`Document updated for failed order ${orderID}`);
        } catch (docError: any) {
          logger.error(`Failed to update document for failed order ${orderID}: ${docError.message}`, this.logContext);
        }
      }

      // Return OK to myPOS
      logger.info(`Returning 200 OK to myPOS for order ${orderID}`);
      logger.info('=== myPOS IPC Notification END (SUCCESS) ===');
      res.status(200).send('OK');
    } catch (error: any) {
      logger.error(`ERROR in handleIPCNotification: ${error.message}`, this.logContext);
      logger.error(`Error stack: ${error.stack}`, this.logContext);
      logger.info('=== myPOS IPC Notification END (ERROR) ===');
      // Return OK to prevent retries
      res.status(200).send('OK');
    }
  }

  /**
   * Handle old REST API webhook (for payment links/buttons)
   */
  public handleWebhook: RequestHandler = async (req, res) => {
    try {
      const webhookData = req.body;

      logger.info(`Received REST API webhook: ${JSON.stringify(webhookData)}`);

      const { event_type, payment_link_id, order_id, status, amount, currency } = webhookData;

      if (event_type === 'payment.completed' && status === 'success') {
        await this.updateDocumentPaymentStatus(order_id, {
          paid: true,
          paymentLinkId: payment_link_id,
          paidAt: new Date(),
          amount,
          currency,
        });

        logger.info(`Payment completed for order: ${order_id}`);
      } else if (event_type === 'payment.failed' || status === 'failed') {
        await this.updateDocumentPaymentStatus(order_id, {
          paid: false,
          paymentLinkId: payment_link_id,
          failedAt: new Date(),
        });

        logger.info(`Payment failed for order: ${order_id}`);
      }

      res.status(200).json({ received: true });
    } catch (error: any) {
      logger.error(error.message, `${this.logContext} -> handleWebhook`);
      res.status(200).json({ received: true, error: 'Processing error' });
    }
  }

  private generateOrderId(): string {
    const timestamp = Date.now().toString(36).toUpperCase();
    const random = crypto.randomBytes(4).toString('hex').toUpperCase();
    return `ORD-${timestamp}-${random}`;
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
      logger.info('Creating payment button');

      // Create payment button via myPOS service
      const paymentButton = await this.myposService.createPaymentButton(req.body);

      logger.info('Payment button created successfully');

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

      logger.info(`Creating payment link for order: ${order_id}`);

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

      logger.info(`Payment link created for order: ${order_id}`);

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
      logger.info('Fetching accounts from myPOS');

      // Get accounts from myPOS
      const accountsData = await this.myposService.getAccounts();

      logger.info('Accounts retrieved successfully');

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
      logger.info('Fetching settlement data from myPOS');

      // Get settlement data from myPOS
      const settlementData = await this.myposService.getSettlementData();

      logger.info('Settlement data retrieved successfully');

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


