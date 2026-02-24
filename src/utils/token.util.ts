import jwt from 'jsonwebtoken';
import mongoose from 'mongoose';

import CustomError from './custom-error.utils';

import RefreshTokenDataLayer from './../data-layers/refresh-token.data-layer';

import Config from './../config';

export default class TokenUtil {

 private logContext = 'Token Util';

 private config = Config.getInstance();
 private refreshTokenDataLayer = RefreshTokenDataLayer.getInstance();

 public getAccessToken(userId: mongoose.Types.ObjectId): string {
  const token = this.createAccessJWT(userId);

  return token;
 }
 
 public async getRefreshToken(userId: mongoose.Types.ObjectId, logContext: string): Promise<string> {  
  logContext = `${logContext} -> ${this.logContext} -> getRefreshToken()`;

  const currentRefreshToken = await this.refreshTokenDataLayer.getByUserId(userId, logContext);

  if (currentRefreshToken) {
   await this.refreshTokenDataLayer.delete(currentRefreshToken, logContext);
  }

  const token = this.createRefreshJWT(userId);

  const createRefreshToken = {
   userId,
   token,
  };

  await this.refreshTokenDataLayer.create(createRefreshToken, logContext);

  return token;
 }
 
 public getUserIdFromAccessToken(token: string): mongoose.Types.ObjectId {
  const decodedToken = jwt.verify(token, this.config.jwt.accessSecret);

  if (decodedToken && typeof decodedToken !== 'string' && decodedToken.userId && mongoose.isValidObjectId(decodedToken.userId)) {
   return decodedToken.userId;
  }

  throw new CustomError(404, 'Invalid token');
 }
 
 public async getUserIdFromRefreshToken(token: string): Promise<mongoose.Types.ObjectId> {
  const logContext = `${this.logContext} -> getUserIdFromRefreshToken()`;

  const decodedToken = jwt.verify(token, this.config.jwt.refreshSecret);

  if (decodedToken && typeof decodedToken !== 'string' && decodedToken.userId && mongoose.isValidObjectId(decodedToken.userId)) {
   const refreshToken = await this.refreshTokenDataLayer.getByUserId(decodedToken.userId, logContext);

   if (refreshToken && refreshToken.token === 'Bearer ' + token) {
    return decodedToken.userId;
   }
  }

  throw new CustomError(404, 'Invalid token');
 }

 private createAccessJWT(userId: mongoose.Types.ObjectId): string {
  const token = 'Bearer ' +
   jwt.sign(
    { userId },
    this.config.jwt.accessSecret,
    { expiresIn: this.config.jwt.accessExpireTime }
   );

  return token;
 }

 private createRefreshJWT(userId: mongoose.Types.ObjectId): string {
  const token = 'Bearer ' +
   jwt.sign(
    { userId },
    this.config.jwt.refreshSecret,
    { expiresIn: this.config.jwt.refreshExpireTime }
   );

  return token;
 }

 private static instance: TokenUtil;

 public static getInstance(): TokenUtil {
  if (!TokenUtil.instance) {
   TokenUtil.instance = new TokenUtil();
  }

  return TokenUtil.instance;
 }

}

