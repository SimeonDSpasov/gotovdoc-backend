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

 private static getRedisKey(templateName: string): string {
  const { keyPrefix } = Config.getInstance().redis;
  return `${keyPrefix}:template:${templateName}`;
 }

 public static async preload(templateName: string): Promise<void> {
  await this.getTemplate(templateName);
 }

 public static async getTemplate(templateName: string): Promise<Buffer> {
  const redisClient = RedisUtil.getClient();

  if (redisClient) {
   const redisBuffer = await redisClient
    .getBuffer(this.getRedisKey(templateName))
    .catch((err: unknown) => {
     const message = err instanceof Error ? err.message : String(err);
     logger.error(message, 'TemplateCache -> Redis get');
     return null;
    });

   if (redisBuffer) {
    return redisBuffer;
   }
  }

  const filePath = path.join(TEMPLATE_BASE_PATH, templateName);
  const buffer = await fs.readFile(filePath);

  if (redisClient) {
   const setPromise = DEFAULT_TTL_SECONDS > 0
    ? redisClient.set(this.getRedisKey(templateName), buffer, 'EX', DEFAULT_TTL_SECONDS)
    : redisClient.set(this.getRedisKey(templateName), buffer);
   await setPromise.catch((err: unknown) => {
    const message = err instanceof Error ? err.message : String(err);
    logger.error(message, 'TemplateCache -> Redis set');
   });
  }

  return buffer;
 }

}

