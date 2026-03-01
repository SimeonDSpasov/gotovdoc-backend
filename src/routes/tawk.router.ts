import { Router } from 'express';

import AuthMiddleware from './../middlewares/auth.middleware';
import CatchUtil from './../utils/catch.util';

import TawkController from './../controllers/tawk.controller';

const useCatch = CatchUtil.getUseCatch();
const authMiddleware = AuthMiddleware.getInstance();
const tawkController = new TawkController();

const TawkRouter = Router();

// Get visitor hash for secure mode (authenticated users only)
TawkRouter.get(
 '/visitor-hash',
 useCatch(authMiddleware.isAuthenticated),
 useCatch(tawkController.getVisitorHash)
);

// Tawk.to webhook (no auth — signature verified in controller)
TawkRouter.post('/webhook', useCatch(tawkController.webhook));

export default TawkRouter;
