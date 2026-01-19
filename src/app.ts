
import logger from '@ipi-soft/logger';

import LoggerSetup from './logger-setup';

import ConnectionManager from './connection-manager';


import AppServer from './app-server';
import AppProcesses from './app-processes';
import { EmailUtil } from './utils/email.util';

(async () => {
  try {
    new LoggerSetup();

    await ConnectionManager.getInstance().initConnections();
    
    new AppServer();
    new AppProcesses();

    await EmailUtil.getInstance().verify();
  } catch (err: any) {
    logger.error(err, 'App Init Error');
  }
})();
