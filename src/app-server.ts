import logger from '@ipi-soft/logger';
import cors from 'cors';
import express from 'express';
import { json } from 'body-parser';
import { IncomingMessage, ServerResponse } from 'http';

import MainRouter from './routes/main.router';

import ErrorMiddleware from './middlewares/error.midleware';

import Config from './config';

export default class AppServer {

 constructor() {
  this.init();
 }

 private config = Config.getInstance();

 private async init(): Promise<void> {
  const app = express();

  const allowedOrigins = [
   this.config.frontendUrl,
   'http://gotovdoc.bg',
   ...(process.env.CORS_ADDITIONAL_ORIGINS ? process.env.CORS_ADDITIONAL_ORIGINS.split(',').map(origin => origin.trim()).filter(Boolean) : [])
  ];

  app.use(cors({
   origin: (origin, callback) => {
    if (!origin || allowedOrigins.includes(origin)) {
     return callback(null, true);
    }

    logger.error(origin || 'Unknown Origin', 'Blocked CORS origin');
    return callback(new Error('Not allowed by CORS'));
   },
   credentials: true,
   optionsSuccessStatus: 204
  }));

  app.use(json({
   limit: '300mb',
   verify: (req: IncomingMessage, res: ServerResponse, buffer: Buffer) => {
    // Store raw body for Stripe webhook signature verification
    if (req.url?.startsWith('/api/stripe/webhook')) {
     (req as any).rawBody = buffer.toString();
    }
   },
  }));

  app.use(MainRouter);

  app.use(new ErrorMiddleware().init);

  const workerId = process.env.WORKER_ID || `worker-${Math.floor(Math.random() * 10000)}`;

  app.listen(this.config.server.port, () => {
   logger.info(`${workerId} Server Started - Listening on http://${this.config.server.hostname}:${this.config.server.port} (env: ${this.config.env})`);
  });
 }

}
