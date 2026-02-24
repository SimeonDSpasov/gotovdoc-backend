import mongoose, { FilterQuery, UpdateQuery } from 'mongoose';

import CustomError from './../utils/custom-error.utils';

import { User, UserDoc, IUser, IUserActivity, UserRole } from './../models/user.model';

export default class UserDataLayer {

 private logContext = 'User Data Layer';

 public async create(data: Partial<IUser>, logContext: string): Promise<UserDoc> {
  logContext = `${logContext} -> ${this.logContext} -> create()`;

  const user = await User.create(data)
   .catch(err => {
    if (err.code === 11000) {
     throw new CustomError(400, 'Email already exist');
    }

    throw new CustomError(500, err.message, `${logContext} -> data: ${JSON.stringify(data)}`);
   });

  return user;
 }

 public async get(filter: FilterQuery<IUser>, logContext: string, projection: string = '-password'): Promise<UserDoc> {
  logContext = `${logContext} -> ${this.logContext} -> get()`;

  const user = await User.findOne(filter)
   .select(projection)
   .catch(err => {
    throw new CustomError(500, err.message, `${logContext} -> filter: ${JSON.stringify(filter)}`);
   });

  if (!user) {
   throw new CustomError(404, `No user found`);
  }

  return user;
 }

 public async getById(id: string | mongoose.Types.ObjectId, logContext: string, projection: string = '-password'): Promise<UserDoc> {
  logContext = `${logContext} -> ${this.logContext} -> getById()`;

  if (!mongoose.isValidObjectId(id)) {
   throw new CustomError(400, `Invalid ID`);
  }

  const user = await User.findById(id)
   .select(projection)
   .catch(err => {
    throw new CustomError(500, err.message, `${logContext} -> id: ${id.toString()}`);
   });

  if (!user) {
   throw new CustomError(404, `No user found`);
  }

  return user;
 }

 public async getByRole(role: UserRole, logContext: string): Promise<UserDoc[]> {
  logContext = `${logContext} -> ${this.logContext} -> getByRole()`;

  const users = await User.find({ role })
   .select('-password')
   .catch(err => {
    throw new CustomError(500, err.message, logContext);
   });

  return users;
 }

 public async update(id: string | mongoose.Types.ObjectId, update: UpdateQuery<IUser>, logContext: string, projection: string = '-password'): Promise<UserDoc> {
  logContext = `${logContext} -> ${this.logContext} -> update()`;

  if (!mongoose.isValidObjectId(id)) {
   throw new CustomError(400, `Invalid ID`);
  }

  const user = await User.findByIdAndUpdate(id, update, { new: true })
   .select(projection)
   .catch(err => {
    if (err.code === 11000) {
     throw new CustomError(400, 'Email already exist');
    }

    throw new CustomError(500, err.message, `${logContext} -> findByIdAndUpdate() -> id: ${id.toString()} | update: ${JSON.stringify(update)}`);
   });

  if (!user) {
   throw new CustomError(404, `No user found`);
  }

  return user;
 }

 public async updateMany(filter: FilterQuery<IUser>, update: UpdateQuery<IUser>, logContext: string): Promise<void> {
  logContext = `${logContext} -> ${this.logContext} -> updateMany()`;

  await User.updateMany(filter, update)
   .catch(err => {
    throw new CustomError(500, err.message, `${logContext}-> filter: ${JSON.stringify(filter)} | update: ${JSON.stringify(update)}`);
   });
 }

 public async updatePassword(user: UserDoc, password: string, logContext: string): Promise<UserDoc> {
  logContext = `${logContext} -> ${this.logContext} -> updatePassword()`;

  user.password = password;

  user.save()
   .catch(err => {
    throw new CustomError(500, err.message, `${logContext}-> user: ${JSON.stringify(user)}`);
   });

  return user;
 }

public async appendActivity(
  userId: string | mongoose.Types.ObjectId,
  activity: IUserActivity,
  logContext: string
 ): Promise<void> {
  logContext = `${logContext} -> ${this.logContext} -> appendActivity()`;

  if (!mongoose.isValidObjectId(userId)) {
   throw new CustomError(400, `Invalid user ID`);
  }

  await User.updateOne(
   { _id: userId },
   {
    $push: {
     activity: {
      $each: [{ ...activity, createdAt: activity.createdAt || new Date() }],
      $slice: -100,
     }
    }
   }
  ).catch(err => {
   throw new CustomError(500, err.message, `${logContext} -> userId: ${userId.toString()} | activity: ${JSON.stringify(activity)}`);
  });
 }

 private buildChunkSearchStage(searchTerm: string): any | null {
  if (!searchTerm) {
   return null;
  }

  const hasAtSign = searchTerm.includes('@');

  if (hasAtSign) {
   return {
    $search: {
     index: 'user-search-email',
     wildcard: {
      query: `${searchTerm}*`,
      path: 'email',
      allowAnalyzedField: true
     }
    }
   };
  } else {
   const searchStage: any = {
    $search: {
     index: 'user-search',
     compound: {
      should: [
       { autocomplete: { query: searchTerm, path: 'firstName' } },
       { autocomplete: { query: searchTerm, path: 'lastName' } },
       { autocomplete: { query: searchTerm, path: 'market' } },
       { autocomplete: { query: searchTerm, path: 'phoneNumber' } },
       { autocomplete: { query: searchTerm, path: 'email' } },
      ],
     }
    }
   };

   const searchTermToNum = parseFloat(searchTerm);

   if (!isNaN(searchTermToNum)) {
    searchStage.$search.compound.should.push(
     { equals: { path: 'stats.moneySpent.total', value: searchTermToNum * 100 } },
     { equals: { path: 'stats.credits.available', value: searchTermToNum * 100 } }
    );
   }

   const searchTermDate = new Date(searchTerm);

   if (!isNaN(searchTermDate.getTime())) {
    searchStage.$search.compound.should.push({
     range: {
      path: 'createdAt',
      gte: searchTermDate,
      lte: new Date(searchTermDate.getTime() + 24 * 60 * 60 * 1000)
     }
    });
   }

   return searchStage;
  }
 }

 private static instance: UserDataLayer;

 public static getInstance(): UserDataLayer {
  if (!UserDataLayer.instance) {
   UserDataLayer.instance = new UserDataLayer();
  }

  return UserDataLayer.instance;
 }

}
