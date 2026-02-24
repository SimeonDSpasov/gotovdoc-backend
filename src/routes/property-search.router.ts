import fs from 'fs';
import path from 'path';

import multer from 'multer';
import { Router } from 'express';

import AuthMiddleware from './../middlewares/auth.middleware';
import CatchUtil from './../utils/catch.util';

import PropertySearchController from './../controllers/property-search.controller';

const useCatch = CatchUtil.getUseCatch();
const authMiddleware = AuthMiddleware.getInstance();
const propertySearchController = new PropertySearchController();

const PropertySearchRouter = Router();

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

// Create order with optional file upload (sketch/document)
PropertySearchRouter.post(
 '/order',
 useCatch(authMiddleware.attachUserIfPresent),
 upload.array('files', 5),
 useCatch(propertySearchController.createOrder)
);

export default PropertySearchRouter;
