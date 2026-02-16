import fs from 'fs';
import { Request, RequestHandler } from 'express';

import CustomError from './../../utils/custom-error.utils';
import FileStorageUtil from './../../utils/file-storage.util';

import TrademarkOrderDataLayer from './../../data-layers/trademark-order.data-layer';
import { ITrademarkOrder } from './../../models/trademark-order.model';

export default class TrademarkAdminController {

  private logContext = 'Trademark Admin Controller';

  private trademarkOrderDataLayer = TrademarkOrderDataLayer.getInstance();
  private fileStorageUtil = FileStorageUtil.getInstance();

  /**
   * GET /api/admin/trademark/orders
   * List all trademark orders with optional status filtering
   */
  public getAllOrders: RequestHandler = async (req, res, next) => {
    const logContext = `${this.logContext} -> getAllOrders()`;

    try {
      const { status, page, limit } = req.query;

      const filter: any = {};
      if (status) {
        filter.status = status;
      }

      const orders = await this.trademarkOrderDataLayer.getAll(filter, logContext);

      // Simple pagination
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
    } catch (err) {
      next(err);
    }
  };

  /**
   * GET /api/admin/trademark/orders/:id
   * Get single trademark order details
   */
  public getOrderById: RequestHandler = async (req, res, next) => {
    const logContext = `${this.logContext} -> getOrderById()`;

    try {
      const { id } = req.params;

      const order = await this.trademarkOrderDataLayer.getById(id, logContext);

      res.status(200).json({
        success: true,
        data: order,
      });
    } catch (err) {
      next(err);
    }
  };

  /**
   * PATCH /api/admin/trademark/orders/:id/status
   * Change order status (e.g. paid -> processing -> submitted_to_bpo -> registered)
   */
  public updateOrderStatus: RequestHandler = async (req, res, next) => {
    const logContext = `${this.logContext} -> updateOrderStatus()`;

    try {
      const { id } = req.params;
      const { status } = req.body;

      const validStatuses: ITrademarkOrder['status'][] = [
        'pending', 'paid', 'processing', 'submitted_to_bpo', 'published', 'registered', 'rejected', 'cancelled',
      ];

      if (!status || !validStatuses.includes(status)) {
        throw new CustomError(400, `Invalid status. Must be one of: ${validStatuses.join(', ')}`);
      }

      // Get existing order to use its orderId
      const existingOrder = await this.trademarkOrderDataLayer.getById(id, logContext);
      const updatedOrder = await this.trademarkOrderDataLayer.updateStatus(
        existingOrder.orderId,
        status,
        logContext
      );

      res.status(200).json({
        success: true,
        data: updatedOrder,
      });
    } catch (err) {
      next(err);
    }
  };

  /**
   * POST /api/admin/trademark/orders/:id/note
   * Add or update admin notes on the order
   */
  public addAdminNote: RequestHandler = async (req, res, next) => {
    const logContext = `${this.logContext} -> addAdminNote()`;

    try {
      const { id } = req.params;
      const { note } = req.body;

      if (!note || typeof note !== 'string') {
        throw new CustomError(400, 'Note is required and must be a string');
      }

      // Append note with timestamp
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
    } catch (err) {
      next(err);
    }
  };

  /**
   * POST /api/admin/trademark/orders/:id/upload
   * Upload finished registration certificate or other documents back to the order
   */
  public uploadFinishedDocument: RequestHandler = async (req, res, next) => {
    const logContext = `${this.logContext} -> uploadFinishedDocument()`;

    try {
      const { id } = req.params;

      // Verify order exists
      await this.trademarkOrderDataLayer.getById(id, logContext);

      const files = req.files as Express.Multer.File[];

      if (!files || files.length === 0) {
        throw new CustomError(400, 'No files uploaded');
      }

      const uploadedFiles = files.map(file => ({
        filename: file.filename,
        originalName: file.originalname,
        path: file.path,
        size: file.size,
        mimetype: file.mimetype,
      }));

      const updatedOrder = await this.trademarkOrderDataLayer.update(
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
    } catch (err) {
      next(err);
    }
  };

  private static instance: TrademarkAdminController;

  public static getInstance(): TrademarkAdminController {
    if (!TrademarkAdminController.instance) {
      TrademarkAdminController.instance = new TrademarkAdminController();
    }

    return TrademarkAdminController.instance;
  }

}
