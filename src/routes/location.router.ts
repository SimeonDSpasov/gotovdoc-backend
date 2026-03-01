import { Router } from 'express';

import CatchUtil from './../utils/catch.util';
import LocationController from './../controllers/location.controller';

const useCatch = CatchUtil.getUseCatch();
const locationController = new LocationController();

const LocationRouter = Router();

LocationRouter.get(
  '/regions',
  useCatch(locationController.getRegions)
);

LocationRouter.get(
  '/regions/:regionId/cities',
  useCatch(locationController.getCitiesByRegion)
);

export default LocationRouter;
