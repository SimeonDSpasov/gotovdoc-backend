import logger from '@ipi-soft/logger';

import IgBotConfig from './../config';
import BrowserService from './browser.service';
import AuthService from './auth.service';
import ActionService from './action.service';
import DiscoveryService from './discovery.service';
import FilterService from './filter.service';
import SafetyService from './safety.service';
import IgTargetDataLayer from './../data-layers/ig-target.data-layer';
import IgFollowDataLayer from './../data-layers/ig-follow.data-layer';
import IgActionLogDataLayer from './../data-layers/ig-action-log.data-layer';
import IgAccountDataLayer from './../data-layers/ig-account.data-layer';
import { randomDelay, randomInt } from './../helpers';

export default class SessionService {

 private logContext = 'Session Service';
 private config = IgBotConfig.getInstance();
 private browserService = BrowserService.getInstance();
 private authService = AuthService.getInstance();
 private actionService = ActionService.getInstance();
 private discoveryService = DiscoveryService.getInstance();
 private filterService = FilterService.getInstance();
 private safetyService = SafetyService.getInstance();
 private targetDataLayer = IgTargetDataLayer.getInstance();
 private followDataLayer = IgFollowDataLayer.getInstance();
 private actionLogDataLayer = IgActionLogDataLayer.getInstance();
 private accountDataLayer = IgAccountDataLayer.getInstance();

 private sessionStartTime: Date = new Date();
 private running = false;

 /**
 * Run the main session loop.
 */
 public async run(): Promise<void> {
  const logContext = `${this.logContext} -> run()`;
  this.running = true;
  this.sessionStartTime = new Date();
  this.safetyService.resetCachedLimits();

  const sessionEndTime = new Date(this.sessionStartTime.getTime() + this.config.sessionHours * 60 * 60 * 1000);

  logger.info(`[${logContext}] === Session started — will run until ${sessionEndTime.toLocaleTimeString()} (${this.config.sessionHours}h) ===`);

  try {
   // 1. Launch browser and login
   await this.browserService.launch(this.config.username);
   const loggedIn = await this.authService.ensureLoggedIn();

   if (!loggedIn) {
    logger.error('Failed to login — aborting session', logContext);
    await this.browserService.close();
    return;
   }

   // 1b. Increment warmup day if this is a new calendar day
   const account = await this.accountDataLayer.get(this.config.username);
   const lastAction = account?.lastActionAt;
   const today = new Date().toDateString();

   if (!lastAction || new Date(lastAction).toDateString() !== today) {
    await this.accountDataLayer.incrementWarmup(this.config.username);
    logger.info(`[${logContext}] Warmup day incremented to ${(account?.warmupDays || 0) + 1}`);
   }

   await this.accountDataLayer.updateLastAction(this.config.username);

   // 2. Check for existing pending targets before running discovery
   const existingPending = await this.targetDataLayer.countPending(this.config.username);
   if (existingPending > 0) {
    logger.info(`[${logContext}] Found ${existingPending} pending targets in DB — processing them first`);
   } else {
    await this.runDiscovery();
   }

   // 3. Main action loop
   let actionsInBatch = 0;
   let lastUnfollowCycle = Date.now();

   while (this.running && new Date() < sessionEndTime) {
    // Check if it's time for an unfollow cycle (every 30-60 min)
    const unfollowInterval = randomInt(30, 60) * 60 * 1000;
    if (Date.now() - lastUnfollowCycle > unfollowInterval) {
     await this.runUnfollowCycle();
     lastUnfollowCycle = Date.now();
    }

    // Pop a target from the queue
    const targets = await this.targetDataLayer.popNextBatch(this.config.username, 1);
    if (targets.length === 0) {
     logger.info(`[${logContext}] Target queue empty — running discovery...`);
     await this.runDiscovery();
     const newTargets = await this.targetDataLayer.popNextBatch(this.config.username, 1);
     if (newTargets.length === 0) {
      logger.info(`[${logContext}] No targets available — ending session`);
      break;
     }
     targets.push(...newTargets);
    }

    const target = targets[0];

    // Evaluate the target (visit profile + filter)
    const page = this.browserService.getPage();
    const filterResult = await this.filterService.evaluateTarget(page, target.targetUsername);

    if (!filterResult.pass) {
     await this.targetDataLayer.markFiltered(this.config.username, target.targetUsername, filterResult.stats);
     logger.info(`[${logContext}] Filtered @${target.targetUsername}: ${filterResult.reason}`);
     await randomDelay(2000, 5000);
     continue;
    }

    // Update target with quality score and stats
    await this.targetDataLayer.markProcessed(this.config.username, target.targetUsername, filterResult.score, filterResult.stats);

    // Core growth loop: follow + like
    const actionRoll = Math.random();

    if (actionRoll < 0.70) {
     // 70%: Profile view → Follow → Like 1-2 posts
     await this.coreGrowthAction(target.targetUsername, target.source || '');
     actionsInBatch += 2; // follow + like count as 2
    } else if (actionRoll < 0.85) {
     // 15%: View story if available
     await this.actionService.viewStory(target.targetUsername);
     actionsInBatch += 1;
    } else {
     // 15%: Just view profile + like (no follow)
     const likesCount = randomInt(1, 2);
     await this.actionService.likeLatestPosts(target.targetUsername, likesCount);
     actionsInBatch += 1;
    }

    // Log running totals after each action cycle
    const runningCounts = await this.actionLogDataLayer.getTodayCounts(this.config.username);
    logger.info(`[${logContext}] [STATS] Follows: ${runningCounts.follows} | Likes: ${runningCounts.likes} | Unfollows: ${runningCounts.unfollows} | Profile views: ${runningCounts.profileViews}`);

    // Post-action delay
    await randomDelay(this.config.delays.betweenActions.min, this.config.delays.betweenActions.max);

    // Check if we need a batch break
    const breakCheck = this.safetyService.shouldTakeBreak(actionsInBatch);
    if (breakCheck.shouldBreak) {
     const breakMin = Math.round(breakCheck.breakMs / 60000);
     logger.info(`[${logContext}] Taking a ${breakMin} min break after ${actionsInBatch} actions...`);

     // Save session during break
     await this.browserService.savePersistence();

     await randomDelay(breakCheck.breakMs, breakCheck.breakMs + 60000);
     actionsInBatch = 0;

     // Log progress
     const counts = await this.actionLogDataLayer.getTodayCounts(this.config.username);
     logger.info(`[${logContext}] Today's stats: ${counts.follows} follows, ${counts.likes} likes, ${counts.profileViews} profile views`);
    }

    // Check daily limits
    const canFollow = await this.safetyService.canPerformAction(this.config.username, 'follow');
    const canLike = await this.safetyService.canPerformAction(this.config.username, 'like');

    if (!canFollow.allowed && !canLike.allowed) {
     logger.info(`[${logContext}] All daily limits reached — ending session`);
     break;
    }
   }

  } catch (err: any) {
   logger.error(`Session error: ${err.message}`, logContext);
  } finally {
   // Final stats
   const counts = await this.actionLogDataLayer.getTodayCounts(this.config.username);
   logger.info(`[${logContext}] === Session ended — ${counts.follows} follows, ${counts.likes} likes, ${counts.unfollows} unfollows, ${counts.profileViews} profile views ===`);

   await this.browserService.close();
  }
 }

