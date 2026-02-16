import crypto from 'crypto';
import logger from '@ipi-soft/logger';
import mongoose from 'mongoose';
import Stripe from 'stripe';
import { RequestHandler } from 'express';

import CustomError from './../utils/custom-error.utils';

import StripeService, { StripeSaleType } from './../services/stripe.service';
import PriceValidationService from './../services/price-validation.service';

import DocumentDataLayer from './../data-layers/document.data-layer';
import OrderDataLayer from './../data-layers/order.data-layer';
import TrademarkOrderDataLayer from './../data-layers/trademark-order.data-layer';
import StripeEventDataLayer from './../data-layers/stripe-event.data-layer';

import { DocumentType } from './../models/document.model';

import Config from './../config';

export default class StripeController {

  private logContext = 'Stripe Controller';
  private stripeService = StripeService.getInstance();
  private documentDataLayer = DocumentDataLayer.getInstance();
  private orderDataLayer = OrderDataLayer.getInstance();
  private trademarkOrderDataLayer = TrademarkOrderDataLayer.getInstance();
  private stripeEventDataLayer = StripeEventDataLayer.getInstance();
  private priceValidationService = PriceValidationService;
  private config = Config.getInstance();

  /**
   * GET /api/stripe/prices
   * Get available documents and packages with prices
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
   * POST /api/stripe/create-order
   * Create order and return Stripe checkout client secret
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
      const mappedItems = items.map((item: any) => {
        const expectedPrice = this.priceValidationService.getItemPriceInfo(item.id, item.type).price || 0;

        return {
          id: item.id || `item-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
          type: item.type || 'package',
          name: item.name || 'Item',
          description: item.description || '',
          price: expectedPrice,
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
        ip: req.ip || req.connection?.remoteAddress,
      };

      // Create a Document for this order
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
        type: DocumentType.Other,
        data: documentData,
        userId: resolvedUserId as any,
      }, logContext);

      // Create order in database
      const order = await this.orderDataLayer.create({
        orderId,
        documentId: document._id,
        userId: resolvedUserId || undefined,
        items: mappedItems,
        subtotal,
        vat,
        total,
        expectedAmount: total,
        currency: 'EUR',
        status: 'pending',
        paymentMethod: 'stripe',
        customerData,
      }, logContext);

      await this.documentDataLayer.update(
        document._id,
        { orderId: order._id },
        logContext
      );

      // Build description from item names
      const description = mappedItems.map((i: any) => i.name).join(', ');

      // Create Stripe checkout session
      const frontendUrl = this.config.frontendUrl;

      const clientSecret = await this.stripeService.createCheckoutSession({
        orderId,
        amount: total,
        currency: 'EUR',
        customerEmail: customerData.email || 'noemail@gotovdoc.bg',
        orderType: StripeSaleType.Order,
        description,
        returnUrl: `${frontendUrl}/checkout/success?orderId=${orderId}`,
      }, logContext);

      res.json({
        orderId,
        documentId: document._id.toString(),
        amount: subtotal,
        vat,
        total,
        clientSecret,
      });
    } catch (error: any) {
      logger.error(error.message, logContext);
      throw error;
    }
  }

  /**
   * POST /api/stripe/create-session/checkout
   * Create a Stripe checkout session for an existing order (used by trademark and other flows)
   */
  public createCheckoutSession: RequestHandler = async (req, res) => {
    const logContext = `${this.logContext} -> createCheckoutSession()`;

    try {
      const { orderId, orderType } = req.body;

      if (!orderId || !orderType) {
        throw new CustomError(400, 'Missing required fields: orderId, orderType');
      }

      const frontendUrl = this.config.frontendUrl;
      let amount: number;
      let currency: string;
      let customerEmail: string;
      let description: string;
      let returnUrl: string;

      if (orderType === StripeSaleType.Trademark) {
        const tmOrder = await this.trademarkOrderDataLayer.getByOrderId(orderId, logContext);

        if (tmOrder.status !== 'pending') {
          throw new CustomError(400, 'Order is not in pending status');
        }

        amount = tmOrder.pricing.total;
        currency = tmOrder.pricing.currency;
        customerEmail = tmOrder.customerData.email;
        description = `Регистрация на търговска марка - ${orderId}`;
        returnUrl = `${frontendUrl}/trademark/success?orderId=${orderId}`;
      } else if (orderType === StripeSaleType.Order) {
        const order = await this.orderDataLayer.getByOrderId(orderId, logContext);

        if (order.status !== 'pending') {
          throw new CustomError(400, 'Order is already paid or processed');
        }

        amount = order.total;
        currency = order.currency;
        customerEmail = order.customerData.email || 'noemail@gotovdoc.bg';
        description = `Order ${orderId}`;
        returnUrl = `${frontendUrl}/checkout/success?orderId=${orderId}`;
      } else {
        throw new CustomError(400, `Unknown orderType: ${orderType}`);
      }

      const clientSecret = await this.stripeService.createCheckoutSession({
        orderId,
        amount,
        currency,
        customerEmail,
        orderType,
        description,
        returnUrl,
      }, logContext);

      res.json({
        success: true,
        clientSecret,
      });
    } catch (error: any) {
      logger.error(error.message, logContext);
      throw error;
    }
  }

