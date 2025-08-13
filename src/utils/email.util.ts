import fs from 'fs';
import path from 'path';
import { MailtrapClient } from 'mailtrap';

import handlebars from 'handlebars';

import ErrorUtil from './../utils/error.util';

import Config from './../config';

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

  private client = new MailtrapClient({ token: this.config.emailKey });

  private sender = { name: "Mailtrap Test", email: 'info@cyberninjas.app' };


  public async sendEmail(data: EmailData, type: EmailType, logContext: string): Promise<void> {

    const accountEmail = type === EmailType.Info ? this.config.infoAccountEmail : this.config.supportAccountEmail;

    logContext = `${this.logContext} -> ${logContext}`;


    const main = fs.readFileSync(path.join(__dirname, './../email-templates/main.handlebars'), 'utf8');
    const partial = fs.readFileSync(path.join(__dirname, './../email-templates', data.template + '.handlebars'), 'utf8');

    handlebars.registerPartial('partial', partial);

    const compiledTemplate = handlebars.compile(main);

    const logoPath = path.join(__dirname, './../assets/img/logo.ico');
    const logoImage = fs.readFileSync(logoPath);

    const twitterPath = path.join(__dirname, './../assets/img/twitter.png');
    const twitterImage = fs.readFileSync(twitterPath);

    const discordPath = path.join(__dirname, './../assets/img/discord.png');
    const discordImage = fs.readFileSync(discordPath);

    await this.client
      .send({
      from: { name: 'Gotovdoc', email: accountEmail },
      to: [{ email: data.toEmail }],
      subject: data.subject,
      html: compiledTemplate(data.payload),
      attachments: [
        {
          filename: 'logo.png',
          disposition: "inline",
          content: logoImage,
          content_id: 'logo',
        },
        {
          filename: 'twitter.png',
          disposition: "inline",
          content: twitterImage,
          content_id: 'twitter',
        },
        {
          filename: 'discord.png',
          disposition: "inline",
          content: discordImage,
          content_id: 'discord',
        },

      ],
      })
    .then()
    .catch((err) => { logger.error(err.message, this.logContext, false) });

  }

  private static instance: EmailUtil;

  public static getInstance(): EmailUtil {
    if (!EmailUtil.instance) {
      EmailUtil.instance = new EmailUtil();
    }

    return EmailUtil.instance;
  }

}
