import { Request, Response } from 'express';
import { getAllLocations, findNearby, getLocationById as findLocationById, createLocation as createNewLocation, updateLocation as updateExistingLocation, deleteLocation as deleteExistingLocation } from '../services/LocationService';
import { AppError, AuthenticatedRequest } from '../types';
import { validateCoordinates } from '../utils/validation';
import mongoose from 'mongoose';

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
    const { latitude, longitude, radius } = req.query;

    if (!latitude || !longitude) {
      res.status(400).json({
        success: false,
        message: 'Latitude and longitude are required'
      });
      return;
    }

    const lat = parseFloat(latitude as string);
    const lng = parseFloat(longitude as string);
    const radiusKm = radius ? parseFloat(radius as string) / 1000 : 10;

    if (!validateCoordinates(lat, lng)) {
      res.status(400).json({
        success: false,
        message: 'Invalid coordinates'
      });
      return;
    }

    const locations = await findNearby(lat, lng, radiusKm);

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