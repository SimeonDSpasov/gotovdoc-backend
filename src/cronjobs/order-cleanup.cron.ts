import cron from 'node-cron';
import logger from '@ipi-soft/logger';

import OrderDataLayer from './../data-layers/order.data-layer';

export function registerOrderCleanupCron(): void {
  const orderDataLayer = OrderDataLayer.getInstance();

  cron.schedule('0 3 * * 0', async () => {
    const logContext = 'Cronjob -> Cleanup Orders';

    try {
      const deletedCount = await orderDataLayer.deleteMany(
        { status: { $in: ['pending', 'cancelled'] } },
        logContext
      );

      logger.info(`Deleted ${deletedCount} pending/cancelled orders`, logContext);
    } catch (err: any) {
      logger.error(err?.message || err, logContext);
    }
  });
}
