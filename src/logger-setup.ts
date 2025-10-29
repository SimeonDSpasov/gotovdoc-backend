import logger from '@ipi-soft/logger';

import { EmailUtil, EmailType } from './utils/email.util';

import Config from './config';

export default class LoggerSetup {

  constructor() {
    this.init();
  }

  private config = Config.getInstance();
  private emailUtil = EmailUtil.getInstance();

  private async init(): Promise<void> {
    this.setEmailFunction();

    process.on('unhandledRejection', (reason: string) => {
        this.unhandledErrors(reason);
    });

    process.on('uncaughtException', (error: Error) => {
      this.unhandledErrors(JSON.stringify(error));
    });
  }

  private setEmailFunction(): void {
    // logger.emailFunction = (where: string, message: string) => {

    //   if (this.config.env === 'dev') {
    //     return;
    //   }

    //   const emailData = {
    //     toEmail: this.config.devEmail,
    //     subject: `Kind Skiptracing ${this.config.env.toUpperCase()} Error`,
    //     template: 'error',
    //     payload: {
    //       where,
    //       message,
    //     },
    //   };

    //   this.emailUtil.sendEmail(emailData, EmailType.Info, '')
    //     .catch(err => console.dir(err, { depth: 10 }));

    // }
  }

  private async unhandledErrors(message: string): Promise<void> {
    // if (this.config.env === 'dev') {
    //   return;
    // }

    // const emailData = {
    //   toEmail: this.config.devEmail,
    //   subject: `Kind Skiptracing ${this.config.env.toUpperCase()} Error`,
    //   template: 'error',
    //   payload: {
    //     where: 'unhandledErrors',
    //     message,
    //   },
    // };
  
    // await this.emailUtil.sendEmail(emailData, EmailType.Info, '')
    //   .catch(err => console.dir(err, { depth: 10 }));
  
    // process.exit();
  }

}
