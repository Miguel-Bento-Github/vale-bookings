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
    const radiusKm = radius ? parseFloat(radius as string) / 1000 : 10;

    if (!validateCoordinates(latValue, lngValue)) {
      res.status(400).json({
        success: false,
        message: 'Invalid coordinates'
      });
      return;
    }

    // Validate radius parameter
    if (radius && (isNaN(parseFloat(radius as string)) || parseFloat(radius as string) <= 0)) {
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

    if (!id) {
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

    const { name, address, coordinates } = req.body;

    if (!name || !address || !coordinates) {
      res.status(400).json({
        success: false,
        message: 'Name, address, and coordinates are required'
      });
      return;
    }

    if (!validateCoordinates(coordinates.latitude, coordinates.longitude)) {
      res.status(400).json({
        success: false,
        message: 'Invalid coordinates'
      });
      return;
    }

    const location = await createNewLocation({
      name,
      address,
      coordinates,
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
    const updateData = req.body;

    if (!id) {
      res.status(400).json({
        success: false,
        message: 'Location ID is required'
      });
      return;
    }

    if (updateData.coordinates && !validateCoordinates(updateData.coordinates.latitude, updateData.coordinates.longitude)) {
      res.status(400).json({
        success: false,
        message: 'Invalid coordinates'
      });
      return;
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

    if (!id) {
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
    if (!q) {
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
    if (q) {
      searchCriteria.$or = [
        { name: { $regex: q, $options: 'i' } },
        { address: { $regex: q, $options: 'i' } }
      ];
    }

    // Price range filter
    if (minPrice || maxPrice) {
      const priceFilter: Record<string, number> = {};
      if (minPrice) {
        priceFilter.$gte = parseFloat(minPrice as string);
      }
      if (maxPrice) {
        priceFilter.$lte = parseFloat(maxPrice as string);
      }
      searchCriteria['pricing.hourlyRate'] = priceFilter;
    }

    // Get locations based on criteria
    let locations;
    if (lat && lng && radius) {
      const latitude = parseFloat(lat as string);
      const longitude = parseFloat(lng as string);
      const radiusKm = parseFloat(radius as string);

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

    if (!id) {
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
    if (date && isNaN(Date.parse(date as string))) {
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
    const targetDate = date ? new Date(date as string) : new Date();
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

    if (!id) {
      res.status(400).json({
        success: false,
        message: 'Location ID is required'
      });
      return;
    }

    if (!date) {
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
    if (isNaN(Date.parse(date as string))) {
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

    const targetDate = date ? new Date(date as string) : new Date();

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

    if (!id) {
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