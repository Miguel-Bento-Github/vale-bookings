import { Request, Response } from 'express';
import mongoose from 'mongoose';

import {
  getAllLocations,
  findNearby,
  getLocationById as findLocationById,
  createLocation as createNewLocation,
  updateLocation as updateExistingLocation,
  deleteLocation as deleteExistingLocation
} from '../services/LocationService';
import { AppError, AuthenticatedRequest } from '../types';
import { validateCoordinates } from '../utils/validation';

export async function getLocations(req: Request, res: Response): Promise<void> {
  try {
    const locations = await getAllLocations();

    res.status(200).json({
      success: true,
      data: locations
    });
  } catch (error) {
    if (error instanceof AppError) {
      res.status(error.statusCode).json({
        success: false,
        message: error.message
      });
    } else {
      res.status(500).json({
        success: false,
        message: 'Internal server error'
      });
    }
  }
}

export async function getNearbyLocations(req: Request, res: Response): Promise<void> {
  try {
    const { lat, lng, latitude, longitude, radius } = req.query;

    // Accept both lat/lng and latitude/longitude parameter formats
    const latParam = lat ?? latitude;
    const lngParam = lng ?? longitude;

    if (latParam === undefined || lngParam === undefined) {
      res.status(400).json({
        success: false,
        message: 'Latitude and longitude are required'
      });
      return;
    }

    const latValue = parseFloat(latParam as string);
    const lngValue = parseFloat(lngParam as string);
    const radiusKm = radius !== undefined ? parseFloat(radius as string) / 1000 : 10;

    if (!validateCoordinates(latValue, lngValue)) {
      res.status(400).json({
        success: false,
        message: 'Invalid coordinates'
      });
      return;
    }

    // Validate radius parameter
    if (radius !== undefined && (isNaN(parseFloat(radius as string)) || parseFloat(radius as string) <= 0)) {
      res.status(400).json({
        success: false,
        message: 'Invalid radius parameter'
      });
      return;
    }

    const locations = await findNearby(latValue, lngValue, radiusKm);

    res.status(200).json({
      success: true,
      data: locations
    });
  } catch (error) {
    if (error instanceof AppError) {
      res.status(error.statusCode).json({
        success: false,
        message: error.message
      });
    } else {
      res.status(500).json({
        success: false,
        message: 'Internal server error'
      });
    }
  }
}

export async function getLocationById(req: Request, res: Response): Promise<void> {
  try {
    const { id } = req.params;

    if (id === undefined || id === null || id.trim().length === 0) {
      res.status(400).json({
        success: false,
        message: 'Location ID is required'
      });
      return;
    }

    // Validate MongoDB ObjectId format
    if (!mongoose.Types.ObjectId.isValid(id)) {
      res.status(400).json({
        success: false,
        message: 'Invalid ID format'
      });
      return;
    }

    const location = await findLocationById(id);

    if (!location) {
      res.status(404).json({
        success: false,
        message: 'Location not found'
      });
      return;
    }

    res.status(200).json({
      success: true,
      data: location
    });
  } catch (error) {
    if (error instanceof AppError) {
      res.status(error.statusCode).json({
        success: false,
        message: error.message
      });
    } else {
      res.status(500).json({
        success: false,
        message: 'Internal server error'
      });
    }
  }
}

export async function createLocation(req: AuthenticatedRequest, res: Response): Promise<void> {
  try {
    const userRole = req.user?.role;

    if (userRole !== 'ADMIN') {
      res.status(403).json({
        success: false,
        message: 'Forbidden: access denied'
      });
      return;
    }

    const requestBody = req.body as Record<string, unknown>;
    const name = requestBody.name;
    const address = requestBody.address;
    const coordinates = requestBody.coordinates;

    if (
      typeof name !== 'string' ||
      typeof address !== 'string' ||
      typeof coordinates !== 'object' ||
      coordinates === null
    ) {
      res.status(400).json({
        success: false,
        message: 'Name, address, and coordinates are required'
      });
      return;
    }

    const coordsObj = coordinates as Record<string, unknown>;
    if (typeof coordsObj.latitude !== 'number' || typeof coordsObj.longitude !== 'number') {
      res.status(400).json({
        success: false,
        message: 'Invalid coordinates format'
      });
      return;
    }

    if (!validateCoordinates(coordsObj.latitude, coordsObj.longitude)) {
      res.status(400).json({
        success: false,
        message: 'Invalid coordinates'
      });
      return;
    }

    const location = await createNewLocation({
      name,
      address,
      coordinates: {
        latitude: coordsObj.latitude,
        longitude: coordsObj.longitude
      },
      isActive: true
    });

    res.status(201).json({
      success: true,
      message: 'Location created successfully',
      data: location
    });
  } catch (error) {
    if (error instanceof AppError) {
      res.status(error.statusCode).json({
        success: false,
        message: error.message
      });
    } else {
      res.status(500).json({
        success: false,
        message: 'Internal server error'
      });
    }
  }
}

