import logger from '@ipi-soft/logger';
import { Page } from 'playwright';

import IgBotConfig from './../config';
import BrowserService from './browser.service';
import SafetyService from './safety.service';
import IgActionLogDataLayer from './../data-layers/ig-action-log.data-layer';
import IgFollowDataLayer from './../data-layers/ig-follow.data-layer';
import IgAccountDataLayer from './../data-layers/ig-account.data-layer';
import { randomDelay, randomInt } from './../helpers';

export default class ActionService {

 private logContext = 'Action Service';
 private config = IgBotConfig.getInstance();
 private browserService = BrowserService.getInstance();
 private safetyService = SafetyService.getInstance();
 private actionLogDataLayer = IgActionLogDataLayer.getInstance();
 private followDataLayer = IgFollowDataLayer.getInstance();
 private accountDataLayer = IgAccountDataLayer.getInstance();

 /**
 * View a user's profile (scroll around to look human).
 */
 public async viewProfile(targetUsername: string): Promise<boolean> {
  const logContext = `${this.logContext} -> viewProfile(${targetUsername})`;
  const page = this.browserService.getPage();

  try {
   await page.goto(`https://www.instagram.com/${targetUsername}/`, { waitUntil: 'domcontentloaded', timeout: 30000 });
   await randomDelay(this.config.delays.pageLoad.min, this.config.delays.pageLoad.max);

   // Check for ban signals
   const banCheck = await this.safetyService.detectBanSignal(page);
   if (banCheck.banned) {
    await this.safetyService.handleBanSignal(this.config.username, banCheck.signal!);
    return false;
   }

   // Scroll naturally through the profile
   await this.scrollNaturally(page);

   await this.actionLogDataLayer.logAction({
    accountUsername: this.config.username,
    action: 'profile_view',
    targetUsername,
   });

   await this.accountDataLayer.updateLastAction(this.config.username);
   return true;
  } catch (err: any) {
   logger.error(`viewProfile failed for @${targetUsername}: ${err.message}`, logContext);
   return false;
  }
 }

 /**
 * Follow a user. Returns true if successfully followed.
 */
 public async followUser(targetUsername: string, source: string): Promise<boolean> {
  const logContext = `${this.logContext} -> followUser(${targetUsername})`;
  const page = this.browserService.getPage();

  try {
   // Check if already following
   const alreadyFollowing = await this.followDataLayer.isAlreadyFollowing(this.config.username, targetUsername);
   if (alreadyFollowing) {
    logger.info(`[${logContext}] Already following @${targetUsername}, skipping`);
    return false;
   }

   // Check daily limit
   const canFollow = await this.safetyService.canPerformAction(this.config.username, 'follow');
   if (!canFollow.allowed) {
    logger.info(`[${logContext}] Cannot follow: ${canFollow.reason}`);
    return false;
   }

   // Make sure we're on the profile page
   if (!page.url().includes(`/${targetUsername}`)) {
    await page.goto(`https://www.instagram.com/${targetUsername}/`, { waitUntil: 'domcontentloaded', timeout: 30000 });
    await randomDelay(this.config.delays.pageLoad.min, this.config.delays.pageLoad.max);
   }

   // Check for ban signals
   const banCheck = await this.safetyService.detectBanSignal(page);
   if (banCheck.banned) {
    await this.safetyService.handleBanSignal(this.config.username, banCheck.signal!);
    return false;
   }

   // Scroll around the profile before acting
   await this.scrollBeforeAction(page);

   // Find the Follow button
   const followButton = page.locator('button:has-text("Follow")').first();
   const buttonText = await followButton.textContent().catch(() => '');

   if (!buttonText || buttonText.includes('Following') || buttonText.includes('Requested')) {
    logger.info(`[${logContext}] @${targetUsername} already followed or requested`);
    return false;
   }

   await followButton.click();
   await randomDelay(3000, 5000);

   // Check for ban/block after clicking
   const banCheck2 = await this.safetyService.detectBanSignal(page);
   if (banCheck2.banned) {
    await this.safetyService.handleBanSignal(this.config.username, banCheck2.signal!);
    return false;
   }

   // Follow click succeeded (no ban signal) — record it
   {
    // Record follow in DB
    const unfollowDays = randomInt(this.config.unfollowWaitDays.min, this.config.unfollowWaitDays.max);
    const unfollowAfter = new Date(Date.now() + unfollowDays * 24 * 60 * 60 * 1000);

    await this.followDataLayer.recordFollow(this.config.username, targetUsername, unfollowAfter, source);
    await this.actionLogDataLayer.logAction({
     accountUsername: this.config.username,
     action: 'follow',
     targetUsername,
    });
    await this.accountDataLayer.updateLastAction(this.config.username);

    logger.info(`[${logContext}] Followed @${targetUsername} (unfollow after ${unfollowDays} days)`);
    return true;
   }

  } catch (err: any) {
   logger.error(`followUser failed for @${targetUsername}: ${err.message}`, logContext);
   return false;
  }
 }

