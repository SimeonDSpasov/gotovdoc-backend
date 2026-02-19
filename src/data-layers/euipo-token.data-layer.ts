import logger from '@ipi-soft/logger';

import { EuipoToken, EUIPO_TOKEN_DOC_ID, IEuipoToken } from './../models/euipo-token.model';

export default class EuipoTokenDataLayer {

  private logContext = 'EUIPO Token Data Layer';

  public async get(logContext: string): Promise<IEuipoToken | null> {
    logContext = `${logContext} -> ${this.logContext} -> get()`;
    try {
      return await EuipoToken.findById(EUIPO_TOKEN_DOC_ID).lean();
    } catch (err: any) {
      logger.error(err.message, logContext);
      return null;
    }
  }

  public async upsert(
    accessToken: string,
    refreshToken: string | null,
    expiresAt: Date,
    logContext: string,
  ): Promise<void> {
    logContext = `${logContext} -> ${this.logContext} -> upsert()`;
    try {
      await EuipoToken.findByIdAndUpdate(
        EUIPO_TOKEN_DOC_ID,
        { accessToken, refreshToken, expiresAt },
        { upsert: true, new: true },
      );
    } catch (err: any) {
      logger.error(err.message, logContext);
    }
  }

  private static instance: EuipoTokenDataLayer;

  public static getInstance(): EuipoTokenDataLayer {
    if (!EuipoTokenDataLayer.instance) {
      EuipoTokenDataLayer.instance = new EuipoTokenDataLayer();
    }
    return EuipoTokenDataLayer.instance;
  }
}
