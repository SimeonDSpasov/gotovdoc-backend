import { Router } from 'express';

import AdminRouter from './admin.router';
import AuthRouter from './auth.router';
import CapitalRevaluationRouter from './capital-revaluation.router';
import CheckoutRouter from './checkout.router';
import DocumentRouter from './document.router';
import EmailRouter from './email.router';
import PaymentRouter from './payment.router';
import UserRouter from './user.router';


const MainRouter = Router();

MainRouter.use('/api/auth', AuthRouter);

MainRouter.use('/api/user', UserRouter);

MainRouter.use('/api/email', EmailRouter);

MainRouter.use('/api/doc', DocumentRouter);

MainRouter.use('/api/payment', PaymentRouter);

MainRouter.use('/api/checkout', CheckoutRouter);

MainRouter.use('/api/capital-revaluation', CapitalRevaluationRouter);

MainRouter.use('/api/admin', AdminRouter);

export default MainRouter;
