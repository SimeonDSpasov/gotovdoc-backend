import logger from '@ipi-soft/logger';

import Config from './../config';
import RedisUtil from './../utils/redis.util';

const BG_POSTCODE_BASE = 'https://bgpostcode.com/api/v1';

export interface BgRegion {
  id: number;
  name: string;
  name_en: string;
  slug: string;
}

export interface BgCity {
  id: number;
  name: string;
  name_en: string;
  slug: string;
  postcode: number | null;
  region_id: number;
  municipality_id: number;
  type_id: number;
}

// Local in-process cache (populated from Redis, avoids Redis roundtrip on every request)
let localRegionsCache: BgRegion[] | null = null;
let localCitiesCache = new Map<number, BgCity[]>();

function getRedisKey(suffix: string): string {
  const { keyPrefix } = Config.getInstance().redis;
  return `${keyPrefix}:locations:${suffix}`;
}

export async function getCachedRegions(): Promise<BgRegion[]> {
  // Return local cache if available
  if (localRegionsCache) return localRegionsCache;

  // Try Redis
  const redis = RedisUtil.getClient();
  if (redis) {
    try {
      const data = await redis.get(getRedisKey('regions'));
      if (data) {
        localRegionsCache = JSON.parse(data) as BgRegion[];
        return localRegionsCache;
      }
    } catch (err: any) {
      logger.error(`Redis get regions failed: ${err.message}`, 'LocationCache');
    }
  }

  return [];
}

export async function getCachedCities(regionId: number): Promise<BgCity[]> {
  // Return local cache if available
  const local = localCitiesCache.get(regionId);
  if (local) return local;

  // Try Redis
  const redis = RedisUtil.getClient();
  if (redis) {
    try {
      const data = await redis.get(getRedisKey(`region:${regionId}:cities`));
      if (data) {
        const cities = JSON.parse(data) as BgCity[];
        localCitiesCache.set(regionId, cities);
        return cities;
      }
    } catch (err: any) {
      logger.error(`Redis get cities failed for region ${regionId}: ${err.message}`, 'LocationCache');
    }
  }

  return [];
}

/**
 * Seeds Bulgarian cities data. Uses a Redis lock so only one worker fetches
 * from the API. Other workers wait and load from Redis once seeding is done.
 */
export async function seedBulgarianCities(): Promise<void> {
  const logContext = 'SeedBulgarianCities';
  const redis = RedisUtil.getClient();
  const lockKey = getRedisKey('seed-lock');
  const maxRetries = 15;
  const retryDelay = 2000;

  // Check if Redis already has the data
  if (redis) {
    try {
      const existing = await redis.get(getRedisKey('regions'));
      if (existing) {
        localRegionsCache = JSON.parse(existing) as BgRegion[];
        logger.info(`Loaded ${localRegionsCache.length} regions from Redis (already seeded).`);
        return;
      }
    } catch (err: any) {
      logger.error(`Redis check failed: ${err.message}`, logContext);
    }
  }

  // Try to acquire lock — only one worker seeds
  if (redis) {
    const acquired = await redis.set(lockKey, '1', 'EX', 60, 'NX').catch(() => null);

    if (!acquired) {
      // Another worker is seeding — wait for it to finish
      logger.info('Another worker is seeding cities, waiting...',);

      for (let i = 0; i < maxRetries; i++) {
        await new Promise(resolve => setTimeout(resolve, retryDelay));

        const existing = await redis.get(getRedisKey('regions')).catch(() => null);
        if (existing) {
          localRegionsCache = JSON.parse(existing) as BgRegion[];
          logger.info(`Loaded ${localRegionsCache.length} regions from Redis (seeded by another worker).`);
          return;
        }
      }

      logger.error('Timed out waiting for another worker to seed cities.', logContext);
      return;
    }
  }

  // This worker does the seeding
  try {
    const regionsResponse = await fetch(`${BG_POSTCODE_BASE}/regions`);
    if (!regionsResponse.ok) {
      throw new Error(`Failed to fetch regions: ${regionsResponse.status}`);
    }

    const regions = (await regionsResponse.json()) as BgRegion[];
    localRegionsCache = regions;

    logger.info(`Fetched ${regions.length} Bulgarian regions.`);

    // Fetch cities for each region in parallel (batched to avoid rate limiting)
    const batchSize = 5;
    for (let i = 0; i < regions.length; i += batchSize) {
      const batch = regions.slice(i, i + batchSize);

      const results = await Promise.allSettled(
        batch.map(async (region) => {
          const response = await fetch(`${BG_POSTCODE_BASE}/regions/${region.id}/city`);
          if (!response.ok) {
            throw new Error(`Failed to fetch cities for region ${region.id}: ${response.status}`);
          }

          const cities = (await response.json()) as BgCity[];

          cities.sort((a, b) => {
            if (a.type_id !== b.type_id) return b.type_id - a.type_id;
            return a.name.localeCompare(b.name, 'bg');
          });

          localCitiesCache.set(region.id, cities);

          if (redis) {
            await redis.set(getRedisKey(`region:${region.id}:cities`), JSON.stringify(cities)).catch((err: any) => {
              logger.error(`Redis set cities failed for region ${region.id}: ${err.message}`, logContext);
            });
          }

          return cities.length;
        })
      );

      const failed = results.filter(r => r.status === 'rejected');
      if (failed.length > 0) {
        logger.error(`${failed.length} region(s) failed to fetch cities in batch ${i / batchSize + 1}`, logContext);
      }
    }

    // Store regions in Redis last — this signals to other workers that seeding is complete
    if (redis) {
      await redis.set(getRedisKey('regions'), JSON.stringify(regions)).catch((err: any) => {
        logger.error(`Redis set regions failed: ${err.message}`, logContext);
      });
    }

    const totalCities = Array.from(localCitiesCache.values()).reduce((sum, cities) => sum + cities.length, 0);
    logger.info(`Cached ${totalCities} cities across ${localCitiesCache.size} regions in Redis.`);
  } catch (err: any) {
    logger.error(`Failed to seed Bulgarian cities: ${err.message}`, logContext);
  } finally {
    // Release lock
    if (redis) {
      await redis.del(lockKey).catch(() => {});
    }
  }
}
