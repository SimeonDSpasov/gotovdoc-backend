import { Router } from 'express';

import AuthMiddleware from './../middlewares/auth.middleware';
import CatchUtil from './../utils/catch.util';

import StripeController from './../controllers/stripe.controller';

const useCatch = CatchUtil.getUseCatch();
const authMiddleware = AuthMiddleware.getInstance();
const stripeController = new StripeController();

const StripeRouter = Router();

// Get available documents and packages with prices
StripeRouter.get('/prices', useCatch(stripeController.getPrices));

// Create order and get Stripe checkout client secret
StripeRouter.post(
  '/create-order',
  useCatch(authMiddleware.attachUserIfPresent),
  useCatch(stripeController.createOrder)
);

// Create checkout session for an existing order (trademark, retry, etc.)
StripeRouter.post(
  '/create-session/checkout',
  useCatch(authMiddleware.attachUserIfPresent),
  useCatch(stripeController.createCheckoutSession)
);

// Stripe webhook (no auth -- signature verified in controller)
StripeRouter.post('/webhook', useCatch(stripeController.webhook));

// Check payment status
StripeRouter.get('/payment-status/:orderId', useCatch(stripeController.getPaymentStatus));

export default StripeRouter;