 /**
 * Like the latest post(s) of a user.
 */
 public async likeLatestPosts(targetUsername: string, count: number = 1): Promise<number> {
  const logContext = `${this.logContext} -> likeLatestPosts(${targetUsername})`;
  const page = this.browserService.getPage();
  let liked = 0;

  try {
   // Make sure we're on the profile page
   if (!page.url().includes(`/${targetUsername}`)) {
    await page.goto(`https://www.instagram.com/${targetUsername}/`, { waitUntil: 'domcontentloaded', timeout: 30000 });
    await randomDelay(this.config.delays.pageLoad.min, this.config.delays.pageLoad.max);
   }

   // Scroll through profile before opening a post
   await this.scrollBeforeAction(page);

   // Click first post
   const firstPost = page.locator('article a[href*="/p/"], main a[href*="/p/"]').first();
   if (!await firstPost.isVisible({ timeout: 3000 }).catch(() => false)) {
    logger.info(`[${logContext}] No posts found for @${targetUsername}`);
    return 0;
   }

   await firstPost.click();
   await randomDelay(this.config.delays.pageLoad.min, this.config.delays.pageLoad.max);

   for (let i = 0; i < count; i++) {
    const canLike = await this.safetyService.canPerformAction(this.config.username, 'like');
    if (!canLike.allowed) break;

    // Check for ban
    const banCheck = await this.safetyService.detectBanSignal(page);
    if (banCheck.banned) {
     await this.safetyService.handleBanSignal(this.config.username, banCheck.signal!);
     break;
    }

    // Pause to "read" the post before liking
    await randomDelay(2000, 5000);

    // Randomly scroll inside the post modal (read comments)
    if (Math.random() < 0.4) {
     await page.mouse.wheel(0, randomInt(100, 300));
     await randomDelay(1000, 2500);
    }

    // Find the like button (heart icon that's not already filled/red)
    const likeButton = page.locator('svg[aria-label="Like"]').first();
    if (await likeButton.isVisible({ timeout: 2000 }).catch(() => false)) {
     await likeButton.click();
     await randomDelay(1000, 2500);

     await this.actionLogDataLayer.logAction({
      accountUsername: this.config.username,
      action: 'like',
      targetUsername,
     });
     liked++;

     logger.info(`[${logContext}] Liked post ${i + 1} of @${targetUsername}`);
    }

    // Navigate to next post if needed
    if (i < count - 1) {
     const nextButton = page.locator('button[aria-label="Next"]').first();
     if (await nextButton.isVisible({ timeout: 2000 }).catch(() => false)) {
      await nextButton.click();
      await randomDelay(1000, 3000);
     } else {
      break;
     }
    }
   }

   // Close the post modal
   await page.keyboard.press('Escape');
   await randomDelay(500, 1000);

   await this.accountDataLayer.updateLastAction(this.config.username);
   return liked;

  } catch (err: any) {
   logger.error(`likeLatestPosts failed for @${targetUsername}: ${err.message}`, logContext);
   return liked;
  }
 }

 /**
 * View a user's story if available.
 */
 public async viewStory(targetUsername: string): Promise<boolean> {
  const logContext = `${this.logContext} -> viewStory(${targetUsername})`;
  const page = this.browserService.getPage();

  try {
   if (!page.url().includes(`/${targetUsername}`)) {
    await page.goto(`https://www.instagram.com/${targetUsername}/`, { waitUntil: 'domcontentloaded', timeout: 30000 });
    await randomDelay(this.config.delays.pageLoad.min, this.config.delays.pageLoad.max);
   }

   // Brief scroll to look at the profile before clicking story
   await page.mouse.wheel(0, randomInt(50, 150));
   await randomDelay(800, 2000);
   await page.mouse.wheel(0, -randomInt(50, 150));
   await randomDelay(500, 1500);

   // Click on the story ring (profile picture with colorful border)
   const storyRing = page.locator('header canvas, header img[draggable="false"]').first();
   if (!await storyRing.isVisible({ timeout: 2000 }).catch(() => false)) {
    return false; // No story available
   }

   await storyRing.click();
   await randomDelay(2000, 4000);

   // Watch for a few slides
   const slides = randomInt(1, 4);
   for (let i = 0; i < slides; i++) {
    await randomDelay(this.config.delays.storySlide.min, this.config.delays.storySlide.max);

    // Check if story is still showing
    const closeButton = page.locator('button[aria-label="Close"]').first();
    if (!await closeButton.isVisible({ timeout: 1000 }).catch(() => false)) break;
   }

   // Close story
   await page.keyboard.press('Escape');
   await randomDelay(500, 1000);

   await this.actionLogDataLayer.logAction({
    accountUsername: this.config.username,
    action: 'story_view',
    targetUsername,
   });
   await this.accountDataLayer.updateLastAction(this.config.username);

   logger.info(`[${logContext}] Viewed story of @${targetUsername}`);
   return true;

  } catch (err: any) {
   logger.error(`viewStory failed for @${targetUsername}: ${err.message}`, logContext);
   return false;
  }
 }

