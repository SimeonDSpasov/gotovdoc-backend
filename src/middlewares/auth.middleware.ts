import { RequestHandler, Request } from 'express';

import UserDataLayer from './../data-layers/user.data-layer';

import { UserDoc } from './../models/user.model';

declare global {
  namespace Express {
    interface Request {
      user: UserDoc;
    }
  }
}

export default class AuthMiddleware {

  // private logContext = 'Auth Middleware';

  // private tokenUtil = TokenUtil.getInstance();
  // private userDataLayer = UserDataLayer.getInstance();

  // public isAuthenticated: RequestHandler = async (req, res, next) => {
  //   const accessToken = this.getAccessTokenFromHeaders(req);

  //   if (!accessToken) {
  //     return next(new CustomError(401, 'Unauthorized'));
  //   }

  //   const logContext = `${this.logContext} -> isAuthenticated()`;

  //   try {
  //     const userId = this.tokenUtil.getUserIdFromAccessToken(accessToken);
  //     const user = await this.userDataLayer.getById(userId, logContext, '');

  //     if (user.suspended) {
  //       return next(new CustomError(403, 'Forbidden'));
  //     }

  //     req.user = user;

  //     next();
  //   } catch (err) {
  //     next(new CustomError(498, 'Expired token'));
  //   }
  // }

  // private getAccessTokenFromHeaders(req: Request): string | undefined {
  //   let headerValue;
  //   let accessToken;

  //   if (req.headers['authorization-access']) {
  //     headerValue = req.headers['authorization-access']
  //   } else if (req.query['authorization-access']) {
  //     headerValue = req.query['authorization-access']
  //   }

  //   if (headerValue && typeof headerValue === 'string') {
  //     accessToken = headerValue.split(' ')[1];
  //   }

  //   return accessToken;
  // }

  // private static instance: AuthMiddleware;

  // public static getInstance(): AuthMiddleware {
  //   if (!AuthMiddleware.instance) {
  //     AuthMiddleware.instance = new AuthMiddleware();
  //   }

  //   return AuthMiddleware.instance;
  // }

}

