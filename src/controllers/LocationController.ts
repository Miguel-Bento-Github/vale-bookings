import { Request, Response } from 'express';
import LocationService from '../services/LocationService';
import { AppError, AuthenticatedRequest } from '../types';
import { validateCoordinates } from '../utils/validation';

export class LocationController {
  private locationService = LocationService;

  async getLocations(req: Request, res: Response): Promise<void> {
    try {
      const locations = await this.locationService.getAllLocations();

      res.status(200).json({
        success: true,
        data: { locations }
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

  async getNearbyLocations(req: Request, res: Response): Promise<void> {
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

      const locations = await this.locationService.findNearby(lat, lng, radiusKm);

      res.status(200).json({
        success: true,
        data: { locations }
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

  async getLocationById(req: Request, res: Response): Promise<void> {
    try {
      const { id } = req.params;

      if (!id) {
        res.status(400).json({
          success: false,
          message: 'Location ID is required'
        });
        return;
      }

      const location = await this.locationService.findById(id);

      if (!location) {
        res.status(404).json({
          success: false,
          message: 'Location not found'
        });
        return;
      }

      res.status(200).json({
        success: true,
        data: { location }
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

  async createLocation(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const userRole = req.user?.role;

      if (userRole !== 'ADMIN') {
        res.status(403).json({
          success: false,
          message: 'Forbidden: Admin access required'
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

      const location = await this.locationService.createLocation({
        name,
        address,
        coordinates,
        isActive: true
      });

      res.status(201).json({
        success: true,
        message: 'Location created successfully',
        data: { location }
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

  async updateLocation(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const userRole = req.user?.role;

      if (userRole !== 'ADMIN') {
        res.status(403).json({
          success: false,
          message: 'Forbidden: Admin access required'
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

      const location = await this.locationService.updateLocation(id, updateData);

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
        data: { location }
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

  async deleteLocation(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const userRole = req.user?.role;

      if (userRole !== 'ADMIN') {
        res.status(403).json({
          success: false,
          message: 'Forbidden: Admin access required'
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

      const location = await this.locationService.deactivateLocation(id);

      if (!location) {
        res.status(404).json({
          success: false,
          message: 'Location not found'
        });
        return;
      }

      res.status(200).json({
        success: true,
        message: 'Location deactivated successfully'
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
} 