
import logger from '@ipi-soft/logger';

import LoggerSetup from './logger-setup';

import ConnectionManager from './connection-manager';
import Config from './config';

import AppServer from './app-server';
import AppProcesses from './app-processes';

(async () => {
  try {
    new LoggerSetup();

    // Log myPOS configuration on startup
    Config.getInstance().logMyPosConfig();

    await ConnectionManager.getInstance().initConnections();

    new AppServer();
    new AppProcesses();
  } catch (err: any) {
    logger.error(err, 'App Init Error');
  }
})();
