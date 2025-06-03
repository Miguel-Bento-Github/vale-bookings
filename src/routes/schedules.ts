import { Router } from 'express';
import { ScheduleController } from '../controllers/ScheduleController';
import { authenticate, authorize } from '../middleware/auth';

const router = Router();
const scheduleController = new ScheduleController();

router.get('/location/:locationId', scheduleController.getLocationSchedules.bind(scheduleController));
router.post('/', authenticate, authorize(['ADMIN']), scheduleController.createSchedule.bind(scheduleController));
router.put('/:id', authenticate, authorize(['ADMIN']), scheduleController.updateSchedule.bind(scheduleController));
router.delete('/:id', authenticate, authorize(['ADMIN']), scheduleController.deleteSchedule.bind(scheduleController));

export default router; 