 /**
 * Core growth action: view profile → follow → like 1-2 posts.
 */
 private async coreGrowthAction(targetUsername: string, source: string): Promise<void> {
  // View profile first (scroll around like a real person)
  await this.actionService.viewProfile(targetUsername);
  await randomDelay(1500, 4000);

  // Follow
  const followed = await this.actionService.followUser(targetUsername, source);

  if (followed) {
   // Small delay then like posts
   await randomDelay(2000, 5000);

   const likesCount = randomInt(1, 2);
   await this.actionService.likeLatestPosts(targetUsername, likesCount);
  }
 }

 /**
 * Run discovery from all configured target profiles.
 */
 private async runDiscovery(): Promise<void> {
  const logContext = `${this.logContext} -> runDiscovery()`;
  const pendingCount = await this.targetDataLayer.countPending(this.config.username);

  if (pendingCount >= this.config.discovery.minTargetQueue) {
   logger.info(`[${logContext}] Target queue has ${pendingCount} targets — skipping discovery`);
   return;
  }

  logger.info(`[${logContext}] Target queue low (${pendingCount}) — running discovery...`);

  for (const sourceProfile of this.config.targets) {
   if (!this.running) break;
   await this.discoveryService.discoverFromProfile(sourceProfile);
   await randomDelay(5000, 15000);
  }
 }

 /**
 * Unfollow users who didn't follow back after the waiting period.
 */
 private async runUnfollowCycle(): Promise<void> {
  const logContext = `${this.logContext} -> runUnfollowCycle()`;

  const pendingUnfollows = await this.followDataLayer.getPendingUnfollows(this.config.username, 10);

  if (pendingUnfollows.length === 0) {
   logger.info(`[${logContext}] No pending unfollows`);
   return;
  }

  logger.info(`[${logContext}] Unfollowing ${pendingUnfollows.length} non-reciprocal follows...`);

  let unfollowedCount = 0;

  for (const follow of pendingUnfollows) {
   if (!this.running) break;

   const success = await this.actionService.unfollowUser(follow.targetUsername);
   if (success) unfollowedCount++;
   await randomDelay(this.config.delays.betweenActions.min, this.config.delays.betweenActions.max);
  }

  logger.info(`[${logContext}] [UNFOLLOW CYCLE] Unfollowed ${unfollowedCount}/${pendingUnfollows.length} users`);
 }

 /**
 * Gracefully stop the session.
 */
 public stop(): void {
  this.running = false;
  logger.info(`[${this.logContext}] Session stop requested...`);
 }

 private static instance: SessionService;

 public static getInstance(): SessionService {
  if (!SessionService.instance) {
   SessionService.instance = new SessionService();
  }
  return SessionService.instance;
 }

}
