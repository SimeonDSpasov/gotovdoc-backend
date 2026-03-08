import LoggerSetup from './../logger-setup';
import logger from '@ipi-soft/logger';

import ConnectionManager from './../connection-manager';
import BrowserService from './services/browser.service';
import AuthService from './services/auth.service';
import SessionService from './services/session.service';
import ActionService from './services/action.service';
import DiscoveryService from './services/discovery.service';
import FilterService from './services/filter.service';
import SafetyService from './services/safety.service';
import IgBotConfig from './config';
import { randomDelay, randomInt } from './helpers';

let shuttingDown = false;

async function shutdown(): Promise<void> {
 if (shuttingDown) return;
 shuttingDown = true;
 logger.info('Shutting down Instagram Bot...');
 try {
  SessionService.getInstance().stop();
  await BrowserService.getInstance().close();
 } catch {}
 process.exit(0);
}

process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);

function resetAllSingletons(): void {
 BrowserService.reset();
 AuthService.reset();
 SessionService.reset();
 ActionService.reset();
 DiscoveryService.reset();
 FilterService.reset();
 SafetyService.reset();
}

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

  await ConnectionManager.getInstance().initConnections();

  logger.info(`Instagram Bot starting for @${config.username}`);
  logger.info(`Targets: ${config.targets.join(', ')}`);
  logger.info(`Session duration: ${config.sessionHours} hours`);

  let consecutiveFailures = 0;
  const BACKOFF_STEPS = [60_000, 120_000, 300_000, 900_000]; // 1m, 2m, 5m, 15m

  // Auto-restart loop — keeps running until SIGINT/SIGTERM
  while (!shuttingDown) {
   try {
    resetAllSingletons();

    const sessionService = SessionService.getInstance();
    await sessionService.run();

    // Session ended normally — reset failure counter
    consecutiveFailures = 0;

    // Wait before starting next session
    const cooldownMs = randomInt(5 * 60_000, 10 * 60_000);
    const cooldownMin = Math.round(cooldownMs / 60_000);
    logger.info(`Session complete — restarting in ${cooldownMin} minutes...`);
    await randomDelay(cooldownMs, cooldownMs + 60_000);

   } catch (err: any) {
    consecutiveFailures++;
    const backoffMs = BACKOFF_STEPS[Math.min(consecutiveFailures - 1, BACKOFF_STEPS.length - 1)];
    const backoffMin = Math.round(backoffMs / 60_000);

    logger.error(`Session crashed (attempt ${consecutiveFailures}): ${err.message}`, 'IG Bot');
    logger.info(`Retrying in ${backoffMin} minutes...`);

    // Make sure browser is closed before retry
    try { await BrowserService.getInstance().close(); } catch {}

    await randomDelay(backoffMs, backoffMs + 30_000);
   }
  }

 } catch (err: any) {
  logger.error(err, 'Instagram Bot Init Error');
  process.exit(1);
 }
})();
