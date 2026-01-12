import { Router } from 'express';

import AuthMiddleware from './../middlewares/auth.middleware';

import CatchUtil from './../utils/catch.util';

import UserController from './../controllers/user.controller';

const authMiddleware = AuthMiddleware.getInstance();

const useCatch = CatchUtil.getUseCatch();
const userController = new UserController();

const UserRouter = Router();

// Get current user (equivalent to /me)
UserRouter.get('/get', useCatch(authMiddleware.isAuthenticated), useCatch(userController.getUser));

export default UserRouter;