  /**
   * POST /api/stripe/webhook
   * Handle Stripe webhook events
   */
  public webhook: RequestHandler = async (req, res) => {
    const rawBody = (req as any).rawBody as string;
    const signature = req.headers['stripe-signature'] as string;

    const logContext = `${this.logContext} -> webhook()`;

    let event: Stripe.Event;

    try {
      event = this.stripeService.constructWebhookEvent(rawBody, signature);
    } catch (err) {
      throw new CustomError(400, 'Unable to verify Stripe webhook', `${logContext} -> constructWebhookEvent()`);
    }

    // Idempotency: skip already-processed events
    const isNewEvent = await this.stripeEventDataLayer.tryInsert(event.id, event.type, logContext);

    if (!isNewEvent) {
      res.status(200).json();
      return;
    }

    switch (event.type) {
      case 'checkout.session.completed':
        await this.handleCompletedCheckout(event, logContext);
        break;
      default:
        logger.info(`Unhandled Stripe event type: ${event.type}`, logContext);
    }

    res.status(200).json();
  }

  /**
   * GET /api/stripe/payment-status/:orderId
   * Check payment status for an order
   */
  public getPaymentStatus: RequestHandler = async (req, res) => {
    const { orderId } = req.params;

    if (!orderId) {
      throw new CustomError(400, 'Invalid order ID');
    }

    // Check if it's a trademark order
    if (orderId.startsWith('TM-')) {
      const tmOrder = await this.trademarkOrderDataLayer.getByOrderId(orderId, this.logContext);

      res.json({
        orderId,
        paid: tmOrder.status === 'paid' || tmOrder.status === 'processing' || tmOrder.status === 'submitted_to_bpo' || tmOrder.status === 'registered',
        amount: tmOrder.paymentData?.paidAmount ?? tmOrder.pricing.total,
        currency: tmOrder.pricing.currency,
        paidAt: tmOrder.paidAt,
      });
      return;
    }

    // Regular order
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

  /**
   * Handle checkout.session.completed event
   */
  private async handleCompletedCheckout(event: Stripe.Event, logContext: string): Promise<void> {
    logContext = `${logContext} -> handleCompletedCheckout()`;

    const session = await this.stripeService.retrieveSession(
      (event.data.object as Stripe.Checkout.Session).id,
      logContext
    );

    if (!session || !session.metadata) {
      throw new CustomError(400, 'Stripe session not found or missing metadata', logContext);
    }

    const { orderId, orderType } = session.metadata;

    if (!orderId) {
      throw new CustomError(400, 'Missing orderId in session metadata', logContext);
    }

    // Extract payment details
    const paymentIntent = session.payment_intent as Stripe.PaymentIntent | null;
    const latestCharge = paymentIntent?.latest_charge as Stripe.Charge | null;
    const amountPaid = session.amount_total ? session.amount_total / 100 : 0; // Convert from cents

    if (orderType === StripeSaleType.Trademark) {
      await this.handleTrademarkPayment(orderId, amountPaid, paymentIntent, latestCharge, logContext);
    } else {
      await this.handleOrderPayment(orderId, amountPaid, paymentIntent, latestCharge, logContext);
    }
  }

  /**
   * Handle payment for a regular order
   */
  private async handleOrderPayment(
    orderId: string,
    amountPaid: number,
    paymentIntent: Stripe.PaymentIntent | null,
    latestCharge: Stripe.Charge | null,
    logContext: string
  ): Promise<void> {
    logContext = `${logContext} -> handleOrderPayment()`;

    const order = await this.orderDataLayer.getByOrderId(orderId, logContext).catch((err) => {
      logger.error(`Error fetching order: ${err.message}`, logContext);
      return null;
    });

    if (!order) {
      logger.error(`Order not found: ${orderId}`, logContext);
      return;
    }

    // Verify amount matches expected
    const isValidAmount = this.priceValidationService.validatePaymentAmount(
      orderId,
      amountPaid,
      order.expectedAmount
    );

    if (!isValidAmount) {
      await this.orderDataLayer.updateByOrderId(orderId, {
        status: 'fraud_attempt',
        paidAmount: amountPaid,
      }, logContext);
      return;
    }

    await this.orderDataLayer.updateByOrderId(orderId, {
      status: 'paid',
      paidAmount: amountPaid,
      paidAt: new Date(),
      paymentData: {
        paymentIntentId: paymentIntent?.id,
        receiptUrl: latestCharge?.receipt_url || undefined,
        transactionRef: paymentIntent?.id,
      },
    }, logContext);

    logger.info(`Order ${orderId} paid successfully via Stripe`, logContext);
  }

  /**
   * Handle payment for a trademark order
   */
  private async handleTrademarkPayment(
    orderId: string,
    amountPaid: number,
    paymentIntent: Stripe.PaymentIntent | null,
    latestCharge: Stripe.Charge | null,
    logContext: string
  ): Promise<void> {
    logContext = `${logContext} -> handleTrademarkPayment()`;

    const tmOrder = await this.trademarkOrderDataLayer.getByOrderId(orderId, logContext).catch((err) => {
      logger.error(`Error fetching trademark order: ${err.message}`, logContext);
      return null;
    });

    if (!tmOrder) {
      logger.error(`Trademark order not found: ${orderId}`, logContext);
      return;
    }

    // Verify amount
    const isValidAmount = this.priceValidationService.validatePaymentAmount(
      orderId,
      amountPaid,
      tmOrder.pricing.total
    );

    if (!isValidAmount) {
      await this.trademarkOrderDataLayer.updateByOrderId(orderId, {
        status: 'cancelled',
      }, logContext);
      logger.error(`Fraud attempt on trademark order ${orderId}. Expected: ${tmOrder.pricing.total}, Received: ${amountPaid}`, logContext);
      return;
    }

    await this.trademarkOrderDataLayer.updateByOrderId(orderId, {
      status: 'paid',
      paidAt: new Date(),
      paymentData: {
        method: 'stripe',
        transactionRef: paymentIntent?.id,
        paidAmount: amountPaid,
        paidAt: new Date(),
        paymentIntentId: paymentIntent?.id,
        receiptUrl: latestCharge?.receipt_url || undefined,
      },
    }, logContext);

    logger.info(`Trademark order ${orderId} paid successfully via Stripe`, logContext);
  }

  private generateOrderId(): string {
    const timestamp = Date.now().toString(36).toUpperCase();
    const random = crypto.randomBytes(4).toString('hex').toUpperCase();
    return `ORD-${timestamp}-${random}`;
  }
}
