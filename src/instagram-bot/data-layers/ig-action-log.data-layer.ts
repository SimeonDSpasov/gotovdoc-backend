import logger from '@ipi-soft/logger';

import { IgActionLog, IgDailyCounter, IIgActionLog } from './../models/ig-action-log.model';
import { todayDateString } from './../helpers';

export default class IgActionLogDataLayer {

 private logContext = 'IgActionLog Data Layer';

 public async logAction(data: {
  accountUsername: string;
  action: IIgActionLog['action'];
  targetUsername: string;
  success?: boolean;
  errorMessage?: string | null;
 }): Promise<void> {
  const logContext = `${this.logContext} -> logAction()`;
  const date = todayDateString();

  await IgActionLog.create({
   ...data,
   date,
   performedAt: new Date(),
   success: data.success ?? true,
   errorMessage: data.errorMessage ?? null,
  }).catch(err => {
   logger.error(err.message, logContext);
  });

  // Increment daily counter
  const counterField = this.actionToCounterField(data.action);
  if (counterField) {
   await IgDailyCounter.updateOne(
    { accountUsername: data.accountUsername, date },
    { $inc: { [counterField]: 1 } },
    { upsert: true },
   ).catch(err => {
    logger.error(err.message, logContext);
   });
  }
 }

 public async getTodayCounts(accountUsername: string): Promise<{
  follows: number;
  unfollows: number;
  likes: number;
  storyViews: number;
  profileViews: number;
 }> {
  const date = todayDateString();
  const counter = await IgDailyCounter.findOne({ accountUsername, date });

  return {
   follows: counter?.follows || 0,
   unfollows: counter?.unfollows || 0,
   likes: counter?.likes || 0,
   storyViews: counter?.storyViews || 0,
   profileViews: counter?.profileViews || 0,
  };
 }

 private actionToCounterField(action: IIgActionLog['action']): string | null {
  switch (action) {
   case 'follow': return 'follows';
   case 'unfollow': return 'unfollows';
   case 'like': return 'likes';
   case 'story_view': return 'storyViews';
   case 'profile_view': return 'profileViews';
   default: return null;
  }
 }

 private static instance: IgActionLogDataLayer;

 public static getInstance(): IgActionLogDataLayer {
  if (!IgActionLogDataLayer.instance) {
   IgActionLogDataLayer.instance = new IgActionLogDataLayer();
  }
  return IgActionLogDataLayer.instance;
 }

}
