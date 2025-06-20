import mongoose from 'mongoose';
import { Response } from 'express';
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

export function validatePaginationParams(page: string | undefined, limit: string | undefined): { page: number; limit: number } {
    const parsedPage = page ? parseInt(page, 10) : 1;
    const parsedLimit = limit ? parseInt(limit, 10) : 10;

    return {
        page: isNaN(parsedPage) || parsedPage < 1 ? 1 : parsedPage,
        limit: isNaN(parsedLimit) || parsedLimit < 1 ? 10 : Math.min(parsedLimit, 100) // Cap at 100
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

export function validateLocationData(body: unknown, res: Response): boolean {
    const requestBody = body as Record<string, unknown>;
    const { name, address, coordinates } = requestBody;

    if (typeof name !== 'string' || typeof address !== 'string') {
        sendError(res, 'Name and address are required', 400);
        return false;
    }

    return validateCoordinatesFromRequest(coordinates, res);
}

export function parseCoordinatesFromQuery(req: any): { lat: number; lng: number; radius?: number } | null {
    const { lat, lng, latitude, longitude, radius } = req.query;

    // Accept both lat/lng and latitude/longitude parameter formats
    const latParam = lat ?? latitude;
    const lngParam = lng ?? longitude;

    if (latParam === undefined || lngParam === undefined) {
        return null;
    }

    const latValue = parseFloat(latParam as string);
    const lngValue = parseFloat(lngParam as string);
    const radiusKm = radius !== undefined ? parseFloat(radius as string) / 1000 : 10;

    if (isNaN(latValue) || isNaN(lngValue)) {
        return null;
    }

    if (radius !== undefined && (isNaN(parseFloat(radius as string)) || parseFloat(radius as string) <= 0)) {
        return null;
    }

    return { lat: latValue, lng: lngValue, radius: radiusKm };
}

export function validateUserRole(userRole: string | undefined, requiredRole: string, res: Response): boolean {
    if (userRole !== requiredRole) {
        sendError(res, 'Forbidden: access denied', 403);
        return false;
    }
    return true;
}

export function validateAuthentication(userId: string | undefined, res: Response): boolean {
    if (!userId) {
        sendError(res, 'Unauthorized', 401);
        return false;
    }
    return true;
} 