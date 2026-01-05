import mongoose from 'mongoose';

import CustomError from '../utils/custom-error.utils';

import { RefreshToken, RefreshTokenDoc, IRefreshToken } from '../models/refresh-token.model';

export default class RefreshTokenDataLayer {

  private logContext = 'Refresh Token Data Layer';

  public async create(data: Partial<IRefreshToken>, logContext: string): Promise<RefreshTokenDoc> {
    logContext = `${logContext} -> ${this.logContext} -> create()`;

    const refreshToken = await RefreshToken.create(data)
      .catch(err => {
        throw new CustomError(500, err.message, `${logContext} -> data: ${JSON.stringify(data)}`);
      });

    return refreshToken;
  }

  public async getByUserId(userId: mongoose.Types.ObjectId, logContext: string): Promise<RefreshTokenDoc | null> {
    logContext = `${logContext} -> ${this.logContext} -> getByUserId()`;

    if (!mongoose.isValidObjectId(userId)) {
      throw new CustomError(400, `Invalid ID`);
    }

    const refreshToken = await RefreshToken.findOne({ userId })
      .catch(err => {
        throw new CustomError(500, err.messagem, `${logContext} -> RefreshToken.findOne() -> userId: ${userId}`);
      });

    return refreshToken;
  }

  public async delete(refreshToken: RefreshTokenDoc, logContext: string): Promise<void> {
    logContext = `${logContext} -> ${this.logContext} -> delete()`;

    await refreshToken.deleteOne()
        .catch(err => {
            throw new CustomError(500, err.message, `${logContext} -> refreshToken: ${JSON.stringify(refreshToken)}`);
        });
  }

  private static instance: RefreshTokenDataLayer;

  public static getInstance(): RefreshTokenDataLayer {
    if (!RefreshTokenDataLayer.instance) {
        RefreshTokenDataLayer.instance = new RefreshTokenDataLayer();
    }

    return RefreshTokenDataLayer.instance;
  }

}