import mongoose, { FilterQuery, UpdateQuery } from 'mongoose';

import CustomError from './../utils/custom-error.utils';

import { Order, OrderDoc, IOrder } from './../models/order.model';
import { CNFansProduct } from './../models/cnfans-product.model';

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

  public async update(id: string | mongoose.Types.ObjectId, update: UpdateQuery<IOrder>, logContext: string): Promise<OrderDoc> {
    logContext = `${logContext} -> ${this.logContext} -> update()`;

    const order = await Order.findByIdAndUpdate(id, update, { new: true })
      .catch(err => {
        throw new CustomError(500, err.message, `${logContext} -> id: ${id} -> update: ${JSON.stringify(update)}`);
      });

    if (!order) {
      throw new CustomError(404, `No order found`);
    }

    return order;
  }

  public async list(filter: FilterQuery<IOrder>, logContext: string): Promise<OrderDoc[]> {
    logContext = `${logContext} -> ${this.logContext} -> list()`;

    const orders = await Order.find(filter)
      .populate({ path: 'products.productId', model: CNFansProduct })
      .catch(err => {
        throw new CustomError(500, err.message, `${logContext} -> filter: ${JSON.stringify(filter)}`);
      });

    return orders;
  }

  public async delete(id: string | mongoose.Types.ObjectId, logContext: string): Promise<void> {
    logContext = `${logContext} -> ${this.logContext} -> delete()`;

    const deleteResult = await Order.findByIdAndDelete(id)
      .catch(err => {
        throw new CustomError(500, err.message, `${logContext} -> id: ${id}`);
      });

    if (!deleteResult) {
      throw new CustomError(404, `No order found`);
    }
  }

  private static instance: OrderDataLayer;

  public static getInstance(): OrderDataLayer {
    if (!OrderDataLayer.instance) {
      OrderDataLayer.instance = new OrderDataLayer();
    }
    return OrderDataLayer.instance;
  }

}
