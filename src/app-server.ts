import cors from 'cors';
import express from 'express';
import { json } from 'body-parser';
import { IncomingMessage, ServerResponse } from 'http';

import MainRouter from './routes/main.router';

import ErrorMiddleware from './middlewares/error.middleware';

import Config from './config';

export default class AppServer {

  constructor() {
    this.init();
  }

  private config = Config.getInstance();

  private async init(): Promise<void> {
    const app = express();

    app.use(cors());

    app.use(json({
      limit: '300mb',
    }));

    app.use(MainRouter);

    app.use(new ErrorMiddleware().init);

    app.listen(this.config.server.port, () => {
      logger.info('Server Started');
    });
  }

}
