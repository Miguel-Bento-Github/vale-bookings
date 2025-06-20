import { Request, Response } from 'express';

import {
  getAllLocations,
  findNearby,
  getLocationById as findLocationById,
  createLocation as createNewLocation,
  updateLocation as updateExistingLocation,
  deleteLocation as deleteExistingLocation,
  searchLocations as searchLocationsService,
  getLocationAvailability as getLocationAvailabilityService,
  getLocationTimeslots as getLocationTimeslotsService
} from '../services/LocationService';
import { AuthenticatedRequest } from '../types';
import {
  sendSuccess,
  sendError,
  withErrorHandling
} from '../utils/responseHelpers';
import { validateCoordinates } from '../utils/validation';
import {
  validateRequiredId,
  parseCoordinatesFromQuery,
  validateLocationData,
  validateDateParam
} from '../utils/validationHelpers';

export const getLocations = withErrorHandling(async (req: Request, res: Response): Promise<void> => {
  const locations = await getAllLocations();
  sendSuccess(res, locations);
});

export const getNearbyLocations = withErrorHandling(async (req: Request, res: Response): Promise<void> => {
  const { latitude, longitude, radius } = parseCoordinatesFromQuery(req);

  if (typeof latitude !== 'number' || typeof longitude !== 'number') {
    sendError(res, 'Latitude and longitude are required', 400);
    return;
  }

  const coordinateError = validateCoordinates(latitude, longitude);
  if (coordinateError) {
    sendError(res, coordinateError, 400);
    return;
  }

  const radiusInKm = radius && radius > 0 ? radius : 10;

  const locations = await findNearby(latitude, longitude, radiusInKm);
  sendSuccess(res, locations);
});

export const getLocationById = withErrorHandling(async (req: Request, res: Response): Promise<void> => {
  const { id } = req.params;

  if (!validateRequiredId(id, res, 'Location ID')) {
    return;
  }

  const location = await findLocationById(id);

  if (!location) {
    sendError(res, 'Location not found', 404);
    return;
  }

  sendSuccess(res, location);
});

export const createLocation = withErrorHandling(async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  // Check admin role
  if (!req.user || req.user.role !== 'ADMIN') {
    sendError(res, 'Forbidden: access denied', 403);
    return;
  }

  const validationErrors = validateLocationData(req.body);
  if (validationErrors.length > 0) {
    sendError(res, validationErrors[0], 400);
    return;
  }

  const location = await createNewLocation(req.body);
  sendSuccess(res, location, 'Location created successfully', 201);
});

export const updateLocation = withErrorHandling(async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  // Check admin role
  if (!req.user || req.user.role !== 'ADMIN') {
    sendError(res, 'Forbidden: access denied', 403);
    return;
  }

  const { id } = req.params;

  if (!validateRequiredId(id, res, 'Location ID')) {
    return;
  }

  const { coordinates } = req.body;

  // Validate coordinates if provided in update
  if (coordinates && typeof coordinates === 'object' && coordinates !== null) {
    const coordError = validateCoordinates(coordinates.latitude, coordinates.longitude);
    if (coordError) {
      sendError(res, coordError, 400);
      return;
    }
  }

  const location = await updateExistingLocation(id, req.body);

  if (!location) {
    sendError(res, 'Location not found', 404);
    return;
  }

  sendSuccess(res, location, 'Location updated successfully');
});

export const deleteLocation = withErrorHandling(async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  // Check admin role
  if (!req.user || req.user.role !== 'ADMIN') {
    sendError(res, 'Forbidden: access denied', 403);
    return;
  }

  const { id } = req.params;

  if (!validateRequiredId(id, res, 'Location ID')) {
    return;
  }

  await deleteExistingLocation(id);
  sendSuccess(res, undefined, 'Location deleted successfully');
});

export const searchLocations = withErrorHandling(async (req: Request, res: Response): Promise<void> => {
  const { q } = req.query;

  if (!q || typeof q !== 'string' || q.trim().length === 0) {
    sendError(res, 'Search query is required', 400);
    return;
  }

  const locations = await searchLocationsService(q);
  sendSuccess(res, locations);
});

export const getLocationAvailability = withErrorHandling(async (req: Request, res: Response): Promise<void> => {
  const { id } = req.params;
  const { date } = req.query;

  if (!validateRequiredId(id, res, 'Location ID')) {
    return;
  }

  const parsedDate = validateDateParam(date as string);
  if (!parsedDate) {
    sendError(res, 'Valid date parameter is required', 400);
    return;
  }

  const availability = await getLocationAvailabilityService(id, parsedDate);
  sendSuccess(res, availability);
});

export const getLocationTimeSlots = withErrorHandling(async (req: Request, res: Response): Promise<void> => {
  const { id } = req.params;
  const { date } = req.query;

  if (!validateRequiredId(id, res, 'Location ID')) {
    return;
  }

  const parsedDate = validateDateParam(date as string);
  if (!parsedDate) {
    sendError(res, 'Valid date parameter is required', 400);
    return;
  }

  const timeSlots = await getLocationTimeslotsService(id, parsedDate);
  sendSuccess(res, timeSlots);
});

export const getRealtimeAvailability = withErrorHandling(async (req: Request, res: Response): Promise<void> => {
  const { id } = req.params;

  if (!validateRequiredId(id, res, 'Location ID')) {
    return;
  }

  // Mock realtime availability data
  const availability = {
    locationId: id,
    timestamp: new Date(),
    availableSpots: 15,
    totalSpots: 20,
    occupancyRate: 0.75
  };

  sendSuccess(res, availability);
}); 