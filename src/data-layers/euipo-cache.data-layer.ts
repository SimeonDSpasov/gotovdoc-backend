import logger from '@ipi-soft/logger';

import { EuipoClass, IEuipoClass, IEuipoTerm } from './../models/euipo-cache.model';

interface ClassHeading {
  classNumber: number;
  heading: string;
  description: string;
  totalTerms: number;
  syncedAt: Date | null;
}

interface TermSearchResult {
  terms: IEuipoTerm[];
  totalElements: number;
  page: number;
  size: number;
}

export default class EuipoCacheDataLayer {

  private logContext = 'EUIPO Cache Data Layer';

  public async getByClassNumber(classNumber: number, logContext: string): Promise<IEuipoClass | null> {
    logContext = `${logContext} -> ${this.logContext} -> getByClassNumber()`;

    try {
      return await EuipoClass.findOne({ classNumber }).lean();
    } catch (err: any) {
      logger.error(`${err.message} -> classNumber: ${classNumber}`, logContext);
      return null;
    }
  }

  public async getAllClasses(logContext: string): Promise<ClassHeading[]> {
    logContext = `${logContext} -> ${this.logContext} -> getAllClasses()`;

    try {
      const docs = await EuipoClass.find({}, { classNumber: 1, heading: 1, description: 1, totalTerms: 1, syncedAt: 1 })
        .sort({ classNumber: 1 })
        .lean();

      return docs.map(d => ({
        classNumber: d.classNumber,
        heading: d.heading,
        description: d.description,
        totalTerms: d.totalTerms,
        syncedAt: d.syncedAt,
      }));
    } catch (err: any) {
      logger.error(err.message, logContext);
      return [];
    }
  }

  public async upsertClass(
    classNumber: number,
    heading: string,
    description: string,
    terms: IEuipoTerm[],
    totalTerms: number,
    logContext: string,
  ): Promise<void> {
    logContext = `${logContext} -> ${this.logContext} -> upsertClass()`;

    try {
      await EuipoClass.findOneAndUpdate(
        { classNumber },
        { classNumber, heading, description, terms, totalTerms, syncedAt: new Date() },
        { upsert: true, new: true },
      );
    } catch (err: any) {
      logger.error(`${err.message} -> classNumber: ${classNumber}`, logContext);
    }
  }

  public async upsertDescription(
    classNumber: number,
    description: string,
    logContext: string,
  ): Promise<void> {
    logContext = `${logContext} -> ${this.logContext} -> upsertDescription()`;

    try {
      await EuipoClass.findOneAndUpdate(
        { classNumber },
        { $set: { description }, $setOnInsert: { classNumber, heading: '', terms: [], totalTerms: 0, syncedAt: null } },
        { upsert: true },
      );
    } catch (err: any) {
      logger.error(`${err.message} -> classNumber: ${classNumber}`, logContext);
    }
  }

  public async getClassDescriptions(logContext: string): Promise<{ classNumber: number; description: string }[]> {
    logContext = `${logContext} -> ${this.logContext} -> getClassDescriptions()`;

    try {
      const docs = await EuipoClass.find({}, { classNumber: 1, description: 1 })
        .sort({ classNumber: 1 })
        .lean();

      return docs.map(d => ({
        classNumber: d.classNumber,
        description: d.description,
      }));
    } catch (err: any) {
      logger.error(err.message, logContext);
      return [];
    }
  }

  public async getClassTerms(
    classNumber: number,
    page: number,
    size: number,
    logContext: string,
  ): Promise<TermSearchResult> {
    logContext = `${logContext} -> ${this.logContext} -> getClassTerms()`;

    try {
      const pipeline: any[] = [
        { $match: { classNumber } },
        { $unwind: '$terms' },
        {
          $facet: {
            metadata: [{ $count: 'total' }],
            data: [
              { $skip: page * size },
              { $limit: size },
              {
                $project: {
                  _id: 0,
                  text: '$terms.text',
                  conceptId: '$terms.conceptId',
                  taxonomyParentId: '$terms.taxonomyParentId',
                  classNumber: '$classNumber',
                },
              },
            ],
          },
        },
      ];

      const [result] = await EuipoClass.aggregate(pipeline);

      const totalElements = result.metadata[0]?.total || 0;

      return {
        terms: result.data,
        totalElements,
        page,
        size,
      };
    } catch (err: any) {
      logger.error(`${err.message} -> classNumber: ${classNumber}`, logContext);
      return { terms: [], totalElements: 0, page, size };
    }
  }

