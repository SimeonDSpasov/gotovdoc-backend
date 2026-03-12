import { Router } from 'express';

import AuthMiddleware from './../middlewares/auth.middleware';
import CatchUtil from './../utils/catch.util';

import SubscriptionController from './../controllers/subscription.controller';

const useCatch = CatchUtil.getUseCatch();
const authMiddleware = AuthMiddleware.getInstance();
const subscriptionController = new SubscriptionController();

const SubscriptionRouter = Router();

// Get available subscription plans (auth required to filter by role)
SubscriptionRouter.get('/plans', useCatch(authMiddleware.isAuthenticated), useCatch(subscriptionController.getPlans));

// Create subscription checkout session
SubscriptionRouter.post(
 '/create-session/checkout',
 useCatch(authMiddleware.isAuthenticated),
 useCatch(subscriptionController.createCheckoutSession)
);

// Cancel subscription at period end
SubscriptionRouter.post(
 '/cancel',
 useCatch(authMiddleware.isAuthenticated),
 useCatch(subscriptionController.cancel)
);

// Resume cancelled subscription
SubscriptionRouter.post(
 '/resume',
 useCatch(authMiddleware.isAuthenticated),
 useCatch(subscriptionController.resume)
);

// Get subscription status
SubscriptionRouter.get(
 '/status',
 useCatch(authMiddleware.isAuthenticated),
 useCatch(subscriptionController.getStatus)
);

export default SubscriptionRouter;
