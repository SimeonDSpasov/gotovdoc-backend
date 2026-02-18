
import logger from '@ipi-soft/logger';

import LoggerSetup from './logger-setup';

import ConnectionManager from './connection-manager';

import AppServer from './app-server';
import AppProcesses from './app-processes';
import { registerOrderCleanupCron } from './cronjobs/order-cleanup.cron';
import EuipoService from './services/euipo.service';

(async () => {
  try {
    new LoggerSetup();

    await ConnectionManager.getInstance().initConnections();

    if (!process.env.WORKER_ID) {
      process.env.WORKER_ID = `worker-${Math.floor(Math.random() * 10000)}`;
    }

    if (process.env.WORKER_ID === 'worker-1') {
      registerOrderCleanupCron();

      // Only worker-1 syncs with EUIPO; all workers read from DB
      EuipoService.getInstance().startSync();
    }
    
    new AppServer();
    new AppProcesses();
  } catch (err: any) {
    logger.error(err, 'App Init Error');
  }
})();
