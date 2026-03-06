import logger from '@ipi-soft/logger';
import { Page } from 'playwright';

import IgBotConfig from './../config';
import BrowserService from './browser.service';
import SafetyService from './safety.service';
import IgTargetDataLayer from './../data-layers/ig-target.data-layer';
import { randomDelay, randomInt } from './../helpers';

export default class DiscoveryService {

 private logContext = 'Discovery Service';
 private config = IgBotConfig.getInstance();
 private browserService = BrowserService.getInstance();
 private safetyService = SafetyService.getInstance();
 private targetDataLayer = IgTargetDataLayer.getInstance();

 /**
 * Discover targets from a source profile (followers + recent post likers).
 */
 public async discoverFromProfile(sourceUsername: string): Promise<number> {
  const logContext = `${this.logContext} -> discoverFromProfile(${sourceUsername})`;
  const page = this.browserService.getPage();
  let totalDiscovered = 0;

  try {
   // Navigate to source profile
   await page.goto(`https://www.instagram.com/${sourceUsername}/`, { waitUntil: 'domcontentloaded' });
   await randomDelay(this.config.delays.pageLoad.min, this.config.delays.pageLoad.max);

   // Check for ban
   const banCheck = await this.safetyService.detectBanSignal(page);
   if (banCheck.banned) {
    await this.safetyService.handleBanSignal(this.config.username, banCheck.signal!);
    return 0;
   }

   // 1. Scrape followers
   const followers = await this.scrapeFollowers(page, sourceUsername);
   totalDiscovered += followers;

   // 2. Scrape recent post likers
   await page.goto(`https://www.instagram.com/${sourceUsername}/`, { waitUntil: 'domcontentloaded' });
   await randomDelay(this.config.delays.pageLoad.min, this.config.delays.pageLoad.max);

   const likers = await this.scrapePostLikers(page, sourceUsername);
   totalDiscovered += likers;

   logger.info(`[${logContext}] Discovered ${totalDiscovered} targets from @${sourceUsername} (${followers} followers, ${likers} likers)`);
   return totalDiscovered;

  } catch (err: any) {
   logger.error(`Discovery failed for @${sourceUsername}: ${err.message}`, logContext);
   return totalDiscovered;
  }
 }

