import { Router } from 'express';
import { LocationController } from '../controllers/LocationController';
import { authenticate, authorize } from '../middleware/auth';

const router = Router();
const locationController = new LocationController();

router.get('/', locationController.getLocations.bind(locationController));
router.get('/nearby', locationController.getNearbyLocations.bind(locationController));
router.get('/:id', locationController.getLocationById.bind(locationController));
router.post('/', authenticate, authorize(['ADMIN']), locationController.createLocation.bind(locationController));
router.put('/:id', authenticate, authorize(['ADMIN']), locationController.updateLocation.bind(locationController));
router.delete('/:id', authenticate, authorize(['ADMIN']), locationController.deleteLocation.bind(locationController));

export default router; 