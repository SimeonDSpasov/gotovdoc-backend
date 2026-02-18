import fs from 'fs';
import path from 'path';

import multer from 'multer';
import { Router } from 'express';

import AuthMiddleware from './../middlewares/auth.middleware';
import CatchUtil from './../utils/catch.util';

import TrademarkController from './../controllers/trademark.controller';
import EuipoController from './../controllers/euipo.controller';

const useCatch = CatchUtil.getUseCatch();
const authMiddleware = AuthMiddleware.getInstance();
const trademarkController = new TrademarkController();
const euipoController = new EuipoController();

const TrademarkRouter = Router();

// Configure multer for temp storage (logo/image uploads)
const uploadDir = path.join(__dirname, '../../uploads/temp');
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, uploadDir);
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, file.fieldname + '-' + uniqueSuffix + path.extname(file.originalname));
  },
});

const upload = multer({
  storage,
  limits: { fileSize: 10 * 1024 * 1024 }, // 10MB
});

// Create trademark order (guest + auth)
TrademarkRouter.post(
  '/create-order',
  useCatch(authMiddleware.attachUserIfPresent),
  upload.array('files', 5),
  useCatch(trademarkController.createOrder)
);

// Get user's trademark orders (authenticated)
TrademarkRouter.get(
  '/orders',
  useCatch(authMiddleware.isAuthenticated),
  useCatch(trademarkController.getUserOrders)
);

// Get specific trademark order (authenticated)
TrademarkRouter.get(
  '/orders/:orderId',
  useCatch(authMiddleware.isAuthenticated),
  useCatch(trademarkController.getOrder)
);

// Download power of attorney (guest with email or auth)
TrademarkRouter.get(
  '/power-of-attorney/:orderId',
  useCatch(authMiddleware.attachUserIfPresent),
  useCatch(trademarkController.downloadPowerOfAttorney)
);

// EUIPO Goods & Services endpoints (public, no auth — served from DB)
TrademarkRouter.get('/class-headings', useCatch(euipoController.getClassHeadings));
TrademarkRouter.get('/search-terms', useCatch(euipoController.searchTerms));
TrademarkRouter.get('/cache-stats', useCatch(euipoController.getCacheStats));

export default TrademarkRouter;
