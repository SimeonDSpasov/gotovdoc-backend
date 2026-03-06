import logger from '@ipi-soft/logger';
import { Page } from 'playwright';

import IgBotConfig from './../config';
import BrowserService from './browser.service';
import IgAccountDataLayer from './../data-layers/ig-account.data-layer';
import { randomDelay, randomInt } from './../helpers';

export default class AuthService {

 private logContext = 'Auth Service';
 private config = IgBotConfig.getInstance();
 private browserService = BrowserService.getInstance();
 private accountDataLayer = IgAccountDataLayer.getInstance();

 /**
 * Ensure the account is logged in. Returns true if ready, false if blocked.
 */
 public async ensureLoggedIn(): Promise<boolean> {
  const logContext = `${this.logContext} -> ensureLoggedIn()`;
  const page = this.browserService.getPage();

  // Navigate to Instagram
  await page.goto('https://www.instagram.com/', { waitUntil: 'domcontentloaded' });
  await randomDelay(3000, 5000);

  // Dismiss cookie consent early — it can block the entire page
  await this.dismissCookieConsent(page);

  // Check if already logged in
  if (await this.isLoggedIn(page)) {
   logger.info(`[${logContext}] Session restored — already logged in`);
   await this.dismissPopups(page);
   return true;
  }

  // Check for challenge/ban
  if (await this.isChallenge(page)) {
   logger.error('Challenge detected — manual intervention required', logContext);
   await this.accountDataLayer.updateStatus(this.config.username, 'challenge');
   return false;
  }

  // Perform login
  logger.info(`[${logContext}] Session expired — logging in...`);
  return this.performLogin(page);
 }

 private async isLoggedIn(page: Page): Promise<boolean> {
  try {
   // Look for elements that only appear when logged in
   const loggedIn = await page.locator('svg[aria-label="Home"]').first().isVisible({ timeout: 5000 }).catch(() => false);
   if (loggedIn) return true;

   // Alternative: check for the search icon or profile nav
   const navExists = await page.locator('a[href="/explore/"]').first().isVisible({ timeout: 2000 }).catch(() => false);
   return navExists;
  } catch {
   return false;
  }
 }

 private async isChallenge(page: Page): Promise<boolean> {
  const url = page.url();
  if (url.includes('/challenge/') || url.includes('/accounts/suspended/')) return true;

  const challengeText = await page.locator('text=Suspicious Login Attempt').first().isVisible({ timeout: 1000 }).catch(() => false);
  return challengeText;
 }

