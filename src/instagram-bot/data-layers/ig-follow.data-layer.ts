import logger from '@ipi-soft/logger';

import { IgFollow } from './../models/ig-follow.model';

export default class IgFollowDataLayer {

 private logContext = 'IgFollow Data Layer';

 public async recordFollow(accountUsername: string, targetUsername: string, unfollowAfter: Date, source: string): Promise<boolean> {
  const logContext = `${this.logContext} -> recordFollow()`;

  return IgFollow.create({
   accountUsername,
   targetUsername,
   followedAt: new Date(),
   unfollowAfter,
   source,
   status: 'following',
  })
   .then(() => true)
   .catch((err: any) => {
    if (err.code === 11000) return false; // Already following
    logger.error(err.message, logContext);
    return false;
   });
 }

 public async isAlreadyFollowing(accountUsername: string, targetUsername: string): Promise<boolean> {
  const doc = await IgFollow.findOne({
   accountUsername,
   targetUsername,
   status: 'following',
  });
  return !!doc;
 }

 public async getPendingUnfollows(accountUsername: string, limit: number = 20): Promise<any[]> {
  return IgFollow.find({
   accountUsername,
   status: 'following',
   followedBack: false,
   unfollowAfter: { $lt: new Date() },
  })
   .sort({ unfollowAfter: 1 })
   .limit(limit);
 }

 public async markUnfollowed(accountUsername: string, targetUsername: string): Promise<void> {
  await IgFollow.updateOne(
   { accountUsername, targetUsername },
   { status: 'unfollowed', unfollowedAt: new Date() },
  );
 }

 public async markFollowedBack(accountUsername: string, targetUsername: string): Promise<void> {
  await IgFollow.updateOne(
   { accountUsername, targetUsername },
   { followedBack: true },
  );
 }

 public async getFollowingCount(accountUsername: string): Promise<number> {
  return IgFollow.countDocuments({ accountUsername, status: 'following' });
 }

 private static instance: IgFollowDataLayer;

 public static getInstance(): IgFollowDataLayer {
  if (!IgFollowDataLayer.instance) {
   IgFollowDataLayer.instance = new IgFollowDataLayer();
  }
  return IgFollowDataLayer.instance;
 }

}
