import { Router } from 'express';

import { getLocationSchedules, createSchedule, updateSchedule, deleteSchedule } from '../controllers/ScheduleController';
import { authenticate, authorize } from '../middleware/auth';

const router = Router();

router.get('/location/:locationId', getLocationSchedules);
router.post('/', authenticate, authorize(['ADMIN']), createSchedule);
router.put('/:id', authenticate, authorize(['ADMIN']), updateSchedule);
router.delete('/:id', authenticate, authorize(['ADMIN']), deleteSchedule);

export default router; 