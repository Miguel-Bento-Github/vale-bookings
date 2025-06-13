import { Router } from 'express';

import {
  getLocations,
  getNearbyLocations,
  getLocationById,
  createLocation,
  updateLocation,
  deleteLocation,
  searchLocations,
  getLocationAvailability,
  getLocationTimeSlots,
  getRealtimeAvailability
} from '../controllers/LocationController';
import { authenticate, authorize } from '../middleware/auth';

const router = Router();

// Public endpoints
router.get('/', (req, res, next) => {
  getLocations(req, res).catch(next);
});
router.get('/search', (req, res, next) => {
  searchLocations(req, res).catch(next);
});
router.get('/nearby', (req, res, next) => {
  getNearbyLocations(req, res).catch(next);
});
router.get('/:id', (req, res, next) => {
  getLocationById(req, res).catch(next);
});
router.get('/:id/availability', (req, res, next) => {
  getLocationAvailability(req, res).catch(next);
});
router.get('/:id/timeslots', (req, res, next) => {
  getLocationTimeSlots(req, res).catch(next);
});
router.get('/:id/realtime-availability', (req, res, next) => {
  getRealtimeAvailability(req, res).catch(next);
});

// Protected endpoints
router.post('/', authenticate, authorize(['ADMIN']), (req, res, next) => {
  createLocation(req, res).catch(next);
});
router.put('/:id', authenticate, authorize(['ADMIN']), (req, res, next) => {
  updateLocation(req, res).catch(next);
});
router.delete('/:id', authenticate, authorize(['ADMIN']), (req, res, next) => {
  deleteLocation(req, res).catch(next);
});

export default router; 