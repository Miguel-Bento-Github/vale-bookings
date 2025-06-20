import { Response, Request } from 'express';
import mongoose from 'mongoose';

import { sendError } from './responseHelpers';
import { validateCoordinates } from './validation';

export function validateRequiredId(id: string | undefined, res: Response, entityName: string = 'ID'): boolean {
  if (!id || id.trim().length === 0) {
    sendError(res, `${entityName} is required`, 400);
    return false;
  }

  if (!mongoose.Types.ObjectId.isValid(id)) {
    sendError(res, 'Invalid ID format', 400);
    return false;
  }

  return true;
}

export function validatePaginationParams(
  page: string | undefined,
  limit: string | undefined
): { page: number; limit: number } {
  const parsedPage = page && page.length > 0 ? parseInt(page, 10) : 1;
  const parsedLimit = limit && limit.length > 0 ? parseInt(limit, 10) : 10;

  return {
    page: Math.max(1, isNaN(parsedPage) ? 1 : parsedPage),
    limit: Math.max(1, Math.min(100, isNaN(parsedLimit) ? 10 : parsedLimit))
  };
}

export function validateTimeRange(startTime: string, endTime: string, res: Response): boolean {
  const start = new Date(startTime);
  const end = new Date(endTime);
  const now = new Date();

  if (isNaN(start.getTime()) || isNaN(end.getTime())) {
    sendError(res, 'Invalid date format', 400);
    return false;
  }

  if (start < now) {
    sendError(res, 'Cannot create booking in the past', 400);
    return false;
  }

  if (end <= start) {
    sendError(res, 'End time must be after start time', 400);
    return false;
  }

  return true;
}

export function validateCoordinatesFromRequest(coordinates: unknown, res: Response): boolean {
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

export function validateLocationData(
  name: string | undefined,
  address: string | undefined,
  coordinates: unknown,
  res: Response
): boolean {
  if (!name || name.trim().length === 0 || !address || address.trim().length === 0) {
    sendError(res, 'Name and address are required', 400);
    return false;
  }

  if (coordinates) {
    const coord = coordinates as { latitude: number; longitude: number };
    if (!validateCoordinates(coord.latitude, coord.longitude)) {
      sendError(res, 'Invalid coordinates', 400);
      return false;
    }
  }

  return true;
}

export function parseCoordinatesFromQuery(req: Request): {
  latitude?: number;
  longitude?: number;
  radius?: number
} {
  const { lat, lng, latitude, longitude, radius } = req.query as Record<string, string>;

  const parsedLat = lat ?? latitude;
  const parsedLng = lng ?? longitude;

  return {
    latitude: parsedLat ? parseFloat(parsedLat) : undefined,
    longitude: parsedLng ? parseFloat(parsedLng) : undefined,
    radius: radius ? parseFloat(radius) : undefined
  };
}

export function validateCoordinatesFromQuery(
  latitude: number | undefined,
  longitude: number | undefined,
  res: Response
): boolean {
  if (latitude === undefined || longitude === undefined) {
    sendError(res, 'Latitude and longitude are required', 400);
    return false;
  }

  if (!validateCoordinates(latitude, longitude)) {
    sendError(res, 'Invalid coordinates', 400);
    return false;
  }

  return true;
}

export function validateRequiredString(value: string | undefined, fieldName: string, res: Response): boolean {
  if (!value || value.trim().length === 0) {
    sendError(res, `${fieldName} is required`, 400);
    return false;
  }

  return true;
}

export function validateUserRole(userRole: string, requiredRole: string, res: Response): boolean {
  if (userRole !== requiredRole) {
    sendError(res, 'Forbidden: access denied', 403);
    return false;
  }

  return true;
}

export function validateAuthentication(user: unknown, res: Response): boolean {
  if (!user) {
    sendError(res, 'Unauthorized', 401);
    return false;
  }

  return true;
}

export function validateDateParam(dateParam: string | undefined, res: Response): Date | null {
  if (!dateParam || dateParam.trim().length === 0) {
    sendError(res, 'Date parameter is required', 400);
    return null;
  }

  const date = new Date(dateParam);
  if (isNaN(date.getTime())) {
    sendError(res, 'Invalid date format', 400);
    return null;
  }

  return date;
} 