export async function updateLocation(req: AuthenticatedRequest, res: Response): Promise<void> {
  try {
    const userRole = req.user?.role;

    if (userRole !== 'ADMIN') {
      res.status(403).json({
        success: false,
        message: 'Forbidden: access denied'
      });
      return;
    }

    const { id } = req.params;
    const requestBody = req.body as Record<string, unknown>;

    if (id === undefined || id === null || id.trim().length === 0) {
      res.status(400).json({
        success: false,
        message: 'Location ID is required'
      });
      return;
    }

    // Validate coordinates if provided
    if (typeof requestBody.coordinates === 'object' && requestBody.coordinates !== null) {
      const coordinates = requestBody.coordinates as Record<string, unknown>;
      if (
        typeof coordinates.latitude === 'number' &&
        typeof coordinates.longitude === 'number' &&
        !validateCoordinates(coordinates.latitude, coordinates.longitude)
      ) {
        res.status(400).json({
          success: false,
          message: 'Invalid coordinates'
        });
        return;
      }
    }

    // Build update data with proper typing
    const updateData: Record<string, unknown> = {};
    if (typeof requestBody.name === 'string') {
      updateData.name = requestBody.name;
    }
    if (typeof requestBody.address === 'string') {
      updateData.address = requestBody.address;
    }
    if (typeof requestBody.coordinates === 'object' && requestBody.coordinates !== null) {
      updateData.coordinates = requestBody.coordinates;
    }
    if (typeof requestBody.isActive === 'boolean') {
      updateData.isActive = requestBody.isActive;
    }

    const location = await updateExistingLocation(id, updateData);

    if (!location) {
      res.status(404).json({
        success: false,
        message: 'Location not found'
      });
      return;
    }

    res.status(200).json({
      success: true,
      message: 'Location updated successfully',
      data: location
    });
  } catch (error) {
    if (error instanceof AppError) {
      res.status(error.statusCode).json({
        success: false,
        message: error.message
      });
    } else {
      res.status(500).json({
        success: false,
        message: 'Internal server error'
      });
    }
  }
}

export async function deleteLocation(req: AuthenticatedRequest, res: Response): Promise<void> {
  try {
    const userRole = req.user?.role;

    if (userRole !== 'ADMIN') {
      res.status(403).json({
        success: false,
        message: 'Forbidden: access denied'
      });
      return;
    }

    const { id } = req.params;

    if (id === undefined || id === null || id.trim().length === 0) {
      res.status(400).json({
        success: false,
        message: 'Location ID is required'
      });
      return;
    }

    // Check if location exists before deletion
    const location = await findLocationById(id);

    if (!location) {
      res.status(404).json({
        success: false,
        message: 'Location not found'
      });
      return;
    }

    // Actually delete the location
    await deleteExistingLocation(id);

    res.status(200).json({
      success: true,
      message: 'Location deleted successfully'
    });
  } catch (error) {
    if (error instanceof AppError) {
      res.status(error.statusCode).json({
        success: false,
        message: error.message
      });
    } else {
      res.status(500).json({
        success: false,
        message: 'Internal server error'
      });
    }
  }
}

export async function searchLocations(req: Request, res: Response): Promise<void> {
  try {
    const { q, lat, lng, radius, minPrice, maxPrice } = req.query;

    // Require search query parameter
    if (typeof q !== 'string') {
      res.status(400).json({
        success: false,
        message: 'Search query parameter (q) is required'
      });
      return;
    }

    // Build search criteria
    const searchCriteria: Record<string, unknown> = {
      isActive: true
    };

    // Text search
    if (typeof q === 'string') {
      searchCriteria.$or = [
        { name: { $regex: q, $options: 'i' } },
        { address: { $regex: q, $options: 'i' } }
      ];
    }

    // Price range filter
    if (typeof minPrice === 'string' || typeof maxPrice === 'string') {
      const priceFilter: Record<string, number> = {};
      if (typeof minPrice === 'string') {
        priceFilter.$gte = parseFloat(minPrice);
      }
      if (typeof maxPrice === 'string') {
        priceFilter.$lte = parseFloat(maxPrice);
      }
      searchCriteria['pricing.hourlyRate'] = priceFilter;
    }

    // Get locations based on criteria
    let locations;
    if (typeof lat === 'string' && typeof lng === 'string' && typeof radius === 'string') {
      const latitude = parseFloat(lat);
      const longitude = parseFloat(lng);
      const radiusKm = parseFloat(radius);

      if (!validateCoordinates(latitude, longitude)) {
        res.status(400).json({
          success: false,
          message: 'Invalid coordinates'
        });
        return;
      }

      locations = await findNearby(latitude, longitude, radiusKm);
    } else {
      // Use LocationService to search with criteria
      locations = await getAllLocations();
    }

    res.status(200).json({
      success: true,
      data: locations
    });
  } catch (error) {
    if (error instanceof AppError) {
      res.status(error.statusCode).json({
        success: false,
        message: error.message
      });
    } else {
      res.status(500).json({
        success: false,
        message: 'Internal server error'
      });
    }
  }
}

