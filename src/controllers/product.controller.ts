import { Request, Response } from 'express';

import CustomError from './../utils/custom-error.utils';

import { Product, IProduct } from './../models/product.model';

export default class ProductController {
  private readonly logContext = 'Product Controller';

  public async getProductsChunk(req: Request, res: Response): Promise<void> {
    const from = parseInt(req.params.from, 10);
    const to = parseInt(req.params.to, 10);

    if (isNaN(from) || isNaN(to) || from < 0 || to <= from) {
      throw new CustomError(400, 'Invalid parameters. from and to must be positive numbers, and to must be greater than from');
    }

    // Get total count for pagination info
    const total = await Product.countDocuments()
      .catch(err => {
        throw new CustomError(500, err.message, this.logContext);
      });

    // Calculate skip and limit
    const skip = from;
    const limit = to - from;

    // Get products with pagination
    const products = await Product.find()
      .skip(skip)
      .limit(limit)
      .sort({ createdAt: -1 }) // Sort by newest first
      .lean()
      .catch(err => {
        throw new CustomError(500, err.message, this.logContext);
      });

    // Return whatever we got, even if it's fewer than requested
    res.json({
      products,
      total,
      actualCount: products.length,
      requestedCount: limit
    });
  }

  public async getProductById(req: Request, res: Response): Promise<void> {
    const { id } = req.params;

    const product = await Product.findById(id)
      .lean()
      .catch(err => {
        throw new CustomError(500, err.message, this.logContext);
      });

    if (!product) {
      throw new CustomError(404, 'Product not found');
    }

    res.json(product);
  }
}
