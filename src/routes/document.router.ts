import { Router } from 'express';

import CatchUtil from './../utils/catch.util';

import DocumentController from './../controllers/document.controller';

const useCatch = CatchUtil.getUseCatch();
const documentController = new DocumentController();

const DocumentRouter = Router();

DocumentRouter.post('/speciment', useCatch(documentController.generateSpeciment));

DocumentRouter.get('/download/:orderId', useCatch(documentController.downloadDocument));

export default DocumentRouter;
