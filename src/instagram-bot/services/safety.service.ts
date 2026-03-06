import logger from '@ipi-soft/logger';
import { Page } from 'playwright';

import IgBotConfig from './../config';
import IgAccountDataLayer from './../data-layers/ig-account.data-layer';
import IgActionLogDataLayer from './../data-layers/ig-action-log.data-layer';
import { randomInt } from './../helpers';

export default class SafetyService {

 private logContext = 'Safety Service';
 private config = IgBotConfig.getInstance();
 private accountDataLayer = IgAccountDataLayer.getInstance();
 private actionLogDataLayer = IgActionLogDataLayer.getInstance();

 // Cache today's randomized limits so they stay consistent within a session
 private cachedDailyLimits: { follow: number; like: number } | null = null;

 /**
 * Check if an action is allowed based on daily limits and warmup.
 */
 public async canPerformAction(accountUsername: string, actionType: 'follow' | 'like'): Promise<{ allowed: boolean; reason?: string }> {
  const logContext = `${this.logContext} -> canPerformAction()`;

  const counts = await this.actionLogDataLayer.getTodayCounts(accountUsername);
  const limits = await this.getDailyLimits(accountUsername);

  if (actionType === 'follow' && counts.follows >= limits.follow) {
   return { allowed: false, reason: `Follow limit reached (${counts.follows}/${limits.follow})` };
  }

  if (actionType === 'like' && counts.likes >= limits.like) {
   return { allowed: false, reason: `Like limit reached (${counts.likes}/${limits.like})` };
  }

  return { allowed: true };
 }

 /**
 * Determine if we should take a long break.
 */
 public shouldTakeBreak(actionsInBatch: number): { shouldBreak: boolean; breakMs: number } {
  const batchLimit = randomInt(this.config.batchSize.min, this.config.batchSize.max);

  if (actionsInBatch >= batchLimit) {
   const breakMs = randomInt(this.config.delays.batchBreak.min, this.config.delays.batchBreak.max);
   return { shouldBreak: true, breakMs };
  }

  return { shouldBreak: false, breakMs: 0 };
 }

 /**
 * Get daily limits adjusted by warmup tier.
 */
 public async getDailyLimits(accountUsername: string): Promise<{ follow: number; like: number }> {
  if (this.cachedDailyLimits) return this.cachedDailyLimits;

  const account = await this.accountDataLayer.get(accountUsername);
  const warmupDays = account?.warmupDays || 0;
  const tier = this.config.getTier(warmupDays);
  const tierLimits = this.config.limits[tier];

  this.cachedDailyLimits = {
   follow: randomInt(tierLimits.follow.min, tierLimits.follow.max),
   like: randomInt(tierLimits.like.min, tierLimits.like.max),
  };

  logger.info(`[${this.logContext}] Daily limits for tier ${tier} (day ${warmupDays}): follow=${this.cachedDailyLimits.follow}, like=${this.cachedDailyLimits.like}`);

  return this.cachedDailyLimits;
 }

 /**
 * Check page for ban/block signals.
 */
 public async detectBanSignal(page: Page): Promise<{ banned: boolean; signal?: string }> {
  const url = page.url();

  if (url.includes('/challenge/')) {
   return { banned: true, signal: 'Challenge page detected' };
  }

  if (url.includes('/accounts/suspended/')) {
   return { banned: true, signal: 'Account suspended' };
  }

  // Action block dialog
  const actionBlock = await page.locator('text=Action Blocked').first()
   .isVisible({ timeout: 1000 }).catch(() => false);
  if (actionBlock) {
   return { banned: true, signal: 'Action blocked dialog' };
  }

  const tryAgain = await page.locator('text=Try Again Later').first()
   .isVisible({ timeout: 1000 }).catch(() => false);
  if (tryAgain) {
   return { banned: true, signal: 'Try Again Later dialog' };
  }

  return { banned: false };
 }

 /**
 * Handle a detected ban signal.
 */
 public async handleBanSignal(accountUsername: string, signal: string): Promise<void> {
  const logContext = `${this.logContext} -> handleBanSignal()`;
  logger.error(`BAN SIGNAL for @${accountUsername}: ${signal}`, logContext);
  await this.accountDataLayer.updateStatus(accountUsername, 'challenge');
 }

 /**
 * Reset cached limits (call at start of each session).
 */
 public resetCachedLimits(): void {
  this.cachedDailyLimits = null;
 }

 private static instance: SafetyService;

 public static getInstance(): SafetyService {
  if (!SafetyService.instance) {
   SafetyService.instance = new SafetyService();
  }
  return SafetyService.instance;
 }

}
