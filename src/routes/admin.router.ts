import fs from 'fs';
import path from 'path';

import multer from 'multer';
import { Router } from 'express';

import AdminController from './../controllers/admin.controller';
import AuthMiddleware from './../middlewares/auth.middleware';

const adminController = AdminController.getInstance();
const authMiddleware = AuthMiddleware.getInstance();

const AdminRouter = Router();
// Configure multer for file uploads
const uploadDir = path.join(__dirname, '../../uploads/orders');

// Ensure upload directory exists
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
  limits: {
    fileSize: 10 * 1024 * 1024, // 10MB max file size
  },
  fileFilter: (req, file, cb) => {
    // Allow common document formats
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
  }
});

// All admin routes require authentication and admin role
AdminRouter.use(authMiddleware.isAuthenticated);
AdminRouter.use(authMiddleware.isAdmin);

// Admin routes
AdminRouter.get('/stats', adminController.getStats);
AdminRouter.get('/orders', adminController.getAllOrders);
AdminRouter.get('/orders/:id', adminController.getOrderById);
AdminRouter.get('/orders/:id/uploads/:fileId', adminController.downloadOrderUpload);
AdminRouter.patch('/orders/:id', adminController.updateOrder);
AdminRouter.post('/orders/:id/upload', upload.array('files', 5), adminController.uploadOrderFiles);

export default AdminRouter;
