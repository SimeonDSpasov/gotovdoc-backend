import { Router } from 'express';

import { validateMyPosWebhook } from './../middlewares/mypos-webhook.middleware';

import CatchUtil from './../utils/catch.util';

import PaymentController from './../controllers/payment.controller';

const useCatch = CatchUtil.getUseCatch();
const paymentController = new PaymentController();

const PaymentRouter = Router();

// === CHECKOUT API (IPC v1.4) ===

// Get available documents and packages with prices
PaymentRouter.get('/prices', useCatch(paymentController.getPrices));

// Create order and get signed payment parameters
PaymentRouter.post('/create-order', useCatch(paymentController.createOrder));

// Get signed payment parameters for existing order
PaymentRouter.get('/params/:orderId', useCatch(paymentController.getPaymentParams));

// Handle myPOS IPC notification (IPCPurchaseNotify)
// Apply security middleware before processing webhook
PaymentRouter.post('/notify', validateMyPosWebhook, useCatch(paymentController.handleIPCNotification));

export default PaymentRouter;

