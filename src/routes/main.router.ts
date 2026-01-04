import { Router } from 'express';

import authRouter from './auth.router';
import userRouter from './user.router';
import emailRouter from './email.router';
import documentRouter from './document.router';
import paymentRouter from './payment.router';


const MainRouter = Router();

MainRouter.use('/api/auth', authRouter);

MainRouter.use('/api/user', userRouter);

MainRouter.use('/api/email', emailRouter);

MainRouter.use('/api/doc', documentRouter);

MainRouter.use('/api/payment', paymentRouter);

export default MainRouter;
