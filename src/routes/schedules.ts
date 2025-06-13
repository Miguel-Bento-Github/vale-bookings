import { Router } from 'express';

import {
  getLocationSchedules,
  createSchedule,
  updateSchedule,
  deleteSchedule
} from '../controllers/ScheduleController';
import { authenticate, authorize } from '../middleware/auth';

const router = Router();

router.get('/location/:locationId', (req, res, next) => {
  getLocationSchedules(req, res).catch(next);
});
router.post('/', authenticate, authorize(['ADMIN']), (req, res, next) => {
  createSchedule(req, res).catch(next);
});
router.put('/:id', authenticate, authorize(['ADMIN']), (req, res, next) => {
  updateSchedule(req, res).catch(next);
});
router.delete('/:id', authenticate, authorize(['ADMIN']), (req, res, next) => {
  deleteSchedule(req, res).catch(next);
});

export default router; 