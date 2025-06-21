import { Response, Request } from 'express';
import mongoose from 'mongoose';

import { sendError } from './responseHelpers';
import {
  validateCoordinates,
  validateEmail as validateEmailCore,
  validatePassword as validatePasswordCore
} from './validation';

export function validateRequiredId(id: string | undefined, res: Response, fieldName: string = 'ID'): boolean {
  if (id === undefined || id.trim().length === 0) {
    sendError(res, `${fieldName} is required`, 400);
    return false;
  }

  if (!mongoose.Types.ObjectId.isValid(id)) {
    sendError(res, 'Invalid ID format', 400);
    return false;
  }

  return true;
}

export function validatePaginationParams(pageStr?: string, limitStr?: string): { page: number; limit: number } {
  const page = (pageStr !== undefined && pageStr.trim().length > 0) ? parseInt(pageStr, 10) : 1;
  const limit = (limitStr !== undefined && limitStr.trim().length > 0) ? parseInt(limitStr, 10) : 10;

  return {
    page: Math.max(1, isNaN(page) ? 1 : page),
    limit: Math.max(1, Math.min(100, isNaN(limit) ? 10 : limit))
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

export function validateLocationData(data: Record<string, unknown>): string[] {
  const errors: string[] = [];

  const hasName = (data.name !== undefined && typeof data.name === 'string' && data.name.trim().length > 0);
  const hasAddress = (data.address !== undefined && typeof data.address === 'string' && data.address.trim().length > 0);

  if (!hasName || !hasAddress) {
    errors.push('Name and address are required');
  }

  if (typeof data.coordinates === 'object' && data.coordinates !== null) {
    const coords = data.coordinates as Record<string, unknown>;
    if (typeof coords.latitude !== 'number' || typeof coords.longitude !== 'number') {
      errors.push('Invalid coordinates');
    } else if (!validateCoordinates(coords.latitude, coords.longitude)) {
      errors.push('Invalid coordinates');
    }
  } else {
    errors.push('Coordinates are required');
  }

  return errors;
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
    latitude: (parsedLat !== undefined) ? parseFloat(parsedLat) : undefined,
    longitude: (parsedLng !== undefined) ? parseFloat(parsedLng) : undefined,
    radius: (radius !== undefined) ? parseFloat(radius) : undefined
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

export function validateRequiredString(value: string | undefined, fieldName: string): string | null {
  if (value === undefined || value.trim().length === 0) {
    return `${fieldName} is required`;
  }
  return null;
}

export function validateEmail(email: string): string | null {
  if (email === undefined || email.trim().length === 0) {
    return 'Email is required';
  }

  // Use the core validation function from validation.ts
  if (!validateEmailCore(email)) {
    return 'Invalid email format';
  }

  return null;
}

export function validatePassword(password: string): string | null {
  if (password === undefined || password.trim().length === 0) {
    return 'Password is required';
  }

  // Use the core validation function from validation.ts
  if (!validatePasswordCore(password)) {
    return 'Password must be at least 6 characters long';
  }

  return null;
}

export function validateUserRole(role: string): boolean {
  const validRoles = ['CUSTOMER', 'VALET', 'ADMIN'];
  return validRoles.includes(role);
}

export function validateAuthentication(userId?: string): boolean {
  return Boolean(userId !== undefined && userId.trim().length > 0);
}

export function validateAdminRole(user: { role: string } | undefined, res: Response): boolean {
  if (!user || user.role !== 'ADMIN') {
    sendError(res, 'Forbidden: access denied', 403);
    return false;
  }
  return true;
}

export function validateUserAuthentication(userId: string | undefined, res: Response): boolean {
  if (userId === undefined || userId.trim().length === 0) {
    sendError(res, 'User authentication required', 401);
    return false;
  }
  return true;
}

export function validateBookingStatus(status: string): boolean {
  const validStatuses = ['PENDING', 'CONFIRMED', 'IN_PROGRESS', 'COMPLETED', 'CANCELLED'];
  return validStatuses.includes(status);
}

export function validateDateParam(dateStr?: string): Date | null {
  if (dateStr === undefined || dateStr.trim().length === 0) {
    return null;
  }

  const date = new Date(dateStr);
  if (isNaN(date.getTime())) {
    return null;
  }

  return date;
}

export function validateBulkRequestBody<T>(
  body: Record<string, unknown>,
  validator: (item: unknown) => item is T,
  locationIdRequired: boolean = true
): { isValid: boolean; error?: string; data?: { locationId: string; items: T[] } } {
  if (locationIdRequired && typeof body.locationId !== 'string') {
    return { isValid: false, error: 'Location ID is required' };
  }

  if (!Array.isArray(body.schedules) || body.schedules.length === 0) {
    return { isValid: false, error: 'Schedules array is required and cannot be empty' };
  }

  const validatedItems: T[] = [];
  for (const item of body.schedules) {
    if (typeof item !== 'object' || item === null) {
      return { isValid: false, error: 'Invalid item format in bulk request' };
    }

    const itemWithLocation = locationIdRequired ? {
      ...(item as Record<string, unknown>),
      locationId: body.locationId as string
    } : (item as Record<string, unknown>);

    if (!validator(itemWithLocation)) {
      return { isValid: false, error: 'Invalid item data in bulk request' };
    }
    validatedItems.push(itemWithLocation);
  }

  return {
    isValid: true,
    data: {
      locationId: body.locationId as string,
      items: validatedItems
    }
  };
} 