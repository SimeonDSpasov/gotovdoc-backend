import logger from '@ipi-soft/logger';

import { IgAccount, IIgAccount } from './../models/ig-account.model';

export default class IgAccountDataLayer {

 private logContext = 'IgAccount Data Layer';

 public async getOrCreate(username: string, defaults?: Partial<IIgAccount>): Promise<any> {
  const logContext = `${this.logContext} -> getOrCreate()`;

  let account = await IgAccount.findOne({ username }).catch(err => {
   logger.error(err.message, logContext);
   return null;
  });

  if (!account) {
   account = await IgAccount.create({ username, ...defaults }).catch(err => {
    logger.error(err.message, logContext);
    return null;
   });
   logger.info(`[${logContext}] Created new account record for @${username}`);
  }

  return account;
 }

 public async get(username: string): Promise<any> {
  return IgAccount.findOne({ username });
 }

 public async updateSession(username: string, cookies: string, localStorage: string): Promise<void> {
  const logContext = `${this.logContext} -> updateSession()`;

  await IgAccount.updateOne({ username }, {
   cookies,
   localStorage,
   lastLoginAt: new Date(),
  }).catch(err => {
   logger.error(err.message, logContext);
  });
 }

 public async updateFingerprint(username: string, data: { userAgent: string; viewport: { width: number; height: number }; timezone: string; locale: string }): Promise<void> {
  await IgAccount.updateOne({ username }, data);
 }

 public async updateStatus(username: string, status: IIgAccount['status']): Promise<void> {
  await IgAccount.updateOne({ username }, { status });
 }

 public async updateLastAction(username: string): Promise<void> {
  await IgAccount.updateOne({ username }, { lastActionAt: new Date() });
 }

 public async incrementWarmup(username: string): Promise<void> {
  await IgAccount.updateOne({ username }, { $inc: { warmupDays: 1 } });
 }

 private static instance: IgAccountDataLayer;

 public static getInstance(): IgAccountDataLayer {
  if (!IgAccountDataLayer.instance) {
   IgAccountDataLayer.instance = new IgAccountDataLayer();
  }
  return IgAccountDataLayer.instance;
 }

}