 /**
 * Open the followers dialog and scroll to collect usernames.
 */
 private async scrapeFollowers(page: Page, sourceUsername: string): Promise<number> {
  const logContext = `${this.logContext} -> scrapeFollowers(${sourceUsername})`;
  const maxFollowers = randomInt(this.config.discovery.followersPerSource.min, this.config.discovery.followersPerSource.max);
  let collected = 0;

  try {
   // Click on the followers count link
   const followersLink = page.locator(`a[href="/${sourceUsername}/followers/"]`).first();
   if (!await followersLink.isVisible({ timeout: 3000 }).catch(() => false)) {
    logger.info(`[${logContext}] Cannot find followers link for @${sourceUsername}`);
    return 0;
   }

   await followersLink.click();
   await randomDelay(2000, 4000);

   // Wait for the dialog to appear
   const dialog = page.locator('div[role="dialog"]').first();
   if (!await dialog.isVisible({ timeout: 5000 }).catch(() => false)) {
    logger.info(`[${logContext}] Followers dialog did not appear`);
    return 0;
   }

   const seenUsernames = new Set<string>();

   // Scroll through the followers list
   const maxScrolls = 20;
   for (let scroll = 0; scroll < maxScrolls && collected < maxFollowers; scroll++) {
    // Extract usernames from the dialog
    const usernames = await page.evaluate(() => {
     const dialog = document.querySelector('div[role="dialog"]');
     if (!dialog) return [];

     const links = Array.from(dialog.querySelectorAll('a[href^="/"]'));
     const names: string[] = [];

     for (const link of links) {
      const href = link.getAttribute('href');
      if (href && href.match(/^\/[a-zA-Z0-9_.]+\/$/)) {
       const username = href.replace(/\//g, '');
       if (username && !['explore', 'accounts', 'p'].includes(username)) {
        names.push(username);
       }
      }
     }

     return [...new Set(names)];
    });

    for (const username of usernames) {
     if (seenUsernames.has(username) || username === this.config.username) continue;
     seenUsernames.add(username);

     const inserted = await this.targetDataLayer.tryInsert(
      this.config.username,
      username,
      `followers:@${sourceUsername}`,
     );

     if (inserted) collected++;
     if (collected >= maxFollowers) break;
    }

    // Scroll down in the dialog
    await page.evaluate(() => {
     const dialog = document.querySelector('div[role="dialog"] div[style*="overflow"]') ||
                    document.querySelector('div[role="dialog"] ul')?.parentElement;
     if (dialog) dialog.scrollTop += 500;
    });

    await randomDelay(this.config.delays.discoveryScroll.min, this.config.delays.discoveryScroll.max);

    // Check if we've stopped getting new results
    if (scroll > 5 && usernames.length === 0) break;
   }

   // Close the dialog
   await page.keyboard.press('Escape');
   await randomDelay(500, 1000);

   logger.info(`[${logContext}] Scraped ${collected} followers from @${sourceUsername}`);
   return collected;

  } catch (err: any) {
   logger.error(`scrapeFollowers failed: ${err.message}`, logContext);
   await page.keyboard.press('Escape').catch(() => {});
   return collected;
  }
 }

 /**
 * Scrape likers from the most recent posts.
 */
 private async scrapePostLikers(page: Page, sourceUsername: string): Promise<number> {
  const logContext = `${this.logContext} -> scrapePostLikers(${sourceUsername})`;
  const postsToScrape = randomInt(this.config.discovery.postsToScrape.min, this.config.discovery.postsToScrape.max);
  let collected = 0;

  try {
   // Get post links from the profile grid
   const postLinks = await page.evaluate((count: number) => {
    const links = document.querySelectorAll('article a[href*="/p/"], main a[href*="/p/"]');
    const hrefs: string[] = [];
    for (let i = 0; i < Math.min(count, links.length); i++) {
     const href = links[i].getAttribute('href');
     if (href) hrefs.push(href);
    }
    return hrefs;
   }, postsToScrape);

   for (const postLink of postLinks) {
    try {
     await page.goto(`https://www.instagram.com${postLink}`, { waitUntil: 'domcontentloaded' });
     await randomDelay(this.config.delays.pageLoad.min, this.config.delays.pageLoad.max);

     // Click on "liked by" section to open likers dialog
     const likersButton = page.locator('a[href*="/liked_by/"], button:has-text("others")').first();
     if (!await likersButton.isVisible({ timeout: 3000 }).catch(() => false)) continue;

     await likersButton.click();
     await randomDelay(2000, 4000);

     // Extract usernames from the likers dialog
     const usernames = await page.evaluate(() => {
      const dialog = document.querySelector('div[role="dialog"]');
      if (!dialog) return [];

      const links = Array.from(dialog.querySelectorAll('a[href^="/"]'));
      const names: string[] = [];

      for (const link of links) {
       const href = link.getAttribute('href');
       if (href && href.match(/^\/[a-zA-Z0-9_.]+\/$/)) {
        const username = href.replace(/\//g, '');
        if (username && !['explore', 'accounts', 'p'].includes(username)) {
         names.push(username);
        }
       }
      }

      return [...new Set(names)];
     });

     for (const username of usernames) {
      if (username === this.config.username) continue;

      const inserted = await this.targetDataLayer.tryInsert(
       this.config.username,
       username,
       `likers:@${sourceUsername}`,
      );

      if (inserted) collected++;
     }

     // Close dialog
     await page.keyboard.press('Escape');
     await randomDelay(1000, 2000);

    } catch {
     // Continue to next post on error
     await page.keyboard.press('Escape').catch(() => {});
    }
   }

   logger.info(`[${logContext}] Scraped ${collected} post likers from @${sourceUsername}`);
   return collected;

  } catch (err: any) {
   logger.error(`scrapePostLikers failed: ${err.message}`, logContext);
   return collected;
  }
 }

 private static instance: DiscoveryService;

 public static getInstance(): DiscoveryService {
  if (!DiscoveryService.instance) {
   DiscoveryService.instance = new DiscoveryService();
  }
  return DiscoveryService.instance;
 }

}
