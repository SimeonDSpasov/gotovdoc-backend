import { Router } from 'express';

import CatchUtil from './../utils/catch.util';
import NkpdController from './../controllers/nkpd.controller';

const useCatch = CatchUtil.getUseCatch();
const nkpdController = new NkpdController();

const NkpdRouter = Router();

NkpdRouter.get(
  '/search',
  useCatch(nkpdController.search)
);

export default NkpdRouter;
