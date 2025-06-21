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
import { AuthenticatedRequest, ILocation } from '../types';
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
  validateDateParam,
  validateCoordinatesFromQuery
} from '../utils/validationHelpers';

export const getLocations = withErrorHandling(async (req: Request, res: Response): Promise<void> => {
  const locations = await getAllLocations();
  sendSuccess(res, locations);
});

export const getNearbyLocations = withErrorHandling(async (req: Request, res: Response): Promise<void> => {
  const { latitude, longitude, radius } = parseCoordinatesFromQuery(req);

  if (!validateCoordinatesFromQuery(latitude, longitude, res)) {
    return;
  }

  const radiusInKm = (radius !== undefined && radius > 0) ? radius : 10;

  // Since validateCoordinatesFromQuery passed, we know latitude and longitude are defined
  const locations = await findNearby(latitude as number, longitude as number, radiusInKm);
  sendSuccess(res, locations);
});

export const getLocationById = withErrorHandling(async (req: Request, res: Response): Promise<void> => {
  const { id } = req.params;

  if (!validateRequiredId(id, res, 'Location ID')) {
    return;
  }

  const location = await findLocationById(id as string);

  if (location === null) {
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

  const requestBody = req.body as Record<string, unknown>;
  const validationErrors = validateLocationData(requestBody);
  if (validationErrors.length > 0) {
    const errorMessage = validationErrors[0] ?? 'Validation error';
    sendError(res, errorMessage, 400);
    return;
  }

  // After validation, we can safely construct the ILocation object
  const locationData: ILocation = {
    name: requestBody.name as string,
    address: requestBody.address as string,
    coordinates: requestBody.coordinates as ILocation['coordinates'],
    isActive: requestBody.isActive as boolean ?? true
  };
  const location = await createNewLocation(locationData);
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

  // Type the request body safely
  const requestBody = req.body as Record<string, unknown>;
  const { coordinates } = requestBody;

  // Validate coordinates if provided in update
  if (coordinates !== undefined && typeof coordinates === 'object' && coordinates !== null) {
    const coordsObj = coordinates as Record<string, unknown>;
    if (typeof coordsObj.latitude === 'number' && typeof coordsObj.longitude === 'number') {
      if (!validateCoordinates(coordsObj.latitude, coordsObj.longitude)) {
        sendError(res, 'Invalid coordinates', 400);
        return;
      }
    } else {
      sendError(res, 'Invalid coordinates format', 400);
      return;
    }
  }

  const location = await updateExistingLocation(id as string, requestBody);

  if (location === null) {
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

  await deleteExistingLocation(id as string);
  sendSuccess(res, undefined, 'Location deleted successfully');
});

export const searchLocations = withErrorHandling(async (req: Request, res: Response): Promise<void> => {
  const { q } = req.query;

  if (q === undefined || typeof q !== 'string' || q.trim().length === 0) {
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

  if (date === undefined || typeof date !== 'string' || date.trim().length === 0) {
    sendError(res, 'Date parameter is required', 400);
    return;
  }

  const parsedDate = validateDateParam(date);
  if (parsedDate === null) {
    sendError(res, 'Invalid date format', 400);
    return;
  }

  const availability = await getLocationAvailabilityService(id as string, parsedDate);
  sendSuccess(res, availability);
});

export const getLocationTimeSlots = withErrorHandling(async (req: Request, res: Response): Promise<void> => {
  const { id } = req.params;
  const { date } = req.query;

  if (!validateRequiredId(id, res, 'Location ID')) {
    return;
  }

  if (date === undefined || typeof date !== 'string' || date.trim().length === 0) {
    sendError(res, 'Date parameter is required', 400);
    return;
  }

  const parsedDate = validateDateParam(date);
  if (parsedDate === null) {
    sendError(res, 'Invalid date format', 400);
    return;
  }

  const timeSlots = await getLocationTimeslotsService(id as string, parsedDate);
  sendSuccess(res, timeSlots);
});

export const getRealtimeAvailability = withErrorHandling(async (req: Request, res: Response): Promise<void> => {
  const { id } = req.params;

  if (!validateRequiredId(id, res, 'Location ID')) {
    return;
  }

  // Mock realtime availability data - this is synchronous but wrapped in async
  await Promise.resolve(); // Add minimal async operation to satisfy require-await

  const availability = {
    locationId: id as string,
    timestamp: new Date(),
    availableSpots: 15,
    totalSpots: 20,
    occupancyRate: 0.75
  };

  sendSuccess(res, availability);
}); 