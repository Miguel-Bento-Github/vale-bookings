import { Router } from 'express';
import { getLocations, getNearbyLocations, getLocationById, createLocation, updateLocation, deleteLocation } from '../controllers/LocationController';
import { authenticate, authorize } from '../middleware/auth';

const router = Router();

router.get('/', getLocations);
router.get('/nearby', getNearbyLocations);
router.get('/:id', getLocationById);
router.post('/', authenticate, authorize(['ADMIN']), createLocation);
router.put('/:id', authenticate, authorize(['ADMIN']), updateLocation);
router.delete('/:id', authenticate, authorize(['ADMIN']), deleteLocation);

export default router; 