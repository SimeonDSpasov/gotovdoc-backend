import cron from 'node-cron';
import logger from '@ipi-soft/logger';

import NkpdDataLayer from './../data-layers/nkpd.data-layer';

const EXPECTED_MIN_COUNT = 500;

export function registerNkpdRefreshCron(): void {
 const nkpdDataLayer = NkpdDataLayer.getInstance();

 // 1st of every month at 4 AM
 cron.schedule('0 4 1 * *', () => {
  const logContext = 'Cronjob -> NKPD Refresh';

  return nkpdDataLayer
   .count(logContext)
   .then(count => {
    if (count >= EXPECTED_MIN_COUNT) {
     logger.info(`NKPD data OK: ${count} occupations in collection`, logContext);
    } else {
     logger.error(`NKPD data LOW: only ${count} occupations (expected ${EXPECTED_MIN_COUNT}+). Run seed script: Project_ENV=prod npx ts-node src/scripts/parse-nkpd-pdf.ts <path-to-pdf>`, logContext);
    }
   })
   .catch((err: any) => {
    logger.error(err?.message || err, logContext);
   });
 });
}
