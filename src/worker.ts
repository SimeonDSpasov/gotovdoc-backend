import LoggerSetup from './logger-setup';

import ConnectionManager from './connection-manager';

(async () => {
  try {
    new LoggerSetup();

    await ConnectionManager.getInstance().initConnections();

    // TODO: Add worker logic here
  } catch (err: any) {
    logger.error(err, 'Worker Init Error');
  }
})();
