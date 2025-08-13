import { RequestHandler } from 'express';
import bcryptjs from 'bcryptjs';
import mongoose from 'mongoose';

import CustomError from '../utils/custom-error.utils';

// import TokenUtil from './../utils/token.util';

// import { EmailType, EmailUtil } from './../utils/email.util';

import UserDataLayer from '../data-layers/user.data-layer';

import { IUser } from '../models/user.model';

import Config from '../config';

export default class AuthController {
  
  private logContext = 'Auth Controller';
  
  // private config = Config.getInstance();
  // private tokenUtil = TokenUtil.getInstance();
  // private userDataLayer = UserDataLayer.getInstance();

  // public refreshAccessToken: RequestHandler = async (req, res) => {
  //   const headers = req.headers;
  //   const headerValue = headers['authorization-refresh'];

  //   if (!headerValue || typeof headerValue !== 'string') {
  //     throw new CustomError(404, 'No refresh token provided');
  //   }

  //   const refreshToken = headerValue.split(' ')[1];

  //   const userId = await this.tokenUtil.getUserIdFromRefreshToken(refreshToken)
  //     .catch(() => {
  //       throw new CustomError(401, 'Unauthorized');
  //     });

  //   const accessToken = this.tokenUtil.getAccessToken(userId);

  //   res.header('Authorization-Access', accessToken);
  //   res.header('Access-Control-Expose-Headers', 'Authorization-Access');

  //   res.status(200).json();
  // }

  // public login: RequestHandler = async (req, res) => {
  //   const { email, password } = req.body;

  //   if (!email || !password) {
  //     throw new CustomError(404, 'No user found / Wrong credentials');
  //   }

  //   const logContext = `${this.logContext} -> login()`;

  //   const user = await this.userDataLayer.get({ email: email }, logContext, 'password affiliateProgramId referralAffiliateProgramId fingerprints');

  //   const isPasswordValid = await bcryptjs.compare(password, user.password)
  //     .catch(err => {
  //       throw new CustomError(500, err.message, `${logContext} -> bcryptjs.compare() -> userId: ${user._id.toString()}`);
  //     });

  //   if (!isPasswordValid) {
  //     throw new CustomError(404, 'No user found / Wrong credentials');
  //   }

  //   const accessToken = this.tokenUtil.getAccessToken(user._id);
  //   const refreshToken = await this.tokenUtil.getRefreshToken(user._id, logContext);

  //   res.header('Authorization-Access', accessToken);
  //   res.header('Authorization-Refresh', refreshToken);
  //   res.header('Access-Control-Expose-Headers', 'Authorization-Access, Authorization-Refresh');

  //   res.status(200).json();
  // }

  // public register: RequestHandler = async (req, res) => {
  //   const { email, password, firstName, lastName, phoneNumber, market, fingerprint, referralCode } = req.body;

  //   if (!email || !password) {
  //     throw new CustomError(400, 'Missing fields: email | password');
  //   }

  //   const logContext = `${this.logContext} -> register()`;
  
  //   const createUser: Partial<IUser> = {
  //     email,
  //     password,
  //   };

  //   const user = await this.userDataLayer.create(createUser, logContext);

  //   const accessToken = this.tokenUtil.getAccessToken(user._id);
  //   const refreshToken = await this.tokenUtil.getRefreshToken(user._id, logContext);
    
  //   res.header('Authorization-Access', accessToken);
  //   res.header('Authorization-Refresh', refreshToken);
  //   res.header('Access-Control-Expose-Headers', 'Authorization-Access, Authorization-Refresh');

  //   res.status(200).json();
  // }

  // public forgottenPassword: RequestHandler = async (req, res) => {
  //   const email = req.body.email;

  //   if (!email) {
  //     throw new CustomError(400, 'Email required');
  //   }

  //   const logContext = `${this.logContext} -> forgottenPassword()`;

  //   const user = await this.userDataLayer.get({ email: email }, logContext)

  //   const oldResetPasswordToken = await this.resetPasswordTokenDataLayer.get({ userId: user._id }, logContext);

  //   if (oldResetPasswordToken) {
  //     this.resetPasswordTokenDataLayer.delete(oldResetPasswordToken, logContext);
  //   }

  //   const token = this.tokenUtil.getAccessToken(user._id);

  //   const newResetPasswordToken: Partial<IResetPasswordToken> = {
  //     userId: user._id,
  //     token,
  //   };

  //   this.resetPasswordTokenDataLayer.create(newResetPasswordToken, logContext);

  //   const resetPasswordLink = `${this.config.frontendUrl}/reset-password?token=${token}`;
    
  //   res.status(200).json();
  // }

  // public resetPassword: RequestHandler = async (req, res) => {
  //   const { token, password } = req.body;
  //   const tokenValue = token.split(' ')[1];

  //   if (!token || !password || !tokenValue) {
  //     throw new CustomError(400, 'Missing fields: id | token | password');
  //   }

  //   const userId = this.tokenUtil.getUserIdFromAccessToken(tokenValue);

  //   if (!mongoose.isValidObjectId(userId)) {
  //     throw new CustomError(404, `No user found`);
  //   }

  //   const logContext = `${this.logContext} -> resetPassword()`;

  //   const user = await this.userDataLayer.getById(userId, logContext);

  //   const resetPasswordToken = await this.resetPasswordTokenDataLayer.get({ userId }, logContext);

  //   if (!resetPasswordToken) {
  //     throw new CustomError(404, 'No user found');
  //   }

  //   await this.userDataLayer.updatePassword(user, password, logContext);
  //   await this.resetPasswordTokenDataLayer.delete(resetPasswordToken, logContext);
    
  //   res.status(200).json();
  // }

  // public changePassword: RequestHandler = async (req, res) => {
  //   const user = req.user;
  //   const { oldPassword, newPassword } = req.body;

  //   if (!oldPassword || !newPassword) {
  //     throw new CustomError(400, 'Missing fields: oldPassword | newPassword');
  //   }

  //   const logContext = `${this.logContext} -> changePassword()`;

  //   const isOldPasswordValid = await bcryptjs.compare(oldPassword, user.password)
  //     .catch(err => {
  //       throw new CustomError(500, err.message, `${logContext} -> isOldPasswordValid -> bcryptjs.compare() -> userId: ${user._id.toString()}`);
  //     });

  //   if (!isOldPasswordValid) {
  //     throw new CustomError(400, 'Invalid old password');
  //   }

  //   await this.userDataLayer.updatePassword(user, newPassword, logContext);
    
  //   res.status(200).json();
  // }

  // public changeEmail: RequestHandler = async (req, res) => {
  //   let user = req.user;
  //   const oldEmail = user.email;
  //   const { password, email: newEmail } = req.body;

  //   if (!password || !newEmail) {
  //     throw new CustomError(400, 'Missing fields: password | email');
  //   }

  //   const logContext = `${this.logContext} -> changeEmail()`;

  //   const isPasswordValid = await bcryptjs.compare(password, user.password)
  //     .catch(err => {
  //       throw new CustomError(500, err.message, `${logContext} -> bcryptjs.compare() -> userId: ${user._id.toString()}`);
  //     });

  //   if (!isPasswordValid) {
  //     throw new CustomError(403, 'Invalid password');
  //   }

  //   if (newEmail === oldEmail) {
  //     throw new CustomError(400, 'Same email');
  //   }

  //   const updateUser = {
  //     $set: {
  //       email: newEmail,
  //     },
  //     $push: {
  //       oldEmails: oldEmail,
  //     },
  //   };

  //   user = await this.userDataLayer.update(user._id, updateUser, logContext);

  //   res.status(200).json(user);
  // }

}
