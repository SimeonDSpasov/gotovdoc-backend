import { RequestHandler } from 'express';

import CustomError from '../utils/custom-error.utils';
import NkpdDataLayer from '../data-layers/nkpd.data-layer';

export default class NkpdController {

 public search: RequestHandler = async (req, res) => {
  const query = (req.query.q as string || '').trim();
  const limit = Math.min(parseInt(req.query.limit as string, 10) || 50, 200);

  if (query.length < 2) {
   throw new CustomError(400, 'Търсенето изисква поне 2 символа');
  }

  const results = await NkpdDataLayer.getInstance().search(query, limit, 'NkpdController -> search');

  res.json({ status: 200, data: results });
 };

}
