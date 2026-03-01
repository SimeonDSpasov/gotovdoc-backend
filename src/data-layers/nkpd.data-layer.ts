import CustomError from './../utils/custom-error.utils';

import { NkpdOccupation, NkpdOccupationDoc, INkpdOccupation } from './../models/nkpd.model';

export default class NkpdDataLayer {

 private logContext = 'Nkpd Data Layer';

 public async search(query: string, limit: number, logContext: string): Promise<NkpdOccupationDoc[]> {
  logContext = `${logContext} -> ${this.logContext} -> search()`;

  const regex = new RegExp(query.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i');

  const results = await NkpdOccupation.find({
   $or: [
    { name: regex },
    { code: { $regex: `^${query.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}` } },
   ]
  })
   .sort({ name: 1 })
   .limit(limit)
   .lean()
   .catch(err => {
    throw new CustomError(500, err.message, `${logContext} -> query: ${query}`);
   });

  return results as NkpdOccupationDoc[];
 }

 public async count(logContext: string): Promise<number> {
  logContext = `${logContext} -> ${this.logContext} -> count()`;

  const count = await NkpdOccupation.countDocuments()
   .catch(err => {
    throw new CustomError(500, err.message, logContext);
   });

  return count;
 }

 public async insertMany(data: INkpdOccupation[], logContext: string): Promise<void> {
  logContext = `${logContext} -> ${this.logContext} -> insertMany()`;

  await NkpdOccupation.insertMany(data, { ordered: false })
   .catch(err => {
    throw new CustomError(500, err.message, logContext);
   });
 }

 public async deleteAll(logContext: string): Promise<void> {
  logContext = `${logContext} -> ${this.logContext} -> deleteAll()`;

  await NkpdOccupation.deleteMany({})
   .catch(err => {
    throw new CustomError(500, err.message, logContext);
   });
 }

 private static instance: NkpdDataLayer;

 public static getInstance(): NkpdDataLayer {
  if (!NkpdDataLayer.instance) {
   NkpdDataLayer.instance = new NkpdDataLayer();
  }

  return NkpdDataLayer.instance;
 }

}