  public async searchTerms(
    termText: string,
    classNumbers: number[] | undefined,
    page: number,
    size: number,
    logContext: string,
  ): Promise<TermSearchResult> {
    logContext = `${logContext} -> ${this.logContext} -> searchTerms()`;

    try {
      const match: Record<string, any> = {};

      if (classNumbers && classNumbers.length > 0) {
        match.classNumber = { $in: classNumbers };
      }

      const regex = new RegExp(termText.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i');

      const pipeline: any[] = [
        { $match: match },
        { $unwind: '$terms' },
        { $match: { 'terms.text': regex } },
        {
          $facet: {
            metadata: [{ $count: 'total' }],
            data: [
              { $skip: page * size },
              { $limit: size },
              {
                $project: {
                  _id: 0,
                  text: '$terms.text',
                  conceptId: '$terms.conceptId',
                  taxonomyParentId: '$terms.taxonomyParentId',
                  classNumber: '$classNumber',
                },
              },
            ],
          },
        },
      ];

      const [result] = await EuipoClass.aggregate(pipeline);

      const totalElements = result.metadata[0]?.total || 0;

      return {
        terms: result.data,
        totalElements,
        page,
        size,
      };
    } catch (err: any) {
      logger.error(`${err.message} -> termText: ${termText}`, logContext);
      return { terms: [], totalElements: 0, page, size };
    }
  }

  public async getStaleClasses(maxAgeMs: number, logContext: string): Promise<number[]> {
    logContext = `${logContext} -> ${this.logContext} -> getStaleClasses()`;

    try {
      const cutoff = new Date(Date.now() - maxAgeMs);

      const staleDocs = await EuipoClass.find(
        { $or: [{ syncedAt: null }, { syncedAt: { $lt: cutoff } }] },
        { classNumber: 1 },
      ).lean();

      const staleNumbers = staleDocs.map(d => d.classNumber);

      // Also find missing classes (1-45 that don't exist yet)
      const allDocs = await EuipoClass.find({}, { classNumber: 1 }).lean();
      const existingSet = new Set(allDocs.map(d => d.classNumber));

      for (let i = 1; i <= 45; i++) {
        if (!existingSet.has(i) && !staleNumbers.includes(i)) {
          staleNumbers.push(i);
        }
      }

      return staleNumbers.sort((a, b) => a - b);
    } catch (err: any) {
      logger.error(err.message, logContext);
      return Array.from({ length: 45 }, (_, i) => i + 1);
    }
  }

  public async getStats(logContext: string): Promise<{ classNumber: number; totalTerms: number; syncedAt: Date | null }[]> {
    logContext = `${logContext} -> ${this.logContext} -> getStats()`;

    try {
      const docs = await EuipoClass.find({}, { classNumber: 1, totalTerms: 1, syncedAt: 1 })
        .sort({ classNumber: 1 })
        .lean();

      return docs.map(d => ({
        classNumber: d.classNumber,
        totalTerms: d.totalTerms,
        syncedAt: d.syncedAt,
      }));
    } catch (err: any) {
      logger.error(err.message, logContext);
      return [];
    }
  }

  private static instance: EuipoCacheDataLayer;

  public static getInstance(): EuipoCacheDataLayer {
    if (!EuipoCacheDataLayer.instance) {
      EuipoCacheDataLayer.instance = new EuipoCacheDataLayer();
    }

    return EuipoCacheDataLayer.instance;
  }
}
