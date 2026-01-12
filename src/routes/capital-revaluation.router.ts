import fs from 'fs';
import path from 'path';

import multer from 'multer';
import { Router } from 'express';

import CatchUtil from './../utils/catch.util';

import CapitalRevaluationController from './../controllers/capital-revaluation.controller';

const useCatch = CatchUtil.getUseCatch();
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
  useCatch(capitalRevaluationController.generatePowerOfAttorney)
);

// Create order with file upload
CapitalRevaluationRouter.post(
  '/order',
  upload.array('files', 5),
  useCatch(capitalRevaluationController.createOrder)
);

// Download previously paid power of attorney
CapitalRevaluationRouter.get(
  '/download/:orderId',
  useCatch(capitalRevaluationController.downloadPowerOfAttorney)
);

export default CapitalRevaluationRouter;
