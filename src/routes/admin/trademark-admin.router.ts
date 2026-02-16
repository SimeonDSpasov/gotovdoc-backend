import fs from 'fs';
import path from 'path';

import multer from 'multer';
import { Router } from 'express';

import CatchUtil from './../../utils/catch.util';

import TrademarkAdminController from './../../controllers/admin/trademark-admin.controller';

const useCatch = CatchUtil.getUseCatch();
const trademarkAdminController = TrademarkAdminController.getInstance();

const TrademarkAdminRouter = Router();

// Configure multer for file uploads
const uploadDir = path.join(__dirname, '../../../uploads/trademark-orders');
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
  limits: {
    fileSize: 10 * 1024 * 1024, // 10MB
  },
  fileFilter: (req, file, cb) => {
    const allowedMimes = [
      'application/pdf',
      'application/msword',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'image/jpeg',
      'image/png',
      'image/jpg',
    ];

    if (allowedMimes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error('Invalid file type. Only PDF, DOC, DOCX, and images are allowed.'));
    }
  },
});

// NOTE: Auth middleware (isAuthenticated + isAdmin) is applied at the parent AdminRouter level

// List all trademark orders
TrademarkAdminRouter.get(
  '/orders',
  useCatch(trademarkAdminController.getAllOrders)
);

// Get single trademark order
TrademarkAdminRouter.get(
  '/orders/:id',
  useCatch(trademarkAdminController.getOrderById)
);

// Update trademark order status
TrademarkAdminRouter.patch(
  '/orders/:id/status',
  useCatch(trademarkAdminController.updateOrderStatus)
);

// Add admin note to order
TrademarkAdminRouter.post(
  '/orders/:id/note',
  useCatch(trademarkAdminController.addAdminNote)
);

// Upload finished document (registration certificate, etc.)
TrademarkAdminRouter.post(
  '/orders/:id/upload',
  upload.array('files', 5),
  useCatch(trademarkAdminController.uploadFinishedDocument)
);

export default TrademarkAdminRouter;