 private async performLogin(page: Page): Promise<boolean> {
  const logContext = `${this.logContext} -> performLogin()`;

  try {
   // Navigate to login page if not already there
   if (!page.url().includes('/accounts/login')) {
    await page.goto('https://www.instagram.com/accounts/login/', { waitUntil: 'domcontentloaded' });
    await randomDelay(3000, 5000);
   }

   logger.info(`[${logContext}] Login page URL: ${page.url()}`);

   // Dismiss cookie consent — must happen before interacting with the form
   await this.dismissCookieConsent(page);

   // Wait for the username input to appear
   const usernameInput = page.locator('input[name="email"]');
   const inputVisible = await usernameInput.isVisible({ timeout: 15000 }).catch(() => false);

   if (!inputVisible) {
    // Try navigating directly to the login page again
    logger.info(`[${logContext}] Username input not found, retrying navigation...`);
    await page.goto('https://www.instagram.com/accounts/login/', { waitUntil: 'networkidle' });
    await randomDelay(3000, 5000);
    await this.dismissCookieConsent(page);

    const retryVisible = await usernameInput.isVisible({ timeout: 10000 }).catch(() => false);

    if (!retryVisible) {
     logger.error(`Login form not found. Current URL: ${page.url()}`, logContext);
     return false;
    }
   }

   // Type username with human-like speed
   await usernameInput.click({ force: true });
   await randomDelay(300, 800);
   await this.typeHuman(page, usernameInput, this.config.username);

   await randomDelay(500, 1500);

   // Type password
   const passwordInput = page.locator('input[name="pass"]');
   await passwordInput.click({ force: true });
   await randomDelay(300, 800);
   await this.typeHuman(page, passwordInput, this.config.password);

   await randomDelay(800, 2000);

   // Click the login button via native JS click (bypasses overlay interception)
   const clicked = await page.evaluate(() => {
    const btn = document.querySelector('div[aria-label="Log In"][role="button"]') as HTMLElement;
    if (btn) { btn.click(); return true; }
    // Fallback: dispatch submit event on the form (triggers Instagram's JS handlers)
    const form = document.querySelector('form#login_form') as HTMLFormElement;
    if (form) { form.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true })); return true; }
    return false;
   });

   if (!clicked) {
    logger.error(`Login button/form not found. URL: ${page.url()}`, logContext);
    return false;
   }

   // Wait for navigation
   await randomDelay(5000, 8000);

   // Check for errors
   const errorMessage = await page.locator('#slfErrorAlert, [data-testid="login-error-message"]').first()
    .isVisible({ timeout: 3000 }).catch(() => false);

   if (errorMessage) {
    logger.error('Login failed — wrong credentials or error', logContext);
    return false;
   }

   // Check for challenge after login
   if (await this.isChallenge(page)) {
    logger.error('Challenge detected after login', logContext);
    await this.accountDataLayer.updateStatus(this.config.username, 'challenge');
    return false;
   }

   // Dismiss popups (Save Login Info, Notifications)
   await this.dismissPopups(page);

   // Verify we're logged in
   if (await this.isLoggedIn(page)) {
    logger.info(`[${logContext}] Login successful`);
    await this.browserService.savePersistence();
    return true;
   }

   logger.error(`Login flow completed but not detected as logged in. URL: ${page.url()}`, logContext);
   return false;

  } catch (err: any) {
   logger.error(`Login error: ${err.message}`, logContext);
   return false;
  }
 }

 private async dismissCookieConsent(page: Page): Promise<void> {
  const logContext = `${this.logContext} -> dismissCookieConsent()`;

  // Wait for the cookie dialog to appear — it can take a few seconds to render
  const dialogLocator = page.locator('div[role="dialog"]').first();
  const dialogVisible = await dialogLocator.isVisible({ timeout: 8000 }).catch(() => false);

  if (!dialogVisible) return;

  // Try clicking "Allow all cookies" button inside the dialog
  const allowButton = dialogLocator.locator('button').first();
  if (await allowButton.isVisible({ timeout: 2000 }).catch(() => false)) {
   await allowButton.click();
   logger.info(`[${logContext}] Dismissed cookie consent dialog`);
   await randomDelay(1500, 3000);
  }
 }

 private async dismissPopups(page: Page): Promise<void> {
  await randomDelay(1000, 2000);

  // "Save Your Login Info?" dialog
  const saveInfoButton = page.locator('button:has-text("Not Now"), button:has-text("Not now")').first();
  if (await saveInfoButton.isVisible({ timeout: 2000 }).catch(() => false)) {
   await saveInfoButton.click();
   await randomDelay(1000, 2000);
  }

  // "Turn on Notifications?" dialog
  const notifButton = page.locator('button:has-text("Not Now"), button:has-text("Not now")').first();
  if (await notifButton.isVisible({ timeout: 2000 }).catch(() => false)) {
   await notifButton.click();
   await randomDelay(500, 1000);
  }
 }

 private async typeHuman(page: Page, locator: any, text: string): Promise<void> {
  for (const char of text) {
   await locator.pressSequentially(char, { delay: 0 });
   await randomDelay(this.config.delays.typingPerChar.min, this.config.delays.typingPerChar.max);
  }
 }

 private static instance: AuthService;

 public static getInstance(): AuthService {
  if (!AuthService.instance) {
   AuthService.instance = new AuthService();
  }
  return AuthService.instance;
 }

}
