import { Router } from 'express';

import AuthMiddleware from './../middlewares/auth.middleware';

import CatchUtil from './../utils/catch.util';

import AuthController from './../controllers/auth.controller';

const authMiddleware = AuthMiddleware.getInstance();

const useCatch = CatchUtil.getUseCatch();
const authController = new AuthController();

const AuthRouter = Router();

// Public routes
AuthRouter.post('/register', useCatch(authController.register));
AuthRouter.post('/login', useCatch(authController.login));
AuthRouter.post('/refresh', useCatch(authController.refreshAccessToken));
AuthRouter.post('/forgotten-password', useCatch(authController.forgottenPassword));
AuthRouter.post('/reset-password', useCatch(authController.resetPassword));

// Protected routes (require authentication)
AuthRouter.post('/change-password', useCatch(authMiddleware.isAuthenticated), useCatch(authController.changePassword));

export default AuthRouter;
