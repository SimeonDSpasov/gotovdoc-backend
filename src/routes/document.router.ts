import { Router } from 'express';

import AuthMiddleware from './../middlewares/auth.middleware';
import CatchUtil from './../utils/catch.util';

import DocumentController from './../controllers/document.controller';

const useCatch = CatchUtil.getUseCatch();
const authMiddleware = AuthMiddleware.getInstance();
const documentController = new DocumentController();

const DocumentRouter = Router();

DocumentRouter.post(
  '/generate',
  useCatch(authMiddleware.attachUserIfPresent),
  useCatch(documentController.generateDocument)
);

DocumentRouter.get(
  '/download/:downloadToken',
  useCatch(authMiddleware.attachUserIfPresent),
  useCatch(documentController.downloadDocument)
);

DocumentRouter.get(
  '/sample/:type',
  useCatch(documentController.getSampleImage)
);

export default DocumentRouter;
