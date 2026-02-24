import { RequestHandler } from 'express';

import CustomError from './../utils/custom-error.utils';
import EuipoService from './../services/euipo.service';
import EuipoCacheDataLayer from './../data-layers/euipo-cache.data-layer';

export default class EuipoController {

 private euipoService = EuipoService.getInstance();
 private cacheDataLayer = EuipoCacheDataLayer.getInstance();

 /**
 * GET /api/trademark/class-headings
 * Returns classNumber + heading + totalTerms for all 45 classes.
 */
 public getClassHeadings: RequestHandler = async (req, res) => {
  const data = await this.euipoService.getClassHeadings();

  res.status(200).json({ success: true, data });
 }

 /**
 * GET /api/trademark/class-terms?classNumber=5&page=0&size=100
 * Returns paginated terms for a single class (no search filter).
 */
 public getClassTerms: RequestHandler = async (req, res) => {
  const { classNumber, page, size } = req.query;

  if (!classNumber) {
   throw new CustomError(400, 'Query parameter "classNumber" is required');
  }

  const classNum = parseInt(classNumber as string, 10);

  if (isNaN(classNum) || classNum < 1 || classNum > 45) {
   throw new CustomError(400, 'classNumber must be between 1 and 45');
  }

  const pageNum = parseInt(page as string, 10) || 0;
  const sizeNum = parseInt(size as string, 10) || 100;

  const data = await this.euipoService.getClassTerms(
   classNum,
   pageNum,
   Math.min(sizeNum, 100),
  );

  res.status(200).json({ success: true, data });
 }

 /**
 * GET /api/trademark/search-terms?classNumber=9&termText=da&page=0&size=15
 * Searches cached terms in MongoDB. classNumber can be comma-separated (e.g. "1,9,42").
 */
 public searchTerms: RequestHandler = async (req, res) => {
  const { classNumber, termText, page, size } = req.query;

  if (!termText) {
   throw new CustomError(400, 'Query parameter "termText" is required');
  }

  const classNumbers = classNumber
   ? (classNumber as string).split(',').map(n => parseInt(n.trim(), 10)).filter(n => !isNaN(n))
   : undefined;

  const pageNum = parseInt(page as string, 10) || 0;
  const sizeNum = parseInt(size as string, 10) || 15;

  const data = await this.euipoService.searchTerms(
   termText as string,
   classNumbers,
   pageNum,
   Math.min(sizeNum, 100),
  );

  res.status(200).json({ success: true, data });
 }

 /**
 * GET /api/trademark/class-descriptions
 * Returns classNumber + description for all 45 classes.
 */
 public getClassDescriptions: RequestHandler = async (req, res) => {
  const data = await this.euipoService.getClassDescriptions();

  res.status(200).json({ success: true, data });
 }

 /**
 * GET /api/trademark/cache-stats
 * Returns sync status per class (for monitoring/admin).
 */
 public getCacheStats: RequestHandler = async (req, res) => {
  const stats = await this.cacheDataLayer.getStats('EuipoController -> getCacheStats');

  res.status(200).json({ success: true, data: stats });
 }
}
