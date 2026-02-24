import { ObjectId } from 'mongodb';
import { Request, RequestHandler } from 'express';
import { Readable } from 'stream';

import CustomError from './../../utils/custom-error.utils';
import FileStorageUtil from './../../utils/file-storage.util';
import { EmailUtil, EmailType } from './../../utils/email.util';

import TrademarkOrderDataLayer from './../../data-layers/trademark-order.data-layer';
import { ITrademarkOrder } from './../../models/trademark-order.model';
import mongoose from 'mongoose';

export default class TrademarkAdminController {

 private logContext = 'Trademark Admin Controller';

 private trademarkOrderDataLayer = TrademarkOrderDataLayer.getInstance();
 private fileStorageUtil = FileStorageUtil.getInstance();
 private emailUtil = EmailUtil.getInstance();

 /**
 * GET /api/admin/trademark/orders
 * List all trademark orders with optional status filtering
 */
 public getAllOrders: RequestHandler = async (req, res, next) => {
  const logContext = `${this.logContext} -> getAllOrders()`;

  const { status, page, limit } = req.query;

  const filter: any = {};
  if (status) {
   filter.status = status;
  }

  const orders = await this.trademarkOrderDataLayer.getAll(filter, logContext);

  const pageNum = Math.max(1, Number(page) || 1);
  const limitNum = Math.min(100, Math.max(1, Number(limit) || 50));
  const startIndex = (pageNum - 1) * limitNum;
  const paginatedOrders = orders.slice(startIndex, startIndex + limitNum);

  res.status(200).json({
   success: true,
   data: paginatedOrders,
   pagination: {
    total: orders.length,
    page: pageNum,
    limit: limitNum,
    totalPages: Math.ceil(orders.length / limitNum),
   },
  });
 };

 /**
 * GET /api/admin/trademark/orders/:id
 * Get single trademark order details
 */
 public getOrderById: RequestHandler = async (req, res, next) => {
  const logContext = `${this.logContext} -> getOrderById()`;

  const { id } = req.params;

  const order = await this.trademarkOrderDataLayer.getById(id, logContext);

  res.status(200).json({
   success: true,
   data: order,
  });
 };

 /**
 * PATCH /api/admin/trademark/orders/:id/status
 * Change order status (e.g. paid -> processing -> submitted_to_bpo -> registered)
 */
 public updateOrderStatus: RequestHandler = async (req, res, next) => {
  const logContext = `${this.logContext} -> updateOrderStatus()`;

  const { id } = req.params;
  const { status } = req.body;

  const validStatuses: ITrademarkOrder['status'][] = [
   'pending', 'paid', 'processing', 'submitted_to_bpo', 'published', 'registered', 'rejected', 'cancelled',
  ];

  if (!status || !validStatuses.includes(status)) {
   throw new CustomError(400, `Invalid status. Must be one of: ${validStatuses.join(', ')}`);
  }

  const existingOrder = await this.trademarkOrderDataLayer.getById(id, logContext);
  const updatedOrder = await this.trademarkOrderDataLayer.updateStatus(
   existingOrder.orderId,
   status,
   logContext
  );

  if (status === 'registered' && Array.isArray(existingOrder.finishedFiles) && existingOrder.finishedFiles.length > 0) {
   const customerEmail = existingOrder.customerData?.email;
   if (customerEmail) {
    const attachments: Array<{ filename: string; content: Buffer; contentType: string }> = [];

    for (const file of existingOrder.finishedFiles) {
     const buffer = await this.fileStorageUtil
      .downloadFile(file.fileId.toString())
      .then(stream => this.streamToBuffer(stream))
      .catch((err: Error) => {
       console.error(`Failed to read finished file ${file.fileId} from GridFS: ${(err as Error).message}`);
       return null;
      });
     if (buffer) {
      attachments.push({
       filename: file.filename,
       content: buffer,
       contentType: file.mimetype || 'application/octet-stream',
      });
     }
    }

    const customerName = [existingOrder.customerData?.firstName, existingOrder.customerData?.lastName]
     .filter(Boolean).join(' ') || 'клиент';

    this.emailUtil.sendEmail({
     toEmail: customerEmail,
     subject: `Поръчка ${existingOrder.orderId} — Документи по търговска марка`,
     template: 'trademark-order-finished',
     payload: {
      customerName,
      orderId: existingOrder.orderId,
      markText: existingOrder.trademarkData?.markText || '',
      markType: existingOrder.trademarkData?.markType || '',
      hasAttachments: attachments.length > 0,
     },
     attachments,
    }, EmailType.Info, logContext)
     .catch((err: any) => console.error(`Failed to send trademark order finished email: ${err.message}`));
   }
  }

  res.status(200).json({
   success: true,
   data: updatedOrder,
  });
 };

