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
   await page.goto(`https://www.instagram.com/${sourceUsername}/`, { waitUntil: 'domcontentloaded', timeout: 30000 });
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
   await page.goto(`https://www.instagram.com/${sourceUsername}/`, { waitUntil: 'domcontentloaded', timeout: 30000 });
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
   let consecutiveEmptyScrolls = 0;

   // Scroll through the followers list
   const maxScrolls = 50;
   for (let scroll = 0; scroll < maxScrolls && collected < maxFollowers; scroll++) {
    // Extract usernames from the dialog — try multiple selector strategies
    const usernames = await page.evaluate(() => {
     const dialog = document.querySelector('div[role="dialog"]');
     if (!dialog) return { names: [] as string[], debug: 'no dialog found' };

     const allLinks = Array.from(dialog.querySelectorAll('a'));
     const names: string[] = [];
     const debugHrefs: string[] = [];

     for (const link of allLinks) {
      const href = link.getAttribute('href');
      if (!href) continue;
      debugHrefs.push(href);

      if (href.match(/^\/[a-zA-Z0-9_.]+\/$/)) {
       const username = href.replace(/\//g, '');
       if (username && !['explore', 'accounts', 'p', 'reels', 'stories'].includes(username)) {
        names.push(username);
       }
      }
     }

     return {
      names: [...new Set(names)],
      debug: `${allLinks.length} links found, sample hrefs: ${debugHrefs.slice(0, 5).join(', ')}`,
     };
    });

    if (scroll === 0) {
     logger.info(`[${logContext}] [DEBUG] Scroll 0: ${usernames.debug} | extracted ${usernames.names.length} usernames`);
    }

    let newInScroll = 0;
    for (const username of usernames.names) {
     if (seenUsernames.has(username) || username === this.config.username) continue;
     seenUsernames.add(username);
     newInScroll++;

     const inserted = await this.targetDataLayer.tryInsert(
      this.config.username,
      username,
      `followers:@${sourceUsername}`,
     );

     if (inserted) collected++;
     if (collected >= maxFollowers) break;
    }

    // Track consecutive empty scrolls (no new usernames at all)
    if (newInScroll === 0) {
     consecutiveEmptyScrolls++;
     if (consecutiveEmptyScrolls >= 5) {
      logger.info(`[${logContext}] ${consecutiveEmptyScrolls} consecutive empty scrolls — source followers exhausted`);
      break;
     }
    } else {
     consecutiveEmptyScrolls = 0;
    }

    // Scroll down in the dialog — find the actual scrollable container dynamically
    const scrolled = await page.evaluate(() => {
     const dialog = document.querySelector('div[role="dialog"]');
     if (!dialog) return 'no dialog';

     // Find the element that is actually scrollable (scrollHeight > clientHeight)
     const allDivs = Array.from(dialog.querySelectorAll('div'));
     for (const div of allDivs) {
      if (div.scrollHeight > div.clientHeight + 10 && div.clientHeight > 100) {
       div.scrollTop += 600;
       return `scrolled div (scrollHeight=${div.scrollHeight}, clientHeight=${div.clientHeight})`;
      }
     }

     return 'no scrollable div found';
    });

    if (scroll === 0) {
     logger.info(`[${logContext}] [DEBUG] Scroll result: ${scrolled}`);
    }

    await randomDelay(this.config.delays.discoveryScroll.min, this.config.delays.discoveryScroll.max);
   }

   logger.info(`[${logContext}] [DEBUG] Total seen: ${seenUsernames.size}, new inserts: ${collected}`);

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
   // Get post links from the profile grid — try multiple selectors
   const postLinks = await page.evaluate((count: number) => {
    // Try multiple selectors for post links
    let links = document.querySelectorAll('article a[href*="/p/"], main a[href*="/p/"]');
    if (links.length === 0) {
     links = document.querySelectorAll('a[href*="/p/"]');
    }

    const hrefs: string[] = [];
    const seen = new Set<string>();
    for (let i = 0; i < links.length && hrefs.length < count; i++) {
     const href = links[i].getAttribute('href');
     if (href && !seen.has(href)) {
      seen.add(href);
      hrefs.push(href);
     }
    }
    return { hrefs, totalLinksFound: links.length };
   }, postsToScrape);

   logger.info(`[${logContext}] [DEBUG] Found ${postLinks.totalLinksFound} post links, using ${postLinks.hrefs.length}`);

   for (const postLink of postLinks.hrefs) {
    try {
     // Use networkidle to ensure like counts are rendered
     await page.goto(`https://www.instagram.com${postLink}`, { waitUntil: 'networkidle', timeout: 30000 });
     await randomDelay(this.config.delays.pageLoad.min, this.config.delays.pageLoad.max);

     // Try to find and click the likers section — use page.evaluate for broader detection
     const likersClicked = await page.evaluate(() => {
      // Strategy 1: find a[href*="/liked_by/"]
      const likedByLink = document.querySelector('a[href*="/liked_by/"]') as HTMLElement;
      if (likedByLink) { likedByLink.click(); return 'liked_by link'; }

      // Strategy 2: find any clickable element with "others" text (e.g., "Liked by X and 42 others")
      const allSpans = Array.from(document.querySelectorAll('span, a, button'));
      for (const el of allSpans) {
       const text = el.textContent?.trim() || '';
       if (text.includes('others') && (text.includes('like') || text.includes('Liked'))) {
        (el as HTMLElement).click();
        return `clicked: "${text.slice(0, 60)}"`;
       }
      }

      // Strategy 3: find "X likes" text and click it
      for (const el of allSpans) {
       const text = el.textContent?.trim() || '';
       if (text.match(/^\d[\d,.]* likes?$/i)) {
        (el as HTMLElement).click();
        return `clicked: "${text}"`;
       }
      }

      // Debug: dump what's on the page related to likes
      const debug = allSpans
       .filter(el => {
        const t = el.textContent?.toLowerCase() || '';
        return t.includes('like') || t.includes('other');
       })
       .map(el => `<${el.tagName}>${el.textContent?.trim().slice(0, 60)}`)
       .slice(0, 5);

      return debug.length > 0 ? `no click, found: ${debug.join(' | ')}` : 'nothing found';
     });

     logger.info(`[${logContext}] [DEBUG] Likers for ${postLink}: ${likersClicked}`);

     if (likersClicked === 'nothing found' || likersClicked.startsWith('no click')) {
      continue;
     }

     await randomDelay(2000, 4000);

     // Extract usernames from the likers dialog with scrolling
     const seenLikers = new Set<string>();

     for (let scroll = 0; scroll < 5; scroll++) {
      const usernames = await page.evaluate(() => {
       const dialog = document.querySelector('div[role="dialog"]');
       if (!dialog) return { names: [] as string[], debug: 'no dialog' };

       const allLinks = Array.from(dialog.querySelectorAll('a'));
       const names: string[] = [];

       for (const link of allLinks) {
        const href = link.getAttribute('href');
        if (href && href.match(/^\/[a-zA-Z0-9_.]+\/$/)) {
         const username = href.replace(/\//g, '');
         if (username && !['explore', 'accounts', 'p', 'reels', 'stories'].includes(username)) {
          names.push(username);
         }
        }
       }

       return { names: [...new Set(names)], debug: `${allLinks.length} links in dialog` };
      });

      if (scroll === 0) {
       logger.info(`[${logContext}] [DEBUG] Likers dialog for ${postLink}: ${usernames.debug}, ${usernames.names.length} usernames`);
      }

      for (const username of usernames.names) {
       if (username === this.config.username || seenLikers.has(username)) continue;
       seenLikers.add(username);

       const inserted = await this.targetDataLayer.tryInsert(
        this.config.username,
        username,
        `likers:@${sourceUsername}`,
       );

       if (inserted) collected++;
      }

      // Scroll inside the likers dialog — find actual scrollable container
      await page.evaluate(() => {
       const dialog = document.querySelector('div[role="dialog"]');
       if (!dialog) return;
       const allDivs = Array.from(dialog.querySelectorAll('div'));
       for (const div of allDivs) {
        if (div.scrollHeight > div.clientHeight + 10 && div.clientHeight > 100) {
         div.scrollTop += 400;
         break;
        }
       }
      });

      await randomDelay(1000, 2000);
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

 public static reset(): void {
  DiscoveryService.instance = undefined as any;
 }

}
