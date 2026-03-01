import { RequestHandler } from 'express';
import CustomError from '../utils/custom-error.utils';
import { getCachedRegions, getCachedCities } from '../data/bulgarian-cities-seed';

export default class LocationController {

  public getRegions: RequestHandler = async (_req, res) => {
    const regions = await getCachedRegions();

    if (!regions.length) {
      throw new CustomError(503, 'Данните за областите все още не са заредени');
    }

    res.json({ status: 200, data: regions });
  };

  public getCitiesByRegion: RequestHandler = async (req, res) => {
    const regionId = parseInt(req.params.regionId, 10);

    if (isNaN(regionId) || regionId < 1) {
      throw new CustomError(400, 'Невалиден идентификатор на област');
    }

    const cities = await getCachedCities(regionId);

    if (!cities.length) {
      throw new CustomError(404, 'Няма намерени градове за тази област');
    }

    res.json({ status: 200, data: cities });
  };
}
