import crypto from 'crypto';
import logger from '@ipi-soft/logger';
import mongoose from 'mongoose';
import { RequestHandler } from 'express';

import CustomError from './../utils/custom-error.utils';

import MyPosCheckoutService, { CartItem } from './../services/mypos-checkout.service';
import MyPosService from './../services/mypos.service';
import PriceValidationService from './../services/price-validation.service';

import DocumentDataLayer from './../data-layers/document.data-layer';
import OrderDataLayer from './../data-layers/order.data-layer';

import { DocumentType } from './../models/document.model';

import Config from './../config';

export default class PaymentController {

  private logContext = 'Payment Controller';
  private myposService = MyPosService.getInstance();
  private myposCheckoutService = MyPosCheckoutService.getInstance();
  private documentDataLayer = DocumentDataLayer.getInstance();
  private orderDataLayer = OrderDataLayer.getInstance();
  private priceValidationService = PriceValidationService;
  private config = Config.getInstance();

  /**
   * Get available documents and packages with prices
   * GET /api/payment/prices
   */
  public getPrices: RequestHandler = async (req, res) => {
    const logContext = `${this.logContext} -> getPrices()`;

    try {
      const documents = this.priceValidationService.getAllDocumentPrices();
      const packages = this.priceValidationService.getAllPackagePrices();

      res.status(200).json({
        documents,
        packages,
        vatRate: 0.20,
        currency: 'EUR',
      });
    } catch (error: any) {
      logger.error(`Failed to get prices: ${error.message}`, logContext);
      throw new CustomError(500, 'Failed to retrieve prices', logContext);
    }
  };

