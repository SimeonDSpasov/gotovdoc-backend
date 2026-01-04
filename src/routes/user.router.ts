import { Router } from 'express';

import CatchUtil from '../utils/catch.util';
import UserController from '../controllers/user.controller';
import AuthMiddleware from '../middlewares/auth.middleware';

const useCatch = CatchUtil.getUseCatch();
const userController = new UserController();
const authMiddleware = AuthMiddleware.getInstance();

const userRouter = Router();

// Get current user (equivalent to /me)
userRouter.get('/get', useCatch(authMiddleware.isAuthenticated), useCatch(userController.getUser));

export default userRouter;