 /**
 * Unfollow a user.
 */
 public async unfollowUser(targetUsername: string): Promise<boolean> {
  const logContext = `${this.logContext} -> unfollowUser(${targetUsername})`;
  const page = this.browserService.getPage();

  try {
   await page.goto(`https://www.instagram.com/${targetUsername}/`, { waitUntil: 'domcontentloaded', timeout: 30000 });
   await randomDelay(this.config.delays.pageLoad.min, this.config.delays.pageLoad.max);

   // Scroll briefly before unfollowing
   await this.scrollBeforeAction(page);

   // Find the "Following" button
   const followingButton = page.locator('button:has-text("Following")').first();
   if (!await followingButton.isVisible({ timeout: 3000 }).catch(() => false)) {
    logger.info(`[${logContext}] Not following @${targetUsername}, skipping unfollow`);
    return false;
   }

   await followingButton.click();
   await randomDelay(500, 1500);

   // Click "Unfollow" in the confirmation dialog
   const unfollowConfirm = page.locator('button:has-text("Unfollow")').first();
   if (await unfollowConfirm.isVisible({ timeout: 3000 }).catch(() => false)) {
    await unfollowConfirm.click();
    await randomDelay(1000, 2500);
   }

   // Check for ban
   const banCheck = await this.safetyService.detectBanSignal(page);
   if (banCheck.banned) {
    await this.safetyService.handleBanSignal(this.config.username, banCheck.signal!);
    return false;
   }

   await this.followDataLayer.markUnfollowed(this.config.username, targetUsername);
   await this.actionLogDataLayer.logAction({
    accountUsername: this.config.username,
    action: 'unfollow',
    targetUsername,
   });
   await this.accountDataLayer.updateLastAction(this.config.username);

   logger.info(`[${logContext}] Unfollowed @${targetUsername}`);
   return true;

  } catch (err: any) {
   logger.error(`unfollowUser failed for @${targetUsername}: ${err.message}`, logContext);
   return false;
  }
 }

 /**
 * Scroll the page naturally to simulate human browsing.
 * Mixes downward scrolls, occasional scroll-backs, and pauses.
 */
 private async scrollNaturally(page: Page): Promise<void> {
  const scrollCount = randomInt(3, 8);
  for (let i = 0; i < scrollCount; i++) {
   // 20% chance to scroll back up slightly (humans do this)
   if (i > 1 && Math.random() < 0.2) {
    const upDistance = randomInt(50, 200);
    await page.mouse.wheel(0, -upDistance);
    await randomDelay(this.config.delays.scroll.min, this.config.delays.scroll.max);
   }

   const distance = randomInt(100, 400);
   await page.mouse.wheel(0, distance);
   await randomDelay(this.config.delays.scroll.min, this.config.delays.scroll.max);

   // 15% chance of a longer "reading" pause mid-scroll
   if (Math.random() < 0.15) {
    await randomDelay(1500, 4000);
   }
  }
 }

 /**
 * Small random scroll to simulate glancing at the page before acting.
 */
 private async scrollBeforeAction(page: Page): Promise<void> {
  const scrolls = randomInt(1, 3);
  for (let i = 0; i < scrolls; i++) {
   const distance = randomInt(80, 250);
   await page.mouse.wheel(0, distance);
   await randomDelay(this.config.delays.scroll.min, this.config.delays.scroll.max);
  }
  // Pause to "read"
  await randomDelay(1000, 3000);
 }

 private static instance: ActionService;

 public static getInstance(): ActionService {
  if (!ActionService.instance) {
   ActionService.instance = new ActionService();
  }
  return ActionService.instance;
 }

 public static reset(): void {
  ActionService.instance = undefined as any;
 }

}