 /**
 * POST /api/admin/trademark/orders/:id/note
 * Add or update admin notes on the order
 */
 public addAdminNote: RequestHandler = async (req, res, next) => {
  const logContext = `${this.logContext} -> addAdminNote()`;

  const { id } = req.params;
  const { note } = req.body;

  if (!note || typeof note !== 'string') {
   throw new CustomError(400, 'Note is required and must be a string');
  }

  const timestamp = new Date().toLocaleString('bg-BG');
  const adminName = req.user?.firstName
   ? `${req.user.firstName} ${req.user.lastName || ''}`
   : 'Admin';

  const existingOrder = await this.trademarkOrderDataLayer.getById(id, logContext);
  const existingNotes = existingOrder.adminNotes || '';
  const newNote = `[${timestamp} - ${adminName}] ${note}`;
  const updatedNotes = existingNotes ? `${existingNotes}\n${newNote}` : newNote;

  const updatedOrder = await this.trademarkOrderDataLayer.update(
   id,
   { adminNotes: updatedNotes },
   logContext
  );

  res.status(200).json({
   success: true,
   data: updatedOrder,
  });
 };

 /**
 * POST /api/admin/trademark/orders/:id/upload
 * Upload finished registration certificate or other documents (stored in GridFS)
 */
 public uploadFinishedDocument: RequestHandler = async (req, res, next) => {
  const logContext = `${this.logContext} -> uploadFinishedDocument()`;

  const { id } = req.params;

  await this.trademarkOrderDataLayer.getById(id, logContext);

  const files = req.files as Express.Multer.File[];

  if (!files || files.length === 0) {
   throw new CustomError(400, 'No files uploaded');
  }

  const uploadedFiles = [];
  for (const file of files) {
   const stream = Readable.from(file.buffer);
   const fileId = await this.fileStorageUtil.uploadFile(stream, file.originalname, file.mimetype);
   uploadedFiles.push({
    fileId,
    filename: file.originalname,
    mimetype: file.mimetype,
    size: file.size,
   });
  }

  await this.trademarkOrderDataLayer.update(
   id,
   {
    $push: {
     finishedFiles: {
      $each: uploadedFiles,
     },
    },
   },
   logContext
  );

  res.status(200).json({
   success: true,
   data: {
    files: uploadedFiles,
    message: 'Files uploaded successfully',
   },
  });
 };

 /**
 * GET /api/admin/trademark/orders/:id/finished-files/:fileId
 * Download an admin-uploaded finished file (stored in GridFS)
 */
 public downloadFinishedFile: RequestHandler = async (req, res, next) => {
  const logContext = `${this.logContext} -> downloadFinishedFile()`;

  const { id, fileId } = req.params;

  if (!fileId) {
   throw new CustomError(400, 'Missing fileId');
  }

  const order = await this.trademarkOrderDataLayer.getById(id, logContext);
  const file = order.finishedFiles?.find((f: any) => f.fileId?.toString() === fileId);

  if (!file) {
   throw new CustomError(404, 'Finished file not found on order');
  }

  const fileStream = await this.fileStorageUtil.downloadFile(fileId);

  res.setHeader('Content-Type', file.mimetype || 'application/octet-stream');
  res.setHeader('Content-Disposition', `attachment; filename="${file.filename}"`);

  fileStream.pipe(res);
 };

 /**
 * DELETE /api/admin/trademark/orders/:id/finished-files/:fileId
 * Delete an admin-uploaded finished file from GridFS and the order
 */
 public deleteFinishedFile: RequestHandler = async (req, res, next) => {
  const logContext = `${this.logContext} -> deleteFinishedFile()`;

  const { id, fileId } = req.params;

  if (!fileId) {
   throw new CustomError(400, 'Missing fileId');
  }

  const order = await this.trademarkOrderDataLayer.getById(id, logContext);
  const file = order.finishedFiles?.find((f: any) => f.fileId?.toString() === fileId);

  if (!file) {
   throw new CustomError(404, 'Finished file not found on order');
  }

  await this.fileStorageUtil.deleteFile(new mongoose.Types.ObjectId(fileId));

  const updatedOrder = await this.trademarkOrderDataLayer.update(id, {
   $pull: { finishedFiles: { fileId: new ObjectId(fileId) } }
  }, logContext);

  res.status(200).json({
   success: true,
   data: updatedOrder,
  });
 };

 private streamToBuffer(stream: Readable): Promise<Buffer> {
  return new Promise((resolve, reject) => {
   const chunks: Buffer[] = [];
   stream.on('data', (chunk) => chunks.push(chunk));
   stream.on('end', () => resolve(Buffer.concat(chunks)));
   stream.on('error', reject);
  });
 }

 private static instance: TrademarkAdminController;

 public static getInstance(): TrademarkAdminController {
  if (!TrademarkAdminController.instance) {
   TrademarkAdminController.instance = new TrademarkAdminController();
  }

  return TrademarkAdminController.instance;
 }

}
