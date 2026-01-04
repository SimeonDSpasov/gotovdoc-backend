import { Router } from 'express';

import CatchUtil from '../utils/catch.util';
import PaymentController from '../controllers/payment.controller';

const useCatch = CatchUtil.getUseCatch();
const paymentController = new PaymentController();

const paymentRouter = Router();

// Webhook endpoint for myPOS payment notifications
paymentRouter.post('/webhook/mypos', useCatch(paymentController.handleWebhook));

// Get payment status for an order
paymentRouter.get('/status/:orderId', useCatch(paymentController.getPaymentStatus));

// Create payment link
paymentRouter.post('/link', useCatch(paymentController.createPaymentLink));

export default paymentRouter;


