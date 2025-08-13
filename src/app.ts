import cors from 'cors';
import express from 'express';
import mongoose from 'mongoose';
import { json } from 'body-parser';
import logger from '@ipi-soft/logger';
import { IncomingMessage, ServerResponse } from 'http';

import Config from './config';
import MainRouter from './routes/main.router';
import ErrorMiddleware from './middlewares/error.middleware';

// Unhandled Errors
process.on('unhandledRejection', (reason: string) => {
  unhandledErrors(reason);
});

process.on('uncaughtException', (error: Error) => {
  unhandledErrors(JSON.stringify(error));
});

async function unhandledErrors(message: string): Promise<void> {
//   const emailData = {
//     toEmail: config.devEmail,
//     subject: `Kind Skiptracing ${config.env.toUpperCase()} Error`,
//     template: 'error',
//     payload: {
//       where: 'unhandledErrors',
//       message,
//     },
//   };

//   await emailUtil.sendEmail(emailData, EmailType.Info, '')
//     .catch(err => console.dir(err, { depth: 10 }));

//   process.exit();
}
// End Unhandled Errors

// Server
const app = express();
const config = Config.getInstance();

app.use(cors());
app.use(json({
  limit: '300mb',
  verify: (req: IncomingMessage, res: ServerResponse, buffer: Buffer) => {
    if (req.url && (req.url.startsWith('/api/stripe/webhook'))) {
      (<any>req).rawBody = buffer.toString();
    }
  }
}));

app.use(MainRouter);
app.use(new ErrorMiddleware().init);

app.listen(3000, () => {
  logger.info('Server Started');
});

async function initProcesses(): Promise<void> {
  // Initialize the stress tester
  // await cofansStressTester.initialize();

  // Example stress test (commented out by default)
  // await cofansStressTester.runStressTest('7261210975', 'WEIDIAN', 100);
}
// End Processes
