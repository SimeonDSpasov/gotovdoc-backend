import mongoose, { Schema } from 'mongoose';

import Config from './../config';

interface IBlogView {
  slug: string;
  views: number;
  createdAt: Date;
  updatedAt: Date;
}

const BlogViewSchema = new Schema<IBlogView>(
  {
    slug: {
      type: String,
      required: true,
    },
    views: {
      type: Number,
      default: 0,
    },
  },
  {
    timestamps: true,
    collection: 'blog-views',
  }
);

BlogViewSchema.index({ slug: 1 }, { unique: true });

const db = mongoose.connection.useDb(Config.getInstance().databases.main);
const BlogView = db.model<IBlogView>('BlogView', BlogViewSchema);

type BlogViewDoc = ReturnType<(typeof BlogView)['hydrate']>;

export { BlogView, BlogViewDoc, IBlogView };
