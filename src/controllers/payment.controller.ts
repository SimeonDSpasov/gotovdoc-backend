import { RequestHandler } from 'express';
import logger from '@ipi-soft/logger';
import crypto from 'crypto';

import CustomError from '../utils/custom-error.utils';
import MyPosCheckoutService, { CartItem } from '../services/mypos-checkout.service';
import { Document, DocumentType } from '../models/document.model';
import DocumentDataLayer from '../data-layers/document.data-layer';
import OrderDataLayer from '../data-layers/order.data-layer';
import mongoose from 'mongoose';
import Config from '../config';

export default class PaymentController {
  
  private logContext = 'Payment Controller';
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
      // Determine backend and frontend URLs based on environment
      const backendUrl = this.config.env === 'prod'
        ? process.env.BACKEND_URL || 'https://gotovdoc-backend-production.up.railway.app'
        : 'https://gotovdoc-backend-production.up.railway.app'; // Test also uses Railway
      
      const frontendUrl = this.config.env === 'prod'
        ? 'https://gotovdoc.bg'
        : 'https://gotovdoc.bg'; // Test also uses production frontend

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

  private generateOrderId(): string {
    const timestamp = Date.now().toString(36).toUpperCase();
    const random = crypto.randomBytes(4).toString('hex').toUpperCase();
    return `ORD-${timestamp}-${random}`;
  }
}


