import mongoose, { Schema, Types } from 'mongoose';

import Config from './../config';

export enum OrderListStatus {
  Draft = 'draft', // When user has created an order but not yet paid for it.
  Pending = 'pending', // WHen user has created an order and awaiting payment.
  Paid = 'paid', // When stripe link has been paid for the order.
  Processing = 'processing', // when order is being processed. Cnfans handling, rehearsing etc.
  Shipping = 'shipping', // When order is currently being shipped.
  Finished = 'finished', // When order has been completed, user has received the order.
}

export interface IOrderCustomer {
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
}

export interface IOrderAdress {
  address: string;
  city: string;
  postalCode: string;
  street: string;
}

export interface IOrderProduct {
  productId: Types.ObjectId;
  quantity: number;
  price: number;
  skuId: string;
}

interface IOrder {
  _id: string;
  status: OrderListStatus;
  customer: IOrderCustomer;
  address: IOrderAdress;
  products: IOrderProduct[];
  totalPrice: number;
  notes: string;
  createdAt: Date;
  updatedAt: Date;
}

const OrderSchema = new Schema<IOrder>({
  customer: {
    firstName: {
      type: String,
      required: true,
    },
    lastName: {
      type: String,
      required: true,
    },
    email: {
      type: String,
      required: true,
    },
    phone: {
      type: String,
      required: true,
    },
  },
  status: {
    type: String,
    default: OrderListStatus.Pending,
  },
  address: {
    address: {
      type: String,
      required: true,
    },
    city: {
      type: String,
      required: true,
    },
    postalCode: {
      type: String,
      required: true,
    },
    street: {
      type: String,
      required: true,
    },
  },
  products: {
    type: [
      {
        productId: {
          type: Schema.Types.ObjectId,
          required: true,
          ref: 'CNFansProduct',
        },
        quantity: {
          type: Number,
          required: true,
        },
        price: {
          type: Number,
          required: true,
        },
        skuId: {
          type: String,
          required: true,
        },
      },
    ],
    required: true,
  },
  totalPrice: {
    type: Number,
    required: true,
  },
  notes: {
    type: String,
  },
}, {
  timestamps: true,
  collection: 'orders',
});

OrderSchema.set('toJSON', {
  virtuals: true,
  versionKey: false,
  transform: function (doc: any, ret: any) { delete ret._id; delete ret.password },
});

const db = mongoose.connection.useDb(Config.getInstance().databases.main);
const Order = db.model<IOrder>('Order', OrderSchema);

type OrderDoc = ReturnType<(typeof Order)['hydrate']>;

export { Order, OrderDoc, IOrder };
