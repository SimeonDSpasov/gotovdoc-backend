import { Router } from 'express';

import CatchUtil from '../utils/catch.util';
import CheckoutController from '../controllers/checkout.controller';

const useCatch = CatchUtil.getUseCatch();
const checkoutController = new CheckoutController();

const checkoutRouter = Router();

// Create checkout session (returns form HTML)
checkoutRouter.post('/create', useCatch(checkoutController.createCheckout));

// Webhook endpoint for myPOS notifications
checkoutRouter.post('/webhook/notify', useCatch(checkoutController.handleWebhookNotify));

// Get transaction status
checkoutRouter.get('/status/:orderId', useCatch(checkoutController.getTransactionStatus));

// Create refund
checkoutRouter.post('/refund', useCatch(checkoutController.createRefund));

// TEST ENDPOINT: Create a test payment (should be removed/protected in production)
checkoutRouter.get('/test-payment', useCatch(checkoutController.createTestPayment));

export default checkoutRouter;

