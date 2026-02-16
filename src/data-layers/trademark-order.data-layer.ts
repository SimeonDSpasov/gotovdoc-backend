import mongoose, { FilterQuery, UpdateQuery } from 'mongoose';

import CustomError from './../utils/custom-error.utils';

import { TrademarkOrder, TrademarkOrderDoc, ITrademarkOrder } from './../models/trademark-order.model';

export default class TrademarkOrderDataLayer {

  private logContext = 'Trademark Order Data Layer';

  public async create(data: Partial<ITrademarkOrder>, logContext: string): Promise<TrademarkOrderDoc> {
    logContext = `${logContext} -> ${this.logContext} -> create()`;

    const order = await TrademarkOrder.create(data)
      .catch(err => {
        throw new CustomError(500, err.message, `${logContext} -> data: ${JSON.stringify(data)}`);
      });

    return order;
  }

  public async get(filter: FilterQuery<ITrademarkOrder>, logContext: string): Promise<TrademarkOrderDoc> {
    logContext = `${logContext} -> ${this.logContext} -> get()`;

    const order = await TrademarkOrder.findOne(filter)
      .catch(err => {
        throw new CustomError(500, err.message, `${logContext} -> filter: ${JSON.stringify(filter)}`);
      });

    if (!order) {
      throw new CustomError(404, 'No trademark order found');
    }

    return order;
  }

  public async getById(id: string | mongoose.Types.ObjectId, logContext: string): Promise<TrademarkOrderDoc> {
    logContext = `${logContext} -> ${this.logContext} -> getById()`;

    if (!mongoose.isValidObjectId(id)) {
      throw new CustomError(400, 'Invalid ID');
    }

    const order = await TrademarkOrder.findById(id)
      .catch(err => {
        throw new CustomError(500, err.message, `${logContext} -> id: ${id.toString()}`);
      });

    if (!order) {
      throw new CustomError(404, 'No trademark order found');
    }

    return order;
  }

  public async getByOrderId(orderId: string, logContext: string): Promise<TrademarkOrderDoc> {
    logContext = `${logContext} -> ${this.logContext} -> getByOrderId()`;

    const order = await TrademarkOrder.findOne({ orderId })
      .catch(err => {
        throw new CustomError(500, err.message, `${logContext} -> orderId: ${orderId}`);
      });

    if (!order) {
      throw new CustomError(404, `No trademark order found with orderId: ${orderId}`);
    }

    return order;
  }

  public async getAll(filter: FilterQuery<ITrademarkOrder>, logContext: string): Promise<TrademarkOrderDoc[]> {
    logContext = `${logContext} -> ${this.logContext} -> getAll()`;

    const orders = await TrademarkOrder.find(filter)
      .sort({ createdAt: -1 })
      .catch(err => {
        throw new CustomError(500, err.message, `${logContext} -> filter: ${JSON.stringify(filter)}`);
      });

    return orders;
  }

  public async getUserOrders(userId: string | mongoose.Types.ObjectId, logContext: string): Promise<TrademarkOrderDoc[]> {
    logContext = `${logContext} -> ${this.logContext} -> getUserOrders()`;

    if (!mongoose.isValidObjectId(userId)) {
      throw new CustomError(400, 'Invalid user ID');
    }

    const orders = await TrademarkOrder.find({ userId })
      .sort({ createdAt: -1 })
      .catch(err => {
        throw new CustomError(500, err.message, `${logContext} -> userId: ${userId.toString()}`);
      });

    return orders;
  }

  public async update(id: string | mongoose.Types.ObjectId, update: UpdateQuery<ITrademarkOrder>, logContext: string): Promise<TrademarkOrderDoc> {
    logContext = `${logContext} -> ${this.logContext} -> update()`;

    if (!mongoose.isValidObjectId(id)) {
      throw new CustomError(400, 'Invalid ID');
    }

    const order = await TrademarkOrder.findByIdAndUpdate(id, update, { new: true })
      .catch(err => {
        throw new CustomError(500, err.message, `${logContext} -> findByIdAndUpdate() -> id: ${id.toString()} | update: ${JSON.stringify(update)}`);
      });

    if (!order) {
      throw new CustomError(404, 'No trademark order found');
    }

    return order;
  }

  public async updateByOrderId(orderId: string, update: UpdateQuery<ITrademarkOrder>, logContext: string): Promise<TrademarkOrderDoc> {
    logContext = `${logContext} -> ${this.logContext} -> updateByOrderId()`;

    const order = await TrademarkOrder.findOneAndUpdate({ orderId }, update, { new: true })
      .catch(err => {
        throw new CustomError(500, err.message, `${logContext} -> findOneAndUpdate() -> orderId: ${orderId} | update: ${JSON.stringify(update)}`);
      });

    if (!order) {
      throw new CustomError(404, `No trademark order found with orderId: ${orderId}`);
    }

    return order;
  }

  public async updateStatus(
    orderId: string,
    status: ITrademarkOrder['status'],
    logContext: string
  ): Promise<TrademarkOrderDoc> {
    logContext = `${logContext} -> ${this.logContext} -> updateStatus()`;

    const update: UpdateQuery<ITrademarkOrder> = { status };

    if (status === 'paid') {
      update.paidAt = new Date();
    } else if (status === 'cancelled' || status === 'rejected') {
      update.failedAt = new Date();
    }

    return this.updateByOrderId(orderId, update, logContext);
  }

  public async deleteMany(filter: FilterQuery<ITrademarkOrder>, logContext: string): Promise<number> {
    logContext = `${logContext} -> ${this.logContext} -> deleteMany()`;

    const result = await TrademarkOrder.deleteMany(filter)
      .catch(err => {
        throw new CustomError(500, err.message, `${logContext} -> filter: ${JSON.stringify(filter)}`);
      });

    return result.deletedCount ?? 0;
  }

  private static instance: TrademarkOrderDataLayer;

  public static getInstance(): TrademarkOrderDataLayer {
    if (!TrademarkOrderDataLayer.instance) {
      TrademarkOrderDataLayer.instance = new TrademarkOrderDataLayer();
    }

    return TrademarkOrderDataLayer.instance;
  }

}
