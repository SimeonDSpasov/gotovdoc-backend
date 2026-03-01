
import logger from '@ipi-soft/logger';

import LoggerSetup from './logger-setup';

import ConnectionManager from './connection-manager';

import AppServer from './app-server';
import AppProcesses from './app-processes';
import { registerOrderCleanupCron } from './cronjobs/order-cleanup.cron';
import { registerEuipoSyncCron } from './cronjobs/euipo-sync.cron';
import { registerNkpdRefreshCron } from './cronjobs/nkpd-refresh.cron';
import { seedBulgarianCities } from './data/bulgarian-cities-seed';
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
   registerEuipoSyncCron();
   registerNkpdRefreshCron();
  }
  
  // Pre-fetch Bulgarian cities data into memory cache
  seedBulgarianCities();

  new AppServer();
  new AppProcesses();
 } catch (err: any) {
  logger.error(err, 'App Init Error');
 }
})();
