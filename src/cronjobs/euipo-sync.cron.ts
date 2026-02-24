import cron from 'node-cron';
import logger from '@ipi-soft/logger';

import EuipoService from './../services/euipo.service';

export function registerEuipoSyncCron(): void {
 const euipoService = EuipoService.getInstance();

 // Every Sunday at 2 AM
 cron.schedule('0 2 * * 0', () => {
  const logContext = 'Cronjob -> EUIPO Sync';

  return euipoService
   .syncAllClasses()
   .then(() => logger.info('EUIPO sync completed'))
   .catch((err: any) => {
    logger.error(err?.message || err, logContext);
   });
 });
}
