import mongoose, { Schema } from 'mongoose';

import Config from './../config';

export const EUIPO_TOKEN_DOC_ID = 'default';

interface IEuipoToken {
 _id: string;
 accessToken: string;
 refreshToken: string | null;
 expiresAt: Date;
 updatedAt: Date;
}

const EuipoTokenSchema = new Schema<IEuipoToken>(
 {
  _id: { type: String, required: true, default: EUIPO_TOKEN_DOC_ID },
  accessToken: { type: String, required: true },
  refreshToken: { type: String, default: null },
  expiresAt: { type: Date, required: true },
 },
 { timestamps: true, collection: 'euipo-tokens' }
);

const db = mongoose.connection.useDb(Config.getInstance().databases.main);
const EuipoToken = db.model<IEuipoToken>('EuipoToken', EuipoTokenSchema);

type EuipoTokenDoc = ReturnType<(typeof EuipoToken)['hydrate']>;

export { EuipoToken, EuipoTokenDoc, IEuipoToken };
