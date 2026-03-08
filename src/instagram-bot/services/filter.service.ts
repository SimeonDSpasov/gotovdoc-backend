import logger from '@ipi-soft/logger';
import { Page } from 'playwright';

import IgBotConfig from './../config';
import { randomDelay } from './../helpers';

interface ProfileStats {
 followers: number;
 following: number;
 posts: number;
 isPrivate: boolean;
 isBusiness: boolean;
 bio: string;
}

interface FilterResult {
 pass: boolean;
 score: number;
 stats: ProfileStats;
 reason?: string;
}

export default class FilterService {

 private logContext = 'Filter Service';
 private config = IgBotConfig.getInstance();

 /**
 * Visit a user's profile and evaluate if they're a good follow target.
 */
 public async evaluateTarget(page: Page, username: string): Promise<FilterResult> {
  const logContext = `${this.logContext} -> evaluateTarget(${username})`;

  try {
   await page.goto(`https://www.instagram.com/${username}/`, { waitUntil: 'domcontentloaded', timeout: 30000 });
   await randomDelay(this.config.delays.pageLoad.min, this.config.delays.pageLoad.max);

   const stats = await this.extractProfileStats(page);

   // Apply filter rules
   if (stats.isPrivate) {
    return { pass: false, score: 0, stats, reason: 'Private account' };
   }

   if (stats.posts < this.config.filter.minPosts) {
    return { pass: false, score: 0, stats, reason: `Too few posts (${stats.posts})` };
   }

   if (stats.followers < this.config.filter.minFollowers) {
    return { pass: false, score: 0, stats, reason: `Too few followers (${stats.followers})` };
   }

   if (stats.followers > this.config.filter.maxFollowers) {
    return { pass: false, score: 0, stats, reason: `Too many followers (${stats.followers})` };
   }

   // Follow-back ratio check: they should follow people back
   if (stats.following < stats.followers * this.config.filter.followBackRatio) {
    return { pass: false, score: 0, stats, reason: `Low follow-back ratio (${stats.following}/${stats.followers})` };
   }

   if (stats.isBusiness) {
    return { pass: false, score: 0, stats, reason: 'Business account' };
   }

   // Calculate quality score (1-10)
   const score = this.calculateScore(stats);

   return { pass: true, score, stats };

  } catch (err: any) {
   logger.error(`Failed to evaluate @${username}: ${err.message}`, logContext);
   return { pass: false, score: 0, stats: { followers: 0, following: 0, posts: 0, isPrivate: false, isBusiness: false, bio: '' }, reason: 'Error' };
  }
 }

 private async extractProfileStats(page: Page): Promise<ProfileStats> {
  // Check if profile exists / is private
  const isPrivate = await page.locator('text=This account is private').first()
   .isVisible({ timeout: 2000 }).catch(() => false);

  // Extract stats from the header section
  const statsText = await page.evaluate(() => {
   const metaElements = Array.from(document.querySelectorAll('meta[property="og:description"]'));
   for (const meta of metaElements) {
    const content = meta.getAttribute('content');
    if (content) return content;
   }

   // Fallback: try to read from the page directly
   const headerSection = document.querySelector('header section');
   return headerSection?.textContent || '';
  });

  logger.info(`[${this.logContext}] Raw statsText: "${statsText.slice(0, 200)}"`);

  // Match English or Bulgarian: "123 Followers" / "123 последователи"
  const followers = this.parseNumber(statsText, /(\d[\d,.]*[KkMm]?)\s*(?:[Ff]ollowers|последователи)/);
  const following = this.parseNumber(statsText, /(\d[\d,.]*[KkMm]?)\s*(?:[Ff]ollowing|последвани)/);
  const posts = this.parseNumber(statsText, /(\d[\d,.]*[KkMm]?)\s*(?:[Pp]osts|публикации)/);

  // Extract bio for business detection
  const bio = await page.evaluate(() => {
   // Try to get bio text
   const bioEl = document.querySelector('header section > div:last-child') ||
                 document.querySelector('[data-testid="user-bio"]');
   return bioEl?.textContent?.toLowerCase() || '';
  });

  const isBusiness = this.detectBusiness(bio, followers);

  return { followers, following, posts, isPrivate, isBusiness, bio };
 }

 private parseNumber(text: string, regex: RegExp): number {
  const match = text.match(regex);
  if (!match) return 0;

  let numStr = match[1].replace(/,/g, '');

  if (numStr.endsWith('K') || numStr.endsWith('k')) {
   return Math.round(parseFloat(numStr) * 1000);
  }
  if (numStr.endsWith('M') || numStr.endsWith('m')) {
   return Math.round(parseFloat(numStr) * 1_000_000);
  }

  return parseInt(numStr, 10) || 0;
 }

 private detectBusiness(bio: string, followers: number): boolean {
  const keywords = this.config.filter.businessKeywords;

  for (const keyword of keywords) {
   if (bio.includes(keyword.toLowerCase())) {
    // Only flag as business if they have significant followers
    if (followers > this.config.filter.maxFollowersForBusiness) {
     return true;
    }
    // Small accounts with business keywords might just be people
    if (followers > 1000) {
     return true;
    }
   }
  }

  return false;
 }

 private calculateScore(stats: ProfileStats): number {
  let score = 5; // Base score

  // Follow-back ratio: closer to 1.0 = better
  const ratio = stats.followers > 0 ? stats.following / stats.followers : 0;
  if (ratio >= 0.8 && ratio <= 1.5) score += 2;
  else if (ratio >= 0.5 && ratio <= 2.0) score += 1;

  // Post count: active users are better
  if (stats.posts >= 10 && stats.posts <= 500) score += 1;
  if (stats.posts >= 30) score += 1;

  // Follower count: mid-range is best for follow-back
  if (stats.followers >= 100 && stats.followers <= 2000) score += 1;

  return Math.min(10, Math.max(1, score));
 }

 private static instance: FilterService;

 public static getInstance(): FilterService {
  if (!FilterService.instance) {
   FilterService.instance = new FilterService();
  }
  return FilterService.instance;
 }

 public static reset(): void {
  FilterService.instance = undefined as any;
 }

}
