import fs from 'fs';
import path from 'path';

import multer from 'multer';
import { Router } from 'express';

import AuthMiddleware from './../middlewares/auth.middleware';
import CatchUtil from './../utils/catch.util';

import CapitalRevaluationController from './../controllers/capital-revaluation.controller';

const useCatch = CatchUtil.getUseCatch();
const authMiddleware = AuthMiddleware.getInstance();
const capitalRevaluationController = new CapitalRevaluationController();

const CapitalRevaluationRouter = Router();

// Configure multer for temp storage
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
  }
});

const upload = multer({
  storage: storage,
  limits: { fileSize: 10 * 1024 * 1024 } // 10MB
});

// Generate power of attorney (free preview or paid generation)
CapitalRevaluationRouter.post(
  '/power-of-attorney',
  useCatch(authMiddleware.attachUserIfPresent),
  useCatch(capitalRevaluationController.generatePowerOfAttorney)
);

// Create order with file upload
CapitalRevaluationRouter.post(
  '/order',
  useCatch(authMiddleware.attachUserIfPresent),
  upload.array('files', 5),
  useCatch(capitalRevaluationController.createOrder)
);

// Download all uploaded files for an order (zip, ordered)
CapitalRevaluationRouter.get(
  '/order/:orderId/uploads',
  useCatch(capitalRevaluationController.downloadOrderFile)
);

// Download a single uploaded file for an order
CapitalRevaluationRouter.get(
  '/order/:orderId/uploads/:fileId',
  useCatch(capitalRevaluationController.downloadOrderSingleFile)
);

// Download previously paid power of attorney
CapitalRevaluationRouter.get(
  '/download/:orderId',
  useCatch(authMiddleware.attachUserIfPresent),
  useCatch(capitalRevaluationController.downloadPowerOfAttorney)
);

export default CapitalRevaluationRouter;
