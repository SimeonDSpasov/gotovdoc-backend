import mongoose, { Schema } from 'mongoose';

import Config from './../config';

interface IEuipoTerm {
 text: string;
 conceptId: string;
 taxonomyParentId: string;
}

interface IEuipoClass {
 classNumber: number;
 heading: string;
 description: string;
 terms: IEuipoTerm[];
 totalTerms: number;
 syncedAt: Date | null;
}

const EuipoTermSchema = new Schema<IEuipoTerm>(
 {
  text: { type: String, required: true },
  conceptId: { type: String, required: true },
  taxonomyParentId: { type: String, default: '' },
 },
 { _id: false }
);

const EuipoClassSchema = new Schema<IEuipoClass>(
 {
  classNumber: { type: Number, required: true },
  heading: { type: String, default: '' },
  description: { type: String, default: '' },
  terms: { type: [EuipoTermSchema], default: [] },
  totalTerms: { type: Number, default: 0 },
  syncedAt: { type: Date, default: null },
 },
 { collection: 'euipo-classes' }
);

EuipoClassSchema.index({ classNumber: 1 }, { unique: true });
EuipoClassSchema.index({ 'terms.text': 'text' });

const db = mongoose.connection.useDb(Config.getInstance().databases.main);
const EuipoClass = db.model<IEuipoClass>('EuipoClass', EuipoClassSchema);

type EuipoClassDoc = ReturnType<(typeof EuipoClass)['hydrate']>;

export { EuipoClass, EuipoClassDoc, IEuipoClass, IEuipoTerm };
