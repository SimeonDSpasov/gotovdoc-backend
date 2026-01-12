import Redis from 'ioredis';
import logger from '@ipi-soft/logger';

import Config from './../config';

export default class RedisUtil {

  private static client: Redis | null | undefined;

  public static getClient(): Redis | null {
    if (this.client !== undefined) {
      return this.client;
    }

    const config = Config.getInstance();

    if (!config.redis.url) {
      this.client = null;
      return this.client;
    }

    try {
      this.client = new Redis(config.redis.url, {
        lazyConnect: true,
        enableReadyCheck: false,
        maxRetriesPerRequest: 2,
      });

      this.client.on('error', err => {
        const message = err instanceof Error ? err.message : String(err);
        logger.error(message, 'Redis Client Error');
      });

      this.client.connect().catch(err => {
        const message = err instanceof Error ? err.message : String(err);
        logger.error(message, 'Redis Client Connect Error');
      });

      return this.client;
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      logger.error(message, 'Redis Client Init Error');
      this.client = null;
      return this.client;
    }
  }

}

