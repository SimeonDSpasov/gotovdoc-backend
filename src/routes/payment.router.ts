import { Router } from 'express';

import CatchUtil from '../utils/catch.util';
import PaymentController from '../controllers/payment.controller';

const useCatch = CatchUtil.getUseCatch();
const paymentController = new PaymentController();

const paymentRouter = Router();

// === CHECKOUT API (IPC v1.4) ===
// Create order and get signed payment parameters
paymentRouter.post('/create-order', useCatch(paymentController.createOrder));

// Handle myPOS IPC notification (IPCPurchaseNotify)
paymentRouter.post('/notify', useCatch(paymentController.handleIPCNotification));


export default paymentRouter;


