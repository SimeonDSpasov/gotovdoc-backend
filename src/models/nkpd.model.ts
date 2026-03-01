import mongoose from 'mongoose';

import Config from './../config';

export interface INkpdOccupation {
 code: string;
 name: string;
 groupCode: string;
}

const NkpdOccupationSchema = new mongoose.Schema<INkpdOccupation>({
 code: {
  type: String,
  required: true,
  index: true,
 },
 name: {
  type: String,
  required: true,
 },
 groupCode: {
  type: String,
  required: true,
 },
},
{
 timestamps: true,
 collection: 'nkpd_occupations'
});

NkpdOccupationSchema.index({ name: 'text' });

NkpdOccupationSchema.set('toJSON', {
 virtuals: true,
 versionKey: false,
 transform: function (doc: any, ret: any) { delete ret._id; }
});

NkpdOccupationSchema.set('toObject', {
 virtuals: true,
 versionKey: false,
 transform: function (doc: any, ret: any) { delete ret._id; }
});

const db = mongoose.connection.useDb(Config.getInstance().databases.main);
const NkpdOccupation = db.model<INkpdOccupation>('NkpdOccupation', NkpdOccupationSchema);

type NkpdOccupationDoc = ReturnType<(typeof NkpdOccupation)['hydrate']>;

export { NkpdOccupation, NkpdOccupationDoc };
