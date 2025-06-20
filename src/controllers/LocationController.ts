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
  validateUserRole,
  validateCoordinatesFromQuery,
  validateDateParam,
  validateRequiredString
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

  // TypeScript now knows latitude and longitude are defined
  const radiusInKm = radius && radius > 0 ? radius : 10;
  const locations = await findNearby(latitude!, longitude!, radiusInKm);

  sendSuccess(res, locations);
});

export const getLocationById = withErrorHandling(async (req: Request, res: Response): Promise<void> => {
  const { id } = req.params;

  if (!validateRequiredId(id, res, 'Location ID')) {
    return;
  }

  // TypeScript knows id is not undefined after validation
  const location = await findLocationById(id!);

  if (!location) {
    sendError(res, 'Location not found', 404);
    return;
  }

  sendSuccess(res, location);
});

export const createLocation = withErrorHandling(async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  if (!req.user || !validateUserRole(req.user.role, 'ADMIN', res)) {
    return;
  }

  const { name, address, coordinates } = req.body;

  if (!validateLocationData(name, address, coordinates, res)) {
    return;
  }

  // Additional coordinate validation if provided
  if (coordinates && !validateCoordinates(coordinates.latitude, coordinates.longitude)) {
    sendError(res, 'Invalid coordinates', 400);
    return;
  }

  const location = await createNewLocation(req.body);
  sendSuccess(res, location, 'Location created successfully', 201);
});

export const updateLocation = withErrorHandling(async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  if (!req.user || !validateUserRole(req.user.role, 'ADMIN', res)) {
    return;
  }

  const { id } = req.params;

  if (!validateRequiredId(id, res, 'Location ID')) {
    return;
  }

  const { coordinates } = req.body;

  // Validate coordinates if provided in update
  if (coordinates && !validateCoordinates(coordinates.latitude, coordinates.longitude)) {
    sendError(res, 'Invalid coordinates', 400);
    return;
  }

  const location = await updateExistingLocation(id!, req.body);

  if (!location) {
    sendError(res, 'Location not found', 404);
    return;
  }

  sendSuccess(res, location, 'Location updated successfully');
});

export const deleteLocation = withErrorHandling(async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  if (!req.user || !validateUserRole(req.user.role, 'ADMIN', res)) {
    return;
  }

  const { id } = req.params;

  if (!validateRequiredId(id, res, 'Location ID')) {
    return;
  }

  await deleteExistingLocation(id!);
  sendSuccess(res, undefined, 'Location deleted successfully');
});

export const searchLocations = withErrorHandling(async (req: Request, res: Response): Promise<void> => {
  const { q } = req.query;

  if (!validateRequiredString(q as string, 'Search query', res)) {
    return;
  }

  const locations = await searchLocationsService(q as string);
  sendSuccess(res, locations);
});

export const getLocationAvailability = withErrorHandling(async (req: Request, res: Response): Promise<void> => {
  const { id } = req.params;
  const { date } = req.query;

  if (!validateRequiredId(id, res, 'Location ID')) {
    return;
  }

  const parsedDate = validateDateParam(date as string, res);
  if (!parsedDate) {
    return;
  }

  const availability = await getLocationAvailabilityService(id!, parsedDate);
  sendSuccess(res, availability);
});

export const getLocationTimeSlots = withErrorHandling(async (req: Request, res: Response): Promise<void> => {
  const { id } = req.params;
  const { date } = req.query;

  if (!validateRequiredId(id, res, 'Location ID')) {
    return;
  }

  const parsedDate = validateDateParam(date as string, res);
  if (!parsedDate) {
    return;
  }

  const timeSlots = await getLocationTimeslotsService(id!, parsedDate);
  sendSuccess(res, timeSlots);
});

export const getRealtimeAvailability = withErrorHandling(async (req: Request, res: Response): Promise<void> => {
  const { id } = req.params;

  if (!validateRequiredId(id, res, 'Location ID')) {
    return;
  }

  // Mock realtime availability data
  const availability = {
    locationId: id!,
    timestamp: new Date(),
    availableSpots: 15,
    totalSpots: 20,
    occupancyRate: 0.75
  };

  sendSuccess(res, availability);
}); 