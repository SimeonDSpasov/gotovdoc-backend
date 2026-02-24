import CustomError from './../utils/custom-error.utils';

import { BlogView, BlogViewDoc } from './../models/blog-view.model';

export default class BlogViewDataLayer {

 private logContext = 'Blog View Data Layer';

 public async incrementView(slug: string, logContext: string): Promise<BlogViewDoc> {
  logContext = `${logContext} -> ${this.logContext} -> incrementView()`;

  const blogView = await BlogView.findOneAndUpdate(
   { slug },
   { $inc: { views: 1 } },
   { upsert: true, new: true }
  )
   .catch(err => {
    throw new CustomError(500, err.message, `${logContext} -> slug: ${slug}`);
   });

  return blogView;
 }

 private static instance: BlogViewDataLayer;

 public static getInstance(): BlogViewDataLayer {
  if (!BlogViewDataLayer.instance) {
   BlogViewDataLayer.instance = new BlogViewDataLayer();
  }

  return BlogViewDataLayer.instance;
 }

}
