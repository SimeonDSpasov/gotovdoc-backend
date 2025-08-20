import { Router } from 'express';

import CatchUtil from '../utils/catch.util';

import EmailController from './..//controllers/email.controller';

const useCatch = CatchUtil.getUseCatch();
const emailController = new EmailController();

const EmailRouter = Router();

EmailRouter.post('/contact-us', useCatch(emailController.contactUs));

export default EmailRouter;
