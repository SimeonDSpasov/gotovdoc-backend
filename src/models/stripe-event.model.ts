import mongoose, { Schema } from 'mongoose';

import Config from './../config';

interface IStripeEvent {
  type: string;
  eventId: string;
  createdAt: Date;
  updatedAt: Date;
}

const StripeEventSchema = new Schema<IStripeEvent>(
  {
    type: {
      type: String,
      required: true,
    },
    eventId: {
      type: String,
      required: true,
    },
  },
  {
    timestamps: true,
    collection: 'stripe-events',
  }
);

StripeEventSchema.index({ eventId: 1 }, { unique: true });
StripeEventSchema.index({ createdAt: 1 }, { expireAfterSeconds: 60 * 24 * 60 * 60 }); // Remove after 60 days

const db = mongoose.connection.useDb(Config.getInstance().databases.main);
const StripeEvent = db.model<IStripeEvent>('StripeEvent', StripeEventSchema);

type StripeEventDoc = ReturnType<(typeof StripeEvent)['hydrate']>;

export { StripeEvent, StripeEventDoc, IStripeEvent };
