import mongoose, { Schema, Types } from 'mongoose';

import bcryptjs from 'bcryptjs';

import ErrorUtil from './../utils/error.util';
import Config from './../config';

enum UserRole {
  Member,
  Moderator,
  Admin
}

enum ApiKeyStatus {
  Active,
  Tournament,
  Disabled,
}

export enum UserRank {
  Basic,
  Holder,
  Ninja,
}

interface IUser {
  role: UserRole;
  email: string;
  password: string;
  firstName: string;
  lastName: string;
  suspended: boolean,
  activity?: IUserActivity[];
  createdAt: Date;
}

interface IUserActivity {
  type: 'document_generated' | 'document_downloaded' | 'trademark_order_created' | 'trademark_poa_downloaded' | 'order_created';
  documentId?: Types.ObjectId;
  orderId?: string;
  orderType?: string;
  documentName?: string;
  createdAt: Date;
}

const UserSchema = new mongoose.Schema<IUser>({
  role: {
    type: Number,
    default: UserRole.Member,
  },
  email: {
    type: String,
    required: true,
    unique: true
  },
  password: {
    type: String,
    required: true
  },
  firstName: {
    type: String,
    required: true
  },
  lastName: {
    type: String,
    required: true
  },
  suspended: {
    type: Boolean,
    default: false,
  },
  activity: {
    type: [{
      type: {
        type: String,
        enum: ['document_generated', 'document_downloaded', 'trademark_order_created', 'trademark_poa_downloaded'],
        required: true,
      },
      documentId: {
        type: Schema.Types.ObjectId,
        required: false,
      },
      orderId: {
        type: String,
        required: false,
      },
      documentName: {
        type: String,
        required: false,
      },
      createdAt: {
        type: Date,
        default: () => new Date(),
      },
    }],
    default: [],
  },
},
{
  timestamps: true,
  collection: 'users'
})

UserSchema.set('toJSON', {
  virtuals: true,
  versionKey: false,
  transform: function (doc: any, ret: any) { delete ret._id; delete ret.password }
});

UserSchema.set('toObject', {
  virtuals: true,
  versionKey: false,
  transform: function (doc: any, ret: any) { delete ret._id; delete ret.password }
});


UserSchema.pre<UserDoc>('save', async function (next): Promise<void> {
  if(!this.isModified('password')) {
    return next();
  }

  const salt = await bcryptjs.genSalt(12);

  this.password = await bcryptjs.hash(this.password, salt);
})

const db = mongoose.connection.useDb(Config.getInstance().databases.main);
const User = db.model<IUser>('User', UserSchema);

type UserDoc = ReturnType<(typeof User)['hydrate']>;

export { User, UserDoc, IUser, IUserActivity, UserRole };
