import { Request, Response } from 'express';
import mongoose from 'mongoose';

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
import { AppError, AuthenticatedRequest } from '../types';
import { validateCoordinates } from '../utils/validation';
import {
  sendSuccess,
  sendError,
  withErrorHandling
} from '../utils/responseHelpers';
import {
  validateRequiredId,
  parseCoordinatesFromQuery,
  validateLocationData,
  validateUserRole
} from '../utils/validationHelpers';

export const getLocations = withErrorHandling(async (req: Request, res: Response): Promise<void> => {
  const locations = await getAllLocations();
  sendSuccess(res, locations);
});

export const getNearbyLocations = withErrorHandling(async (req: Request, res: Response): Promise<void> => {
  const coords = parseCoordinatesFromQuery(req);

  if (!coords) {
    sendError(res, 'Latitude and longitude are required', 400);
    return;
  }

  if (!validateCoordinates(coords.lat, coords.lng)) {
    sendError(res, 'Invalid coordinates', 400);
    return;
  }

  if (coords.radius !== undefined && coords.radius <= 0) {
    sendError(res, 'Invalid radius parameter', 400);
    return;
  }

  const locations = await findNearby(coords.lat, coords.lng, coords.radius);
  sendSuccess(res, locations);
});

export const getLocationById = withErrorHandling(async (req: Request, res: Response): Promise<void> => {
  const { id } = req.params;

  if (!validateRequiredId(id, res, 'Location ID')) {
    return;
  }

  const location = await findLocationById(id!);

  if (!location) {
    sendError(res, 'Location not found', 404);
    return;
  }

  sendSuccess(res, location);
});

export const createLocation = withErrorHandling(async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  if (!validateUserRole(req.user?.role, 'ADMIN', res)) {
    return;
  }

  if (!validateLocationData(req.body, res)) {
    return;
  }

  const requestBody = req.body as Record<string, unknown>;
  const { name, address, coordinates } = requestBody;
  const coordsObj = coordinates as Record<string, unknown>;

  const location = await createNewLocation({
    name: name as string,
    address: address as string,
    coordinates: {
      latitude: coordsObj.latitude as number,
      longitude: coordsObj.longitude as number
    },
    isActive: true
  });

  sendSuccess(res, location, 'Location created successfully', 201);
});

export const updateLocation = withErrorHandling(async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  const { id } = req.params;

  if (!validateUserRole(req.user?.role, 'ADMIN', res)) {
    return;
  }

  if (!validateRequiredId(id, res, 'Location ID')) {
    return;
  }

  const requestBody = req.body as Record<string, unknown>;
  const updateData: Record<string, unknown> = {};

  // Validate and add fields if provided
  if (requestBody.name !== undefined) {
    if (typeof requestBody.name !== 'string') {
      sendError(res, 'Invalid name format', 400);
      return;
    }
    updateData.name = requestBody.name;
  }

  if (requestBody.address !== undefined) {
    if (typeof requestBody.address !== 'string') {
      sendError(res, 'Invalid address format', 400);
      return;
    }
    updateData.address = requestBody.address;
  }

  if (requestBody.coordinates !== undefined) {
    if (!validateCoordinatesFromRequest(requestBody.coordinates, res)) {
      return;
    }
    updateData.coordinates = requestBody.coordinates;
  }

  if (requestBody.isActive !== undefined) {
    if (typeof requestBody.isActive !== 'boolean') {
      sendError(res, 'Invalid isActive format', 400);
      return;
    }
    updateData.isActive = requestBody.isActive;
  }

  const location = await updateExistingLocation(id!, updateData);

  if (!location) {
    sendError(res, 'Location not found', 404);
    return;
  }

  sendSuccess(res, location, 'Location updated successfully');
});

export const deleteLocation = withErrorHandling(async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  const { id } = req.params;

  if (!validateUserRole(req.user?.role, 'ADMIN', res)) {
    return;
  }

  if (!validateRequiredId(id, res, 'Location ID')) {
    return;
  }

  await deleteExistingLocation(id!);
  sendSuccess(res, undefined, 'Location deleted successfully');
});

export const searchLocations = withErrorHandling(async (req: Request, res: Response): Promise<void> => {
  const { q: query } = req.query;

  if (typeof query !== 'string' || query.trim().length === 0) {
    sendError(res, 'Search query is required', 400);
    return;
  }

  const locations = await searchLocationsService(query);
  sendSuccess(res, locations);
});

export const getLocationAvailability = withErrorHandling(async (req: Request, res: Response): Promise<void> => {
  const { id } = req.params;
  const { date } = req.query;

  if (!validateRequiredId(id, res, 'Location ID')) {
    return;
  }

  if (typeof date !== 'string') {
    sendError(res, 'Date parameter is required', 400);
    return;
  }

  const dateObj = new Date(date);
  if (isNaN(dateObj.getTime())) {
    sendError(res, 'Invalid date format', 400);
    return;
  }

  const availability = await getLocationAvailabilityService(id!, dateObj);
  sendSuccess(res, availability);
});

export const getLocationTimeSlots = withErrorHandling(async (req: Request, res: Response): Promise<void> => {
  const { id } = req.params;
  const { date } = req.query;

  if (!validateRequiredId(id, res, 'Location ID')) {
    return;
  }

  if (typeof date !== 'string') {
    sendError(res, 'Date parameter is required', 400);
    return;
  }

  const dateObj = new Date(date);
  if (isNaN(dateObj.getTime())) {
    sendError(res, 'Invalid date format', 400);
    return;
  }

  const timeSlots = await getLocationTimeslotsService(id!, dateObj);
  sendSuccess(res, timeSlots);
});

// Helper function for coordinate validation (keeping this here as it's specific to location logic)
function validateCoordinatesFromRequest(coordinates: unknown, res: Response): boolean {
  if (typeof coordinates !== 'object' || coordinates === null) {
    sendError(res, 'Invalid coordinates format', 400);
    return false;
  }

  const coordsObj = coordinates as Record<string, unknown>;
  if (typeof coordsObj.latitude !== 'number' || typeof coordsObj.longitude !== 'number') {
    sendError(res, 'Invalid coordinates format', 400);
    return false;
  }

  if (!validateCoordinates(coordsObj.latitude, coordsObj.longitude)) {
    sendError(res, 'Invalid coordinates', 400);
    return false;
  }

  return true;
}

// Additional functions that were in the original file but need to be maintained
export const getRealtimeAvailability = withErrorHandling(async (req: Request, res: Response): Promise<void> => {
  const { id } = req.params;

  if (!validateRequiredId(id, res, 'Location ID')) {
    return;
  }

  // TODO: Implement real-time availability logic
  const realtimeData = {
    locationId: id,
    timestamp: new Date(),
    availableSpots: 5,
    totalSpots: 20,
    occupancyRate: 0.75
  };

  sendSuccess(res, realtimeData);
}); 