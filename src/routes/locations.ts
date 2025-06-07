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
router.get('/', getLocations);
router.get('/search', searchLocations);
router.get('/nearby', getNearbyLocations);
router.get('/:id', getLocationById);
router.get('/:id/availability', getLocationAvailability);
router.get('/:id/timeslots', getLocationTimeSlots);
router.get('/:id/realtime-availability', getRealtimeAvailability);

// Protected endpoints
router.post('/', authenticate, authorize(['ADMIN']), createLocation);
router.put('/:id', authenticate, authorize(['ADMIN']), updateLocation);
router.delete('/:id', authenticate, authorize(['ADMIN']), deleteLocation);

export default router; 