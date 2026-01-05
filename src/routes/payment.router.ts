import { Router } from 'express';

import CatchUtil from '../utils/catch.util';
import PaymentController from '../controllers/payment.controller';
import { validateMyPosWebhook } from '../middlewares/mypos-webhook.middleware';

const useCatch = CatchUtil.getUseCatch();
const paymentController = new PaymentController();

const paymentRouter = Router();

// === CHECKOUT API (IPC v1.4) ===

// Get available documents and packages with prices
paymentRouter.get('/prices', useCatch(paymentController.getPrices));

// Create order and get signed payment parameters
paymentRouter.post('/create-order', useCatch(paymentController.createOrder));

// Handle myPOS IPC notification (IPCPurchaseNotify)
// Apply security middleware before processing webhook
paymentRouter.post('/notify', validateMyPosWebhook, useCatch(paymentController.handleIPCNotification));


export default paymentRouter;


