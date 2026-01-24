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

DocumentRouter.get(
  '/download/:orderId',
  useCatch(authMiddleware.attachUserIfPresent),
  useCatch(documentController.downloadDocument)
);

export default DocumentRouter;
