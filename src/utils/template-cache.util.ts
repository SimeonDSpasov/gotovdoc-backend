import { promises as fs } from 'fs';
import path from 'path';

import logger from '@ipi-soft/logger';

import Config from './../config';
import RedisUtil from './redis.util';

const TEMPLATE_BASE_PATH = process.env.DOC_TEMPLATE_DIR
  ? path.resolve(process.cwd(), process.env.DOC_TEMPLATE_DIR)
  : path.join(process.cwd(), 'src', 'assets', 'docs');

const DEFAULT_TTL_SECONDS = Number(process.env.DOC_TEMPLATE_CACHE_TTL_SECONDS ?? 0) || 0;

export default class TemplateCacheUtil {

  private static memoryCache = new Map<string, Buffer>();

  private static getRedisKey(templateName: string): string {
    const { keyPrefix } = Config.getInstance().redis;

    return `${keyPrefix}:template:${templateName}`;
  }

  public static async preload(templateName: string): Promise<void> {
    await this.getTemplate(templateName);
  }

  public static async getTemplate(templateName: string): Promise<Buffer> {
    const cached = this.memoryCache.get(templateName);
    if (cached) {
      return cached;
    }

    const redisClient = RedisUtil.getClient();

    if (redisClient) {
      try {
        const redisBuffer = await redisClient.getBuffer(this.getRedisKey(templateName));

        if (redisBuffer) {
          this.memoryCache.set(templateName, redisBuffer);

          return redisBuffer;
        }
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        logger.error(message, 'TemplateCache -> Redis get');
      }
    }

    const filePath = path.join(TEMPLATE_BASE_PATH, templateName);
    const buffer = await fs.readFile(filePath);

    this.memoryCache.set(templateName, buffer);

    if (redisClient) {
      try {
        if (DEFAULT_TTL_SECONDS > 0) {
          await redisClient.set(this.getRedisKey(templateName), buffer, 'EX', DEFAULT_TTL_SECONDS);
        } else {
          await redisClient.set(this.getRedisKey(templateName), buffer);
        }
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        logger.error(message, 'TemplateCache -> Redis set');
      }
    }

    return buffer;
  }

  public static clearMemoryCache(): void {
    this.memoryCache.clear();
  }

}

