import mongoose, { FilterQuery, UpdateQuery } from 'mongoose';

import CustomError from './../utils/custom-error.utils';

import { Order, OrderDoc, IOrder } from './../models/order.model';

export default class OrderDataLayer {

  private logContext = 'Order Data Layer';

  public async create(data: Partial<IOrder>, logContext: string): Promise<OrderDoc> {
    logContext = `${logContext} -> ${this.logContext} -> create()`;

    const order = await Order.create(data)
      .catch(err => {
        throw new CustomError(500, err.message, `${logContext} -> data: ${JSON.stringify(data)}`);
      });

    return order;
  }

  public async get(filter: FilterQuery<IOrder>, logContext: string): Promise<OrderDoc> {
    logContext = `${logContext} -> ${this.logContext} -> get()`;

    const order = await Order.findOne(filter)
      .catch(err => {
        throw new CustomError(500, err.message, `${logContext} -> filter: ${JSON.stringify(filter)}`);
      });

    if (!order) {
      throw new CustomError(404, `No order found`);
    }

    return order;
  }

  public async getById(id: string | mongoose.Types.ObjectId, logContext: string): Promise<OrderDoc> {
    logContext = `${logContext} -> ${this.logContext} -> getById()`;

    if (!mongoose.isValidObjectId(id)) {
      throw new CustomError(400, `Invalid ID`);
    }

    const order = await Order.findById(id)
      .catch(err => {
        throw new CustomError(500, err.message, `${logContext} -> id: ${id.toString()}`);
      });

    if (!order) {
      throw new CustomError(404, `No order found`);
    }

    return order;
  }

  public async getByOrderId(orderId: string, logContext: string): Promise<OrderDoc> {
    logContext = `${logContext} -> ${this.logContext} -> getByOrderId()`;

    const order = await Order.findOne({ orderId })
      .catch(err => {
        throw new CustomError(500, err.message, `${logContext} -> orderId: ${orderId}`);
      });

    if (!order) {
      throw new CustomError(404, `No order found with orderId: ${orderId}`);
    }

    return order;
  }

  public async getAll(filter: FilterQuery<IOrder>, logContext: string): Promise<OrderDoc[]> {
    logContext = `${logContext} -> ${this.logContext} -> getAll()`;

    const orders = await Order.find(filter)
      .sort({ createdAt: -1 })
      .catch(err => {
        throw new CustomError(500, err.message, `${logContext} -> filter: ${JSON.stringify(filter)}`);
      });

    return orders;
  }

  public async getUserOrders(userId: string | mongoose.Types.ObjectId, logContext: string): Promise<OrderDoc[]> {
    logContext = `${logContext} -> ${this.logContext} -> getUserOrders()`;

    if (!mongoose.isValidObjectId(userId)) {
      throw new CustomError(400, `Invalid user ID`);
    }

    const orders = await Order.find({ userId })
      .sort({ createdAt: -1 })
      .catch(err => {
        throw new CustomError(500, err.message, `${logContext} -> userId: ${userId.toString()}`);
      });

    return orders;
  }

  public async update(id: string | mongoose.Types.ObjectId, update: UpdateQuery<IOrder>, logContext: string): Promise<OrderDoc> {
    logContext = `${logContext} -> ${this.logContext} -> update()`;

    if (!mongoose.isValidObjectId(id)) {
      throw new CustomError(400, `Invalid ID`);
    }

    const order = await Order.findByIdAndUpdate(id, update, { new: true })
      .catch(err => {
        throw new CustomError(500, err.message, `${logContext} -> findByIdAndUpdate() -> id: ${id.toString()} | update: ${JSON.stringify(update)}`);
      });

    if (!order) {
      throw new CustomError(404, `No order found`);
    }

    return order;
  }

  public async updateByOrderId(orderId: string, update: UpdateQuery<IOrder>, logContext: string): Promise<OrderDoc> {
    logContext = `${logContext} -> ${this.logContext} -> updateByOrderId()`;

    const order = await Order.findOneAndUpdate({ orderId }, update, { new: true })
      .catch(err => {
        throw new CustomError(500, err.message, `${logContext} -> findOneAndUpdate() -> orderId: ${orderId} | update: ${JSON.stringify(update)}`);
      });

    if (!order) {
      throw new CustomError(404, `No order found with orderId: ${orderId}`);
    }

    return order;
  }

  public async updateStatus(
    orderId: string,
    status: 'pending' | 'paid' | 'finished' | 'failed' | 'processing' | 'fraud_attempt' | 'cancelled',
    logContext: string
  ): Promise<OrderDoc> {
    logContext = `${logContext} -> ${this.logContext} -> updateStatus()`;

    const update: UpdateQuery<IOrder> = { status };

    if (status === 'paid' || status === 'finished') {
      update.paidAt = new Date();
    } else if (status === 'failed' || status === 'cancelled') {
      update.failedAt = new Date();
    }

    return this.updateByOrderId(orderId, update, logContext);
  }

  public async deleteMany(filter: FilterQuery<IOrder>, logContext: string): Promise<number> {
    logContext = `${logContext} -> ${this.logContext} -> deleteMany()`;

    const result = await Order.deleteMany(filter)
      .catch(err => {
        throw new CustomError(500, err.message, `${logContext} -> filter: ${JSON.stringify(filter)}`);
      });

    return result.deletedCount ?? 0;
  }

  private static instance: OrderDataLayer;

  public static getInstance(): OrderDataLayer {
    if (!OrderDataLayer.instance) {
      OrderDataLayer.instance = new OrderDataLayer();
    }

    return OrderDataLayer.instance;
  }

}
