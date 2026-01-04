import { RequestHandler } from 'express';
import bcryptjs from 'bcryptjs';
import mongoose from 'mongoose';

import CustomError from '../utils/custom-error.utils';
import TokenUtil from '../utils/token.util';
import { EmailType, EmailUtil } from '../utils/email.util';

import UserDataLayer from '../data-layers/user.data-layer';

import { IUser } from '../models/user.model';

import Config from '../config';
import logger from '@ipi-soft/logger';

export default class AuthController {
  
  private logContext = 'Auth Controller';
  
  private config = Config.getInstance();
  private emailUtil = EmailUtil.getInstance();
  private tokenUtil = TokenUtil.getInstance();
  private userDataLayer = UserDataLayer.getInstance();

  public refreshAccessToken: RequestHandler = async (req, res) => {
    const headers = req.headers;
    const headerValue = headers['authorization-refresh'];

    if (!headerValue || typeof headerValue !== 'string') {
      throw new CustomError(404, 'No refresh token provided');
    }

    const refreshToken = headerValue.split(' ')[1];

    const userId = await this.tokenUtil.getUserIdFromRefreshToken(refreshToken)
      .catch(() => {
        throw new CustomError(401, 'Unauthorized');
      });

    const accessToken = this.tokenUtil.getAccessToken(userId);

    res.header('Authorization-Access', accessToken);
    res.header('Access-Control-Expose-Headers', 'Authorization-Access');

    res.status(200).json();
  }

  public login: RequestHandler = async (req, res) => {
    const { email, password } = req.body;

    if (!email || !password) {
      throw new CustomError(404, 'No user found / Wrong credentials');
    }

    const logContext = `${this.logContext} -> login()`;

    const user = await this.userDataLayer.get({ email: email }, logContext, 'password email firstName lastName');

    const isPasswordValid = await bcryptjs.compare(password, user.password)
      .catch(err => {
        throw new CustomError(500, err.message, `${logContext} -> bcryptjs.compare() -> userId: ${user._id.toString()}`);
      });

    if (!isPasswordValid) {
      throw new CustomError(404, 'No user found / Wrong credentials');
    }

    const accessToken = this.tokenUtil.getAccessToken(user._id);
    const refreshToken = await this.tokenUtil.getRefreshToken(user._id, logContext);

    logger.info(`User logged in: ${user.email}`, logContext);

    res.header('Authorization-Access', accessToken);
    res.header('Authorization-Refresh', refreshToken);
    res.header('Access-Control-Expose-Headers', 'Authorization-Access, Authorization-Refresh');

    res.status(200).json();
  }

  public register: RequestHandler = async (req, res) => {
    const { email, password, firstName, lastName } = req.body;

    if (!email || !password || !firstName || !lastName) {
      throw new CustomError(400, 'Missing fields: email | password | firstName | lastName');
    }

    const logContext = `${this.logContext} -> register()`;

    // Basic email validation
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      throw new CustomError(400, 'Invalid email format');
    }

    const createUser: Partial<IUser> = {
      email,
      password,
      firstName,
      lastName,
    };

    const user = await this.userDataLayer.create(createUser, logContext);

    logger.info(`New user registered: ${user.email}`, logContext);

    // Send welcome email (optional)
    try {
      const emailData = {
        toEmail: user.email,
        subject: 'Welcome to GotovDoc',
        template: 'welcome',
        payload: {
          email: user.email,
          firstName: user.firstName,
          lastName: user.lastName,
        },
      };

      await this.emailUtil.sendEmail(emailData, EmailType.Info, logContext);
    } catch (error: any) {
      // Don't fail registration if email fails
      logger.error(`Failed to send welcome email: ${error.message}`, logContext);
    }

    res.status(200).json();
  }

  public changePassword: RequestHandler = async (req, res) => {
    const user = req.user;
    const { oldPassword, newPassword } = req.body;

    if (!oldPassword || !newPassword) {
      throw new CustomError(400, 'Missing fields: oldPassword | newPassword');
    }

    const logContext = `${this.logContext} -> changePassword()`;

    const isOldPasswordValid = await bcryptjs.compare(oldPassword, user.password)
      .catch(err => {
        throw new CustomError(500, err.message, `${logContext} -> isOldPasswordValid -> bcryptjs.compare() -> userId: ${user._id.toString()}`);
      });

    if (!isOldPasswordValid) {
      throw new CustomError(400, 'Invalid old password');
    }

    await this.userDataLayer.updatePassword(user, newPassword, logContext);

    logger.info(`Password changed for user: ${user.email}`, logContext);

    // Send password change notification email (optional)
    try {
      const emailData = {
        toEmail: user.email,
        subject: 'GotovDoc Password Changed',
        template: 'change-password',
        payload: {
          email: user.email,
          firstName: user.firstName,
          lastName: user.lastName,
        },
      };

      await this.emailUtil.sendEmail(emailData, EmailType.Info, logContext);
    } catch (error: any) {
      logger.error(`Failed to send password change email: ${error.message}`, logContext);
    }

    res.status(200).json();
  }

  public forgottenPassword: RequestHandler = async (req, res) => {
    const email = req.body.email;

    if (!email) {
      throw new CustomError(400, 'Email required');
    }

    const logContext = `${this.logContext} -> forgottenPassword()`;

    const user = await this.userDataLayer.get({ email: email }, logContext);

    // Generate a password reset token (valid for 1 hour)
    const token = this.tokenUtil.getAccessToken(user._id);

    const resetPasswordLink = `${this.config.frontendUrl}/reset-password?token=${token}`;

    logger.info(`Password reset requested for user: ${user.email}`, logContext);

    const emailData = {
      toEmail: user.email,
      subject: 'GotovDoc Password Reset Request',
      template: 'reset-password-request',
      payload: {
        email: user.email,
        firstName: user.firstName,
        lastName: user.lastName,
        resetPasswordLink,
      },
    };

    await this.emailUtil.sendEmail(emailData, EmailType.Info, logContext);

    res.status(200).json();
  }

  public resetPassword: RequestHandler = async (req, res) => {
    const { token, password } = req.body;

    if (!token || !password) {
      throw new CustomError(400, 'Missing fields: token | password');
    }

    const logContext = `${this.logContext} -> resetPassword()`;

    // Extract token from "Bearer <token>" format
    const tokenValue = token.includes(' ') ? token.split(' ')[1] : token;

    let userId;
    try {
      userId = this.tokenUtil.getUserIdFromAccessToken(tokenValue);
    } catch (error) {
      throw new CustomError(400, 'Invalid or expired reset token');
    }

    if (!mongoose.isValidObjectId(userId)) {
      throw new CustomError(404, 'No user found');
    }

    const user = await this.userDataLayer.getById(userId, logContext);

    await this.userDataLayer.updatePassword(user, password, logContext);

    logger.info(`Password reset completed for user: ${user.email}`, logContext);

    // Send password reset confirmation email (optional)
    try {
      const emailData = {
        toEmail: user.email,
        subject: 'GotovDoc Password Reset Successful',
        template: 'reset-password-success',
        payload: {
          email: user.email,
          firstName: user.firstName,
          lastName: user.lastName,
        },
      };

      await this.emailUtil.sendEmail(emailData, EmailType.Info, logContext);
    } catch (error: any) {
      logger.error(`Failed to send password reset success email: ${error.message}`, logContext);
    }

    res.status(200).json();
  }

}

