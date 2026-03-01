import LoggerSetup from './logger-setup';
import logger from '@ipi-soft/logger';

import ConnectionManager from './connection-manager';
import { registerOrderCleanupCron } from './cronjobs/order-cleanup.cron';
import { registerNkpdRefreshCron } from './cronjobs/nkpd-refresh.cron';

(async () => {
 try {
  new LoggerSetup();

  await ConnectionManager.getInstance().initConnections();

  registerOrderCleanupCron();
  registerNkpdRefreshCron();
 } catch (err: any) {
  logger.error(err, 'Worker Init Error');
 }
})();
