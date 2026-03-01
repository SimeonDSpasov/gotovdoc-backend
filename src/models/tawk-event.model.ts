import mongoose, { Schema } from 'mongoose';

import Config from './../config';

interface ITawkEvent {
 eventId: string;
 type: string;
 payload: object;
 createdAt: Date;
 updatedAt: Date;
}

const TawkEventSchema = new Schema<ITawkEvent>(
 {
  eventId: {
   type: String,
   required: true,
  },
  type: {
   type: String,
   required: true,
  },
  payload: {
   type: Schema.Types.Mixed,
   required: true,
  },
 },
 {
  timestamps: true,
  collection: 'tawk-events',
 }
);

TawkEventSchema.index({ eventId: 1 }, { unique: true });
TawkEventSchema.index({ createdAt: 1 }, { expireAfterSeconds: 90 * 24 * 60 * 60 }); // Remove after 90 days

const db = mongoose.connection.useDb(Config.getInstance().databases.main);
const TawkEvent = db.model<ITawkEvent>('TawkEvent', TawkEventSchema);

type TawkEventDoc = ReturnType<(typeof TawkEvent)['hydrate']>;

export { TawkEvent, TawkEventDoc, ITawkEvent };
