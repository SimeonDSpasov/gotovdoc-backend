import { chromium, Browser, BrowserContext, Page } from 'playwright';
import logger from '@ipi-soft/logger';

import IgBotConfig from './../config';
import IgAccountDataLayer from './../data-layers/ig-account.data-layer';
import { randomInt } from './../helpers';

const USER_AGENTS = [
 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36',
 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36',
 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36',
 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36',
];

const VIEWPORTS = [
 { width: 1280, height: 800 },
 { width: 1366, height: 768 },
 { width: 1440, height: 900 },
 { width: 1536, height: 864 },
 { width: 1920, height: 1080 },
];

export default class BrowserService {

 private logContext = 'Browser Service';
 private config = IgBotConfig.getInstance();
 private accountDataLayer = IgAccountDataLayer.getInstance();

 private browser: Browser | null = null;
 private context: BrowserContext | null = null;
 private page: Page | null = null;
 private accountUsername: string = '';

 public async launch(username: string): Promise<Page> {
  const logContext = `${this.logContext} -> launch()`;
  this.accountUsername = username;

  let account = await this.accountDataLayer.getOrCreate(username, {
   timezone: this.config.timezone,
  });

  // Generate fingerprint on first run
  if (!account.userAgent) {
   const userAgent = USER_AGENTS[randomInt(0, USER_AGENTS.length - 1)];
   const viewport = VIEWPORTS[randomInt(0, VIEWPORTS.length - 1)];
   await this.accountDataLayer.updateFingerprint(username, {
    userAgent,
    viewport,
    timezone: this.config.timezone,
    locale: 'en-US',
   });
   account = await this.accountDataLayer.get(username);
  }

  const launchOptions: any = {
   headless: true,
   args: [
    '--disable-blink-features=AutomationControlled',
    '--disable-features=IsolateOrigins,site-per-process',
    '--no-sandbox',
   ],
  };

  if (this.config.proxy) {
   launchOptions.proxy = { server: this.config.proxy };
  }

  this.browser = await chromium.launch(launchOptions);

  const contextOptions: any = {
   viewport: account.viewport,
   userAgent: account.userAgent,
   locale: 'en-US',
   timezoneId: account.timezone || this.config.timezone,
  };

  // Restore cookies if available
  if (account.cookies) {
   try {
    const cookies = JSON.parse(account.cookies);
    contextOptions.storageState = { cookies, origins: [] };
   } catch {
    // Invalid cookies, start fresh
   }
  }

  this.context = await this.browser.newContext(contextOptions);

  // Override navigator.webdriver to avoid detection
  await this.context.addInitScript(() => {
   Object.defineProperty(navigator, 'webdriver', { get: () => undefined });
  });

  this.page = await this.context.newPage();

  logger.info(`[${logContext}] Browser launched for @${username} (${account.userAgent?.slice(0, 50)}...)`);

  return this.page;
 }

 public getPage(): Page {
  if (!this.page) throw new Error('Browser not launched');
  return this.page;
 }

 public async savePersistence(): Promise<void> {
  const logContext = `${this.logContext} -> savePersistence()`;

  if (!this.context || !this.page || !this.accountUsername) return;

  try {
   // Navigate to Instagram first if on a restricted page (about:blank, challenge, etc.)
   const currentUrl = this.page.url();
   if (!currentUrl.includes('instagram.com')) {
    await this.page.goto('https://www.instagram.com/', { waitUntil: 'domcontentloaded', timeout: 10000 }).catch(() => {});
   }

   const cookies = await this.context.cookies();
   const localStorage = await this.page.evaluate(() => JSON.stringify(window.localStorage)).catch(() => '{}');

   await this.accountDataLayer.updateSession(
    this.accountUsername,
    JSON.stringify(cookies),
    localStorage,
   );

   logger.info(`[${logContext}] Session saved for @${this.accountUsername} (${cookies.length} cookies)`);
  } catch (err: any) {
   logger.error(`Failed to save session: ${err.message}`, logContext);
  }
 }

 public async close(): Promise<void> {
  const logContext = `${this.logContext} -> close()`;

  await this.savePersistence();

  if (this.browser) {
   await this.browser.close().catch(() => {});
   this.browser = null;
   this.context = null;
   this.page = null;
   logger.info(`[${logContext}] Browser closed`);
  }
 }

 private static instance: BrowserService;

 public static getInstance(): BrowserService {
  if (!BrowserService.instance) {
   BrowserService.instance = new BrowserService();
  }
  return BrowserService.instance;
 }

}
