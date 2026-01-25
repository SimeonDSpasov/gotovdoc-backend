import { Router } from 'express';

import AuthMiddleware from './../middlewares/auth.middleware';
import CatchUtil from './../utils/catch.util';

import DocumentController from './../controllers/document.controller';

const useCatch = CatchUtil.getUseCatch();
const authMiddleware = AuthMiddleware.getInstance();
const documentController = new DocumentController();

const DocumentRouter = Router();

DocumentRouter.post(
  '/speciment',
  useCatch(authMiddleware.attachUserIfPresent),
  useCatch(documentController.generateSpeciment)
);

DocumentRouter.post(
  '/mps-power-of-attorney',
  useCatch(authMiddleware.attachUserIfPresent),
  useCatch(documentController.generateMpsPowerOfAttorney)
);

DocumentRouter.post(
  '/leave-request',
  useCatch(authMiddleware.attachUserIfPresent),
  useCatch(documentController.generateLeaveRequest)
);

DocumentRouter.get(
  '/download/:orderId',
  useCatch(authMiddleware.attachUserIfPresent),
  useCatch(documentController.downloadDocument)
);

export default DocumentRouter;
