import fs from 'fs';
import path from 'path';
import nodemailer from 'nodemailer';

import handlebars from 'handlebars';

import ErrorUtil from './../utils/error.util';

import Config from './../config';
import CustomError from './custom-error.utils';

export enum EmailType {
  Info,
  Support,
}

interface EmailData {
  toEmail: string;
  subject: string;
  template: string;
  payload: any;
}

export class EmailUtil {

  private logContext = 'Email Util';

  private config = Config.getInstance();

  private transporter = nodemailer.createTransport({
    host: 'iron.superhosting.bg',
    port: 465, // SSL/TLS
    secure: true, // true за порт 465
    auth: {
      user: 'info@gotovdoc.bg',
      pass: this.config.emailPassword, // паролата от cPanel
    },
  });

  public async sendEmail(data: EmailData, type: EmailType, logContext: string): Promise<void> {

    const accountEmail = type === EmailType.Info ? this.config.infoAccountEmail : this.config.supportAccountEmail;

    logContext = `${this.logContext} -> ${logContext}`;

    // Use path relative to project root to work in both dev and production
    const templatesPath = path.join(__dirname, '../../src/email-templates');
    
    const main = fs.readFileSync(path.join(templatesPath, 'main.handlebars'), 'utf8');
    const partial = fs.readFileSync(path.join(templatesPath, data.template + '.handlebars'), 'utf8');

    handlebars.registerPartial('partial', partial);

    const compiledTemplate = handlebars.compile(main);

    await this.transporter.sendMail({
      from: `ГОТОВДОК ${accountEmail}`,
      to: data.toEmail,
      subject: data.subject,
      html: compiledTemplate(data.payload),
    }).catch((err: Error) => {
      throw new CustomError(500, err.message, `${logContext}`, false);
    });
  }

  private static instance: EmailUtil;

  public static getInstance(): EmailUtil {
    if (!EmailUtil.instance) {
      EmailUtil.instance = new EmailUtil();
    }

    return EmailUtil.instance;
  }

}
