import LoggerSetup from './logger-setup';
import logger from '@ipi-soft/logger';

import ConnectionManager from './connection-manager';
import { registerOrderCleanupCron } from './cronjobs/order-cleanup.cron';

(async () => {
 try {
  new LoggerSetup();

  await ConnectionManager.getInstance().initConnections();

  registerOrderCleanupCron();
 } catch (err: any) {
  logger.error(err, 'Worker Init Error');
 }
})();
