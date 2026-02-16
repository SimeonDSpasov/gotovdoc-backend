import { Router } from 'express';

import AdminRouter from './admin.router';
import AuthRouter from './auth.router';
import CapitalRevaluationRouter from './capital-revaluation.router';
import DocumentRouter from './document.router';
import EmailRouter from './email.router';
import StripeRouter from './stripe.router';
import TrademarkRouter from './trademark.router';
import UserRouter from './user.router';


const MainRouter = Router();

MainRouter.use('/api/auth', AuthRouter);

MainRouter.use('/api/user', UserRouter);

MainRouter.use('/api/email', EmailRouter);

MainRouter.use('/api/doc', DocumentRouter);

MainRouter.use('/api/stripe', StripeRouter);

MainRouter.use('/api/capital-revaluation', CapitalRevaluationRouter);

MainRouter.use('/api/trademark', TrademarkRouter);

MainRouter.use('/api/admin', AdminRouter);

export default MainRouter;
