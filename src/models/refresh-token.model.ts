import mongoose, { Schema, Types } from 'mongoose';

import Config from './../config';

interface IRefreshToken {
 userId: Types.ObjectId;
 token: string;
 createdAt: Date;
 updatedAt: Date;
}

const RefreshTokenSchema = new mongoose.Schema<IRefreshToken>({
 userId: {
  type: Schema.Types.ObjectId,
  required: true,
  ref: 'User',
 },
 token: {
  type: String,
  required: true,
 },
}, 
{
 timestamps: true,
 collection: 'refresh-tokens',
});

RefreshTokenSchema.index({ userId: 1 });
RefreshTokenSchema.index({ createdAt: 1 }, { expireAfterSeconds: 86400 * 7 }); // 24 Hours

const db = mongoose.connection.useDb(Config.getInstance().databases.main, { useCache: true });
const RefreshToken = db.model<IRefreshToken>('RefreshToken', RefreshTokenSchema);

type RefreshTokenDoc = ReturnType<(typeof RefreshToken)['hydrate']>;

export { RefreshToken, RefreshTokenDoc, IRefreshToken };
