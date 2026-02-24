import { RequestHandler } from 'express';
import mongoose from 'mongoose';

import CustomError from './../utils/custom-error.utils';
import FileStorageUtil from './../utils/file-storage.util';

import OrderDataLayer from './../data-layers/order.data-layer';
import UserDataLayer from './../data-layers/user.data-layer';

export default class UserController {

  private logContext = 'User Controller';
  private orderDataLayer = OrderDataLayer.getInstance();
  private userDataLayer = UserDataLayer.getInstance();
  private fileStorageUtil = FileStorageUtil.getInstance();

  public getUser: RequestHandler = async (req, res) => {
    const user = req.user;

    res.status(200).json({
      id: user._id,
      email: user.email,
      firstName: user.firstName,
      lastName: user.lastName,
      role: user.role,
      suspended: user.suspended,
      createdAt: user.createdAt,
    });
  }

  public getOrders: RequestHandler = async (req, res) => {
    const user = req.user;
    const logContext = `${this.logContext} -> getOrders()`;

    const orders = await this.orderDataLayer.getUserOrders(user._id, logContext);

    res.status(200).json({
      data: orders,
    });
  }

  public getOrderById: RequestHandler = async (req, res) => {
    const user = req.user;
    const { orderId } = req.params;

    if (!orderId) {
      throw new CustomError(400, 'Order ID is required');
    }

    const logContext = `${this.logContext} -> getOrderById()`;

    const order = mongoose.isValidObjectId(orderId)
      ? await this.orderDataLayer.getById(orderId, logContext)
      : await this.orderDataLayer.getByOrderId(orderId, logContext);

    if (!order.userId || order.userId.toString() !== user._id.toString()) {
      throw new CustomError(403, 'Forbidden');
    }

    res.status(200).json({
      data: order,
    });
  }

  public downloadOrderFile: RequestHandler = async (req, res) => {
    const user = req.user;
    const { orderId, fileIndex } = req.params;
    const logContext = `${this.logContext} -> downloadOrderFile()`;

    if (!orderId || fileIndex === undefined) {
      throw new CustomError(400, 'Order ID and file index are required');
    }

    const order = mongoose.isValidObjectId(orderId)
      ? await this.orderDataLayer.getById(orderId, logContext)
      : await this.orderDataLayer.getByOrderId(orderId, logContext);

    if (!order.userId || order.userId.toString() !== user._id.toString()) {
      throw new CustomError(403, 'Forbidden');
    }

    const files = order.finishedFiles || [];
    const idx = parseInt(fileIndex, 10);

    if (isNaN(idx) || idx < 0 || idx >= files.length) {
      throw new CustomError(404, 'File not found');
    }

    const file = files[idx];

    const fileStream = await this.fileStorageUtil.downloadFile(file.fileId.toString());

    res.setHeader('Content-Type', file.mimetype || 'application/octet-stream');
    res.setHeader('Content-Disposition', `attachment; filename="${file.filename}"`);
    fileStream.pipe(res);
  }

  public getActivity: RequestHandler = async (req, res) => {
    const user = req.user;
    const logContext = `${this.logContext} -> getActivity()`;

    const rawLimit = req.query.limit;
    const parsedLimit = typeof rawLimit === 'string' ? Number.parseInt(rawLimit, 10) : NaN;
    const limit = Number.isFinite(parsedLimit) ? Math.min(Math.max(parsedLimit, 1), 100) : 10;

    const userDoc = await this.userDataLayer.getById(user._id, logContext, 'activity');
    const activity = Array.isArray(userDoc.activity) ? userDoc.activity : [];
    const sortedActivity = [...activity].sort((a, b) => {
      const aTime = a.createdAt ? new Date(a.createdAt).getTime() : 0;
      const bTime = b.createdAt ? new Date(b.createdAt).getTime() : 0;
      return bTime - aTime;
    });

    res.status(200).json({
      data: sortedActivity.slice(0, limit),
    });
  }

}
