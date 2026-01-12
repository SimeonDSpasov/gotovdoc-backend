import { RequestHandler, Request } from 'express';

import TokenUtil from './../utils/token.util';
import CustomError from './../utils/custom-error.utils';

import UserDataLayer from './../data-layers/user.data-layer';

import { UserDoc, UserRole } from './../models/user.model';

declare global {
  namespace Express {
    interface Request {
      user: UserDoc;
    }
  }
}

export default class AuthMiddleware {

  private logContext = 'Auth Middleware';

  private tokenUtil = TokenUtil.getInstance();
  private userDataLayer = UserDataLayer.getInstance();

  public isAuthenticated: RequestHandler = async (req, res, next) => {
    console.log('here')
    const accessToken = this.getAccessTokenFromHeaders(req);

    if (!accessToken) {
      return next(new CustomError(401, 'Unauthorized'));
    }

    const logContext = `${this.logContext} -> isAuthenticated()`;

    try {
      const userId = this.tokenUtil.getUserIdFromAccessToken(accessToken);
      const user = await this.userDataLayer.getById(userId, logContext, '');

      if (user.suspended) {
        return next(new CustomError(403, 'Forbidden'));
      }

      req.user = user;

      next();
    } catch (err) {
      next(new CustomError(498, 'Expired token'));
    }
  }

  public isAdmin: RequestHandler = (req, res, next) => {
    const user = req.user;

    console.log(user.role)

    if (user.role !== UserRole.Moderator) {
      next(new CustomError(403, 'Forbidden - Admin access required'));

      return;
    }

    next();
  }

  public isModerator: RequestHandler = (req, res, next) => {
    const user = req.user;

    if (user.role !== UserRole.Moderator && user.role !== UserRole.Admin) {
      next(new CustomError(403, 'Forbidden - Moderator access required'));

      return;
    }

    next();
  }

  private getAccessTokenFromHeaders(req: Request): string | undefined {
    let headerValue;
    let accessToken;

    if (req.headers['authorization-access']) {
      headerValue = req.headers['authorization-access']
    } else if (req.query['authorization-access']) {
      headerValue = req.query['authorization-access']
    }

    if (headerValue && typeof headerValue === 'string') {
      accessToken = headerValue.split(' ')[1];
    }

    return accessToken;
  }

  private static instance: AuthMiddleware;

  public static getInstance(): AuthMiddleware {
    if (!AuthMiddleware.instance) {
      AuthMiddleware.instance = new AuthMiddleware();
    }

    return AuthMiddleware.instance;
  }

}

