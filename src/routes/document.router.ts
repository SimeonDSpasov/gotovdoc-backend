import { Router } from 'express';

import CatchUtil from '../utils/catch.util';

import DocumentController from './../controllers/document.controller';

const useCatch = CatchUtil.getUseCatch();
const documentController = new DocumentController();

const documentRouter = Router();

documentRouter.post('/speciment', useCatch(documentController.generateSpeciment));

export default documentRouter;

