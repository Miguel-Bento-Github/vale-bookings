import { Response, Request } from 'express';
import mongoose from 'mongoose';

import { sendError } from './responseHelpers';
import { validateCoordinates } from './validation';

export function validateRequiredId(id: string | undefined, res: Response, fieldName: string = 'ID'): boolean {
  if (!id || id.trim().length === 0) {
    sendError(res, `${fieldName} is required`, 400);
    return false;
  }

  if (!mongoose.Types.ObjectId.isValid(id)) {
    sendError(res, `Invalid ${fieldName}`, 400);
    return false;
  }

  return true;
}

export function validatePaginationParams(pageStr?: string, limitStr?: string): { page: number; limit: number } {
  const page = pageStr && pageStr.trim().length > 0 ? parseInt(pageStr, 10) : 1;
  const limit = limitStr && limitStr.trim().length > 0 ? parseInt(limitStr, 10) : 10;

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

  if (!data.name || typeof data.name !== 'string' || data.name.trim().length === 0) {
    errors.push('Name is required');
  }

  if (!data.address || typeof data.address !== 'string' || data.address.trim().length === 0) {
    errors.push('Address is required');
  }

  if (typeof data.coordinates === 'object' && data.coordinates !== null) {
    const coords = data.coordinates as Record<string, unknown>;
    if (typeof coords.latitude !== 'number' || typeof coords.longitude !== 'number') {
      errors.push('Coordinates must contain valid latitude and longitude numbers');
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

export function validateRequiredString(value: string | undefined, fieldName: string): string | null {
  if (!value || value.trim().length === 0) {
    return `${fieldName} is required`;
  }
  return null;
}

export function validateEmail(email: string): string | null {
  if (!email || email.trim().length === 0) {
    return 'Email is required';
  }

  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(email)) {
    return 'Invalid email format';
  }

  return null;
}

export function validatePassword(password: string): string | null {
  if (!password || password.trim().length === 0) {
    return 'Password is required';
  }

  if (password.length < 6) {
    return 'Password must be at least 6 characters long';
  }

  return null;
}

export function validateUserRole(role: string): boolean {
  const validRoles = ['CUSTOMER', 'VALET', 'ADMIN'];
  return validRoles.includes(role);
}

export function validateAuthentication(userId?: string): boolean {
  return Boolean(userId && userId.trim().length > 0);
}

export function validateDateParam(dateStr?: string): Date | null {
  if (!dateStr || dateStr.trim().length === 0) {
    return null;
  }

  const date = new Date(dateStr);
  if (isNaN(date.getTime())) {
    return null;
  }

  return date;
} 