export async function getLocationAvailability(req: Request, res: Response): Promise<void> {
  try {
    const { id } = req.params;
    const { date } = req.query;

    if (id === undefined || id === null || id.trim().length === 0) {
      res.status(400).json({
        success: false,
        message: 'Location ID is required'
      });
      return;
    }

    if (!mongoose.Types.ObjectId.isValid(id)) {
      res.status(400).json({
        success: false,
        message: 'Invalid ID format'
      });
      return;
    }

    // Validate date parameter if provided
    if (date === undefined || date === null || typeof date !== 'string' || date.trim().length === 0) {
      res.status(400).json({
        success: false,
        message: 'Invalid date format'
      });
      return;
    }

    // Validate date format
    if (isNaN(Date.parse(date))) {
      res.status(400).json({
        success: false,
        message: 'Invalid date format'
      });
      return;
    }

    const location = await findLocationById(id);
    if (!location) {
      res.status(404).json({
        success: false,
        message: 'Location not found'
      });
      return;
    }

    // For now, return mock availability data
    // In a real implementation, this would check actual bookings
    const targetDate = date ? new Date(date) : new Date();
    const totalSpots = 20;
    const availableSpots = Math.floor(Math.random() * 20);
    const availability = {
      date: targetDate,
      total: totalSpots,
      available: availableSpots,
      hourlyAvailability: Array.from({ length: 24 }, (_, hour) => ({
        hour,
        available: Math.floor(Math.random() * 5),
        total: 5
      }))
    };

    res.status(200).json({
      success: true,
      data: availability
    });
  } catch (error) {
    if (error instanceof AppError) {
      res.status(error.statusCode).json({
        success: false,
        message: error.message
      });
    } else {
      res.status(500).json({
        success: false,
        message: 'Internal server error'
      });
    }
  }
}

export async function getLocationTimeSlots(req: Request, res: Response): Promise<void> {
  try {
    const { id } = req.params;
    const { date } = req.query;

    if (id === undefined || id === null || id.trim().length === 0) {
      res.status(400).json({
        success: false,
        message: 'Location ID is required'
      });
      return;
    }

    if (typeof date !== 'string' || date.trim().length === 0) {
      res.status(400).json({
        success: false,
        message: 'Date parameter is required'
      });
      return;
    }

    if (!mongoose.Types.ObjectId.isValid(id)) {
      res.status(400).json({
        success: false,
        message: 'Invalid ID format'
      });
      return;
    }

    // Validate date parameter
    if (isNaN(Date.parse(date))) {
      res.status(400).json({
        success: false,
        message: 'Invalid date format'
      });
      return;
    }

    const location = await findLocationById(id);
    if (!location) {
      res.status(404).json({
        success: false,
        message: 'Location not found'
      });
      return;
    }

    const targetDate = date ? new Date(date) : new Date();

    // Generate mock time slots for the day
    const timeSlots = [];
    for (let hour = 8; hour < 20; hour++) {
      const startTime = new Date(targetDate);
      startTime.setHours(hour, 0, 0, 0);

      const endTime = new Date(startTime);
      endTime.setHours(hour + 2, 0, 0, 0);

      timeSlots.push({
        id: `${id}-${hour}`,
        startTime,
        endTime,
        available: Math.floor(Math.random() * 5),
        totalSpots: 5,
        price: 15 + Math.floor(Math.random() * 10)
      });
    }

    res.status(200).json({
      success: true,
      data: timeSlots
    });
  } catch (error) {
    if (error instanceof AppError) {
      res.status(error.statusCode).json({
        success: false,
        message: error.message
      });
    } else {
      res.status(500).json({
        success: false,
        message: 'Internal server error'
      });
    }
  }
}

export async function getRealtimeAvailability(req: Request, res: Response): Promise<void> {
  try {
    const { id } = req.params;

    if (id === undefined || id === null || id.trim().length === 0) {
      res.status(400).json({
        success: false,
        message: 'Location ID is required'
      });
      return;
    }

    if (!mongoose.Types.ObjectId.isValid(id)) {
      res.status(400).json({
        success: false,
        message: 'Invalid ID format'
      });
      return;
    }

    const location = await findLocationById(id);
    if (!location) {
      res.status(404).json({
        success: false,
        message: 'Location not found'
      });
      return;
    }

    // Mock real-time availability
    const currentAvailable = Math.floor(Math.random() * 20);
    const totalSpots = 20;
    const realtimeData = {
      locationId: id,
      total: totalSpots,
      available: currentAvailable,
      lastUpdated: new Date(),
      trend: Math.random() > 0.5 ? 'increasing' : 'decreasing',
      nextUpdate: new Date(Date.now() + 5 * 60 * 1000) // 5 minutes
    };

    res.status(200).json({
      success: true,
      data: realtimeData
    });
  } catch (error) {
    if (error instanceof AppError) {
      res.status(error.statusCode).json({
        success: false,
        message: error.message
      });
    } else {
      res.status(500).json({
        success: false,
        message: 'Internal server error'
      });
    }
  }
} 