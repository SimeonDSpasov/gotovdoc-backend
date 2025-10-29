import { RequestHandler } from 'express';
import bcryptjs from 'bcryptjs';
import mongoose from 'mongoose';

import CustomError from '../utils/custom-error.utils';

// import TokenUtil from './../utils/token.util';

// import { EmailType, EmailUtil } from './../utils/email.util';

import { EmailType, EmailUtil } from './../utils/email.util';

import Config from './../config';

export default class EmailController {
  
  private logContext = 'Email Controller';
  
  private config = Config.getInstance();

  private emailUtil = EmailUtil.getInstance();

  public contactUs: RequestHandler = async (req, res) => {
    const { firstName, lastName, email, phoneNumber, message } = req.body

    if (!firstName || !lastName || !email || !phoneNumber || !message) {
      throw new CustomError(400, 'Missing fields: name | email | phoneNumber | message');
    }

    const logContext = `${this.logContext} -> contactUs()`;

    const emailData = {
      toEmail: this.config.infoAccountEmail,
      subject: 'Contact Us Request',
      template: 'contact-us',
      payload: {
        name: `${firstName} ${lastName}`,
        email: email,
        phoneNumber: phoneNumber,
        message: message,
      },
    };

    await this.emailUtil.sendEmail(emailData, EmailType.Info, logContext);

    res.status(200).json();
  }

}
