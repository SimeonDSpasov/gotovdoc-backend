import { Router } from 'express';

import CatchUtil from '../utils/catch.util';
import AuthController from '../controllers/auth.controller';
import AuthMiddleware from '../middlewares/auth.middleware';

const useCatch = CatchUtil.getUseCatch();
const authController = new AuthController();
const authMiddleware = AuthMiddleware.getInstance();

const authRouter = Router();

// Public routes
authRouter.post('/register', useCatch(authController.register));
authRouter.post('/login', useCatch(authController.login));
authRouter.post('/refresh', useCatch(authController.refreshAccessToken));
authRouter.post('/forgotten-password', useCatch(authController.forgottenPassword));
authRouter.post('/reset-password', useCatch(authController.resetPassword));

// Protected routes (require authentication)
authRouter.post('/change-password', useCatch(authMiddleware.isAuthenticated), useCatch(authController.changePassword));

export default authRouter;

