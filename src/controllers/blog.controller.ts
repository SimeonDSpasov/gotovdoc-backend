import { RequestHandler } from 'express';

import CustomError from './../utils/custom-error.utils';

import BlogViewDataLayer from './../data-layers/blog-view.data-layer';

export default class BlogController {

 private logContext = 'Blog Controller';

 private blogViewDataLayer = BlogViewDataLayer.getInstance();

 public trackView: RequestHandler = async (req, res) => {
  const { slug } = req.body;

  if (!slug || typeof slug !== 'string') {
   throw new CustomError(400, 'Missing field: slug');
  }

  const logContext = `${this.logContext} -> trackView()`;

  await this.blogViewDataLayer.incrementView(slug, logContext);

  res.status(200).json();
 }

}
