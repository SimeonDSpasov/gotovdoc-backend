import Config from './../config';

/**
 * Instagram Bot Configuration
 *
 * Required .env variables:
 *   IG_BOT_USERNAME    — Your Instagram username (the account the bot logs into)
 *   IG_BOT_PASSWORD    — Your Instagram password
 *   IG_BOT_TARGETS     — Comma-separated Instagram profiles to scrape followers/likers from
 *                         e.g. "competitor1,influencer2,niche_page3"
 *
 * Optional .env variables:
 *   IG_BOT_SESSION_HOURS — How many hours to run per session (default: 5)
 *   IG_BOT_TIMEZONE      — Browser timezone for fingerprint (default: "Europe/Sofia")
 *   IG_BOT_PROXY         — Proxy server, e.g. "socks5://user:pass@host:port" (recommended)
 *
 * Run: npm run ig-bot
 * Stop: Ctrl+C (saves cookies before exit)
 */
export default class IgBotConfig {

 public username = process.env.IG_BOT_USERNAME || '';
 public password = process.env.IG_BOT_PASSWORD || '';
 public proxy = process.env.IG_BOT_PROXY || '';
 public targets = (process.env.IG_BOT_TARGETS || '').split(',').map(s => s.trim()).filter(Boolean);
 public timezone = process.env.IG_BOT_TIMEZONE || 'Europe/Sofia';
 public sessionHours = Number(process.env.IG_BOT_SESSION_HOURS) || 5;

 public dbName = Config.getInstance().databases.main;

 // Delays (milliseconds)
 public delays = {
  betweenActions: { min: 25_000, max: 90_000 },
  batchBreak: { min: 600_000, max: 1_500_000 },   // 10-25 min
  typingPerChar: { min: 80, max: 180 },
  pageLoad: { min: 2_000, max: 5_000 },
  scroll: { min: 800, max: 2_500 },
  profileView: { min: 3_000, max: 8_000 },
  storySlide: { min: 3_000, max: 8_000 },
  discoveryScroll: { min: 1_000, max: 3_000 },
 };

 // Batch: how many actions before a long break
 public batchSize = { min: 10, max: 20 };

 // Unfollow wait days
 public unfollowWaitDays = { min: 3, max: 7 };

 // Daily limits by warmup tier
 public limits: Record<string, { follow: { min: number; max: number }; like: { min: number; max: number } }> = {
  'tier1': { follow: { min: 10, max: 15 }, like: { min: 15, max: 20 } },   // Days 1-3
  'tier2': { follow: { min: 20, max: 30 }, like: { min: 30, max: 40 } },   // Days 4-7
  'tier3': { follow: { min: 35, max: 50 }, like: { min: 50, max: 70 } },   // Days 8-14
  'tier4': { follow: { min: 50, max: 80 }, like: { min: 80, max: 120 } },  // Days 15+
 };

 // Filter rules
 public filter = {
  minFollowers: 10,
  maxFollowers: 5000,
  minPosts: 3,
  followBackRatio: 0.3,  // following >= followers * 0.3
  businessKeywords: ['shop', 'store', 'order', 'buy', 'price', 'shipping', 'dm to order', 'link in bio', 'official'],
  maxFollowersForBusiness: 10_000,
 };

 // Discovery
 public discovery = {
  followersPerSource: { min: 50, max: 100 },
  postsToScrape: { min: 3, max: 5 },
  minTargetQueue: 100,
 };

 public getTier(warmupDays: number): string {
  if (warmupDays <= 3) return 'tier1';
  if (warmupDays <= 7) return 'tier2';
  if (warmupDays <= 14) return 'tier3';
  return 'tier4';
 }

 private static instance: IgBotConfig;

 public static getInstance(): IgBotConfig {
  if (!IgBotConfig.instance) {
   IgBotConfig.instance = new IgBotConfig();
  }
  return IgBotConfig.instance;
 }

}