  /**
   * Create order and return signed payment parameters
   * POST /api/payment/create-order
   */
  public createOrder: RequestHandler = async (req, res) => {
    const logContext = `${this.logContext} -> createOrder()`;

    try {
      const { items, userId } = req.body;
      const authUserId = req.user?._id?.toString();
      const resolvedUserId = authUserId || userId;

      if (!items || !Array.isArray(items) || items.length === 0) {
        throw new CustomError(400, 'Missing or invalid items');
      }

      // SECURITY: Validate prices against backend configuration
      const validation = this.priceValidationService.validateOrder(items);

      if (!validation.isValid) {
        logger.error(`Price validation failed: ${validation.errors.join(', ')}`, logContext);
        throw new CustomError(400, `Invalid prices: ${validation.errors.join(', ')}`);
      }

      // Use BACKEND prices (never trust frontend!)
      const subtotal = validation.expectedAmount;
      const vat = validation.expectedVat;
      const total = validation.expectedTotal;

      // Map items to match Order schema requirements
      // IMPORTANT: Use backend prices, not frontend prices
      const mappedItems = items.map((item: any) => {
        const expectedPrice = this.priceValidationService.getItemPriceInfo(item.id, item.type).price || 0;

        return {
          id: item.id || `item-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
          type: item.type || 'package',
          name: item.name || 'Item',
          description: item.description || '',
          price: expectedPrice, // Use backend price, not frontend price!
          formData: item.formData || {},
          documentIds: item.documentIds || [],
        };
      });

      // Generate unique order ID
      const orderId = this.generateOrderId();

      // Get customer data from authenticated user or request
      const customerData = {
        email: req.body.customerEmail || req.user?.email || '',
        firstName: req.body.customerFirstName || req.user?.firstName || '',
        lastName: req.body.customerLastName || req.user?.lastName || '',
        phone: req.body.customerPhone,
        ip: req.ip || req.connection.remoteAddress,
      };

      // Create a Document for this order (package)
      // Even if it's a package with multiple items, we save it as one document
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
        userId: resolvedUserId as any,
      }, logContext);

      // Create order in database using data layer
      const order = await this.orderDataLayer.create({
        orderId,
        documentId: document._id, // Link to the Document collection
        userId: resolvedUserId || undefined,
        items: mappedItems,
        subtotal,
        vat,
        total,
        expectedAmount: total,
        currency: 'EUR',
        status: 'pending',
        customerData,
      }, logContext);

      await this.documentDataLayer.update(
        document._id,
        {
          orderId: order._id,
        },
        logContext
      );

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
      logger.error(error.message, logContext);
      throw error;
    }
  }

  /**
   * Get signed payment parameters for an existing order
   * GET /api/payment/params/:orderId
   */
  public getPaymentParams: RequestHandler = async (req, res) => {
    const logContext = `${this.logContext} -> getPaymentParams()`;

    try {
      const { orderId } = req.params;

      if (!orderId) {
        throw new CustomError(400, 'Order ID is required');
      }

      // Find order in database
      const order = await this.orderDataLayer.getByOrderId(orderId, logContext);

      if (!order) {
        throw new CustomError(404, 'Order not found');
      }

      // Check if order is already paid
      if (order.status === 'paid' || order.status === 'finished') {
        throw new CustomError(400, 'Order is already paid');
      }

      // Prepare cart items for myPOS
      const cartItems: CartItem[] = order.items.map((item) => ({
        article: item.name,
        quantity: 1,
        price: item.price,
        amount: item.price,
        currency: order.currency,
      }));

      // Add VAT as separate line item if applicable
      if (order.vat > 0) {
        cartItems.push({
          article: `ДДС (${(order.vat / order.subtotal * 100).toFixed(0)}%)`,
          quantity: 1,
          price: order.vat,
          amount: order.vat,
          currency: order.currency,
        });
      }

      // Determine backend and frontend URLs based on environment
      const backendUrl = this.config.env === 'prod'
        ? process.env.BACKEND_URL || 'https://gotovdoc-backend-production.up.railway.app'
        : 'https://gotovdoc-backend-production.up.railway.app';

      const frontendUrl = this.config.env === 'prod'
        ? 'https://gotovdoc.bg'
        : 'https://gotovdoc.bg';

      const paymentParams = this.myposCheckoutService.createPurchaseParams({
        Amount: order.total,
        Currency: order.currency,
        OrderID: order.orderId,
        URL_OK: `${frontendUrl}/checkout/success?orderId=${order.orderId}`,
        URL_Cancel: `${frontendUrl}/checkout/cancel`,
        URL_Notify: `${backendUrl}/api/payment/notify`,
        CustomerEmail: order.customerData.email || 'noemail@gotovdoc.bg',
        CustomerFirstNames: order.customerData.firstName || 'Customer',
        CustomerFamilyName: order.customerData.lastName || 'User',
        CustomerPhone: order.customerData.phone,
        CustomerIP: order.customerData.ip,
        Note: `Order ${order.orderId}`,
        CartItems: cartItems,
      });

      res.json({
        success: true,
        data: {
          orderId: order.orderId,
          amount: order.subtotal,
          vat: order.vat,
          total: order.total,
          currency: order.currency,
          paymentParams,
        }
      });
    } catch (error: any) {
      logger.error(error.message, logContext);
      throw error;
    }
  }

  /**
   * Handle myPOS IPC notification
   * POST /api/payment/notify
   * 
   * Note: Security validation is handled by validateMyPosWebhook middleware
   * This controller focuses on business logic: processing payments and updating orders
   */
  public handleIPCNotification: RequestHandler = async (req, res) => {
    const logContext = `${this.logContext} -> handleIPCNotification()`;

    try {
      // Process and verify webhook (signature validation)
      const webhookResult = this.myposCheckoutService.processWebhookNotification(req.body);

      if (!webhookResult.isValid) {
        logger.error('Invalid webhook signature', logContext);
        res.status(200).send('OK');
        return;
      }

      const { orderID, amount, currency, transactionRef, isSuccess } = webhookResult;

      if (!orderID) {
        logger.error('No OrderID in webhook', logContext);
        res.status(200).send('OK');
        return;
      }

      // Find order in database
      const order = await this.orderDataLayer.getByOrderId(orderID, logContext).catch((err) => {
        logger.error(`Error fetching order: ${err.message}`, logContext);
        return null;
      });

      if (!order) {
        logger.error(`Order not found: ${orderID}`, logContext);
        res.status(200).send('OK');
        return;
      }

      // CRITICAL: Verify amount matches expected amount
      // Use price validation service for extra security
      const isValidAmount = this.priceValidationService.validatePaymentAmount(
        orderID,
        amount || 0,
        order.expectedAmount
      );

      if (!isValidAmount) {
        order.status = 'fraud_attempt';
        order.paidAmount = amount;
        await order.save();

        res.status(200).send('OK');
        return;
      }

      // Check payment status based on IPCmethod
      if (isSuccess) {
        // Payment successful (IPCPurchaseNotify or IPCPurchaseOK)
        order.status = 'paid';
        order.paidAmount = amount;
        order.paidAt = new Date();
        order.paymentData = {
          transactionRef,
          paymentReference: req.body.IPC_Trnref,
        };

        await order.save();

        // TODO: Generate and send documents
        // await this.generateDocuments(order);
        // await this.sendDocumentsToCustomer(order);
      } else {
        // Payment failed or cancelled (IPCPurchaseRollback or IPCPurchaseCancel)
        order.status = 'failed';
        order.failedAt = new Date();
        await order.save();

        if (!order.documentId) {
          logger.error(`Order ${orderID} has no documentId`, logContext);
        }
      }

      res.status(200).send('OK');
    } catch (error: any) {
      logger.error(`Webhook error: ${error.message}`, logContext);
      // Return OK to prevent retries
      res.status(200).send('OK');
    }
  }

  /**
   * Handle old REST API webhook (for payment links/buttons)
   */
  public handleWebhook: RequestHandler = async (req, res) => {
    const logContext = `${this.logContext} -> handleWebhook()`;

    try {
      const webhookData = req.body;


      const { event_type, payment_link_id, order_id, status, amount, currency } = webhookData;

      if (event_type === 'payment.completed' && status === 'success') {
        await this.updateOrderPaymentStatus(order_id, {
          paid: true,
          paymentLinkId: payment_link_id,
          paidAt: new Date(),
          amount,
          currency,
        });

      } else if (event_type === 'payment.failed' || status === 'failed') {
        await this.updateOrderPaymentStatus(order_id, {
          paid: false,
          paymentLinkId: payment_link_id,
          failedAt: new Date(),
        });

      }

      res.status(200).json({ received: true });
    } catch (error: any) {
      logger.error(error.message, logContext);
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

    if (!orderId) {
      throw new CustomError(400, 'Invalid order ID');
    }

    const order = mongoose.isValidObjectId(orderId)
      ? await this.orderDataLayer.getById(orderId, this.logContext)
      : await this.orderDataLayer.getByOrderId(orderId, this.logContext);

    res.json({
      orderId,
      paid: order.status === 'paid' || order.status === 'finished',
      amount: order.paidAmount ?? order.total,
      currency: order.currency,
      paidAt: order.paidAt,
    });
  }

  public createPaymentButton: RequestHandler = async (req, res) => {
    const logContext = `${this.logContext} -> createPaymentButton()`;

    try {

      // Create payment button via myPOS service
      const paymentButton = await this.myposService.createPaymentButton(req.body);


      res.json({
        success: true,
        data: paymentButton,
      });
    } catch (error: any) {
      logger.error(error.message, logContext);
      throw error;
    }
  }

  public createPaymentLink: RequestHandler = async (req, res) => {
    const logContext = `${this.logContext} -> createPaymentLink()`;

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

      const order = mongoose.isValidObjectId(order_id)
        ? await this.orderDataLayer.getById(order_id, logContext)
        : await this.orderDataLayer.getByOrderId(order_id, logContext);


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
      await this.orderDataLayer.update(
        order._id,
        {
          $set: {
            paymentData: {
              paymentReference: paymentLink.payment_link_id,
            },
            paidAmount: amount,
            currency,
          },
        },
        logContext
      );


      res.json({
        success: true,
        payment_link_id: paymentLink.payment_link_id,
        payment_url: paymentLink.payment_url,
        status: paymentLink.status,
        order_id,
      });
    } catch (error: any) {
      logger.error(error.message, logContext);
      throw error;
    }
  }

  public getAccounts: RequestHandler = async (req, res) => {
    const logContext = `${this.logContext} -> getAccounts()`;

    try {

      // Get accounts from myPOS
      const accountsData = await this.myposService.getAccounts();


      res.json({
        success: true,
        data: accountsData,
      });
    } catch (error: any) {
      logger.error(error.message, logContext);
      throw error;
    }
  }

  public getSettlementData: RequestHandler = async (req, res) => {
    const logContext = `${this.logContext} -> getSettlementData()`;

    try {

      // Get settlement data from myPOS
      const settlementData = await this.myposService.getSettlementData();


      res.json({
        success: true,
        data: settlementData,
      });
    } catch (error: any) {
      logger.error(error.message, logContext);
      throw error;
    }
  }

  private async updateOrderPaymentStatus(orderId: string, paymentData: any): Promise<void> {
    const update: any = {
      paymentData: {
        paymentReference: paymentData.paymentLinkId,
      },
      paidAmount: paymentData.amount,
      currency: paymentData.currency,
    };

    if (paymentData.paid) {
      update.status = 'paid';
      update.paidAt = paymentData.paidAt || new Date();
    } else {
      update.status = 'failed';
      update.failedAt = paymentData.failedAt || new Date();
    }

    if (mongoose.isValidObjectId(orderId)) {
      await this.orderDataLayer.update(orderId, { $set: update }, this.logContext);
      return;
    }

    await this.orderDataLayer.updateByOrderId(orderId, { $set: update }, this.logContext);
  }
}
