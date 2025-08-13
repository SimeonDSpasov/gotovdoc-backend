import { Router } from 'express';

import emailRouter from './email.router';


const MainRouter = Router();

MainRouter.use('/api/email', emailRouter);

export default MainRouter;
