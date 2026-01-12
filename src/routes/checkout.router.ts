import { Router } from 'express';

import CatchUtil from './../utils/catch.util';

import CheckoutController from './../controllers/checkout.controller';

const useCatch = CatchUtil.getUseCatch();
const checkoutController = new CheckoutController();

const CheckoutRouter = Router();

// Create checkout session (returns form HTML)
CheckoutRouter.post('/create', useCatch(checkoutController.createCheckout));

// Webhook endpoint for myPOS notifications
CheckoutRouter.post('/webhook/notify', useCatch(checkoutController.handleWebhookNotify));

// Get transaction status
CheckoutRouter.get('/status/:orderId', useCatch(checkoutController.getTransactionStatus));

// Create refund
CheckoutRouter.post('/refund', useCatch(checkoutController.createRefund));

// TEST ENDPOINT: Create a test payment (should be removed/protected in production)
CheckoutRouter.get('/test-payment', useCatch(checkoutController.createTestPayment));

export default CheckoutRouter;
