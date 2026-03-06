import LoggerSetup from './../logger-setup';
import logger from '@ipi-soft/logger';

import ConnectionManager from './../connection-manager';
import BrowserService from './services/browser.service';
import SessionService from './services/session.service';
import IgBotConfig from './config';

const sessionService = SessionService.getInstance();
const browserService = BrowserService.getInstance();

async function shutdown(): Promise<void> {
 logger.info('Shutting down Instagram Bot...');
 sessionService.stop();
 await browserService.close();
 process.exit(0);
}

process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);

(async () => {
 try {
  new LoggerSetup();

  const config = IgBotConfig.getInstance();

  if (!config.username || !config.password) {
   logger.error('IG_BOT_USERNAME and IG_BOT_PASSWORD must be set in .env', 'IG Bot Init');
   process.exit(1);
  }

  if (config.targets.length === 0) {
   logger.error('IG_BOT_TARGETS must be set in .env (comma-separated profile usernames to scrape)', 'IG Bot Init');
   process.exit(1);
  }

  logger.info(`Instagram Bot starting for @${config.username}`);
  logger.info(`Targets: ${config.targets.join(', ')}`);
  logger.info(`Session duration: ${config.sessionHours} hours`);

  await ConnectionManager.getInstance().initConnections();

  await sessionService.run();

  logger.info('Instagram Bot finished');
  process.exit(0);

 } catch (err: any) {
  logger.error(err, 'Instagram Bot Init Error');
  process.exit(1);
 }
})();
