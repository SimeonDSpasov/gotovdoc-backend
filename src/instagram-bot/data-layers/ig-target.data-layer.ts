import logger from '@ipi-soft/logger';

import { IgTarget } from './../models/ig-target.model';

export default class IgTargetDataLayer {

 private logContext = 'IgTarget Data Layer';

 public async tryInsert(accountUsername: string, targetUsername: string, source: string): Promise<boolean> {
  const logContext = `${this.logContext} -> tryInsert()`;

  return IgTarget.create({
   accountUsername,
   targetUsername,
   source,
   status: 'pending',
  })
   .then(() => true)
   .catch((err: any) => {
    if (err.code === 11000) return false; // Duplicate
    logger.error(err.message, logContext);
    return false;
   });
 }

 public async popNextBatch(accountUsername: string, limit: number = 10): Promise<any[]> {
  return IgTarget.find({
   accountUsername,
   status: 'pending',
  })
   .sort({ qualityScore: -1 })
   .limit(limit);
 }

 public async markProcessed(accountUsername: string, targetUsername: string, qualityScore: number, stats: {
  followerCount?: number | null;
  followingCount?: number | null;
  postCount?: number | null;
  isPrivate?: boolean;
 }): Promise<void> {
  await IgTarget.updateOne(
   { accountUsername, targetUsername },
   {
    status: 'processed',
    qualityScore,
    processedAt: new Date(),
    ...stats,
   },
  );
 }

 public async markFiltered(accountUsername: string, targetUsername: string, stats: {
  followerCount?: number | null;
  followingCount?: number | null;
  postCount?: number | null;
  isPrivate?: boolean;
 }): Promise<void> {
  await IgTarget.updateOne(
   { accountUsername, targetUsername },
   {
    status: 'filtered',
    processedAt: new Date(),
    ...stats,
   },
  );
 }

 public async countPending(accountUsername: string): Promise<number> {
  return IgTarget.countDocuments({ accountUsername, status: 'pending' });
 }

 private static instance: IgTargetDataLayer;

 public static getInstance(): IgTargetDataLayer {
  if (!IgTargetDataLayer.instance) {
   IgTargetDataLayer.instance = new IgTargetDataLayer();
  }
  return IgTargetDataLayer.instance;
 }

}
