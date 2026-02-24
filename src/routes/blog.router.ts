import { Router } from 'express';

import CatchUtil from './../utils/catch.util';

import BlogController from './../controllers/blog.controller';

const useCatch = CatchUtil.getUseCatch();
const blogController = new BlogController();

const BlogRouter = Router();

BlogRouter.post('/track-view', useCatch(blogController.trackView));

export default BlogRouter;
