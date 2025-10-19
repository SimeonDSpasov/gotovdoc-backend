import { Router } from 'express';

import emailRouter from './email.router';
import documentRouter from './document.router';


const MainRouter = Router();

MainRouter.use('/api/email', emailRouter);

MainRouter.use('/api/doc', documentRouter);

export default MainRouter;
