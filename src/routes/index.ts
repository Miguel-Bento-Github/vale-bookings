import { Router } from 'express';

import adminRoutes from './admin';
import authRoutes from './auth';
import bookingRoutes from './bookings';
import locationRoutes from './locations';
import scheduleRoutes from './schedules';
import userRoutes from './users';

const router = Router();

router.use('/auth', authRoutes);
router.use('/users', userRoutes);
router.use('/locations', locationRoutes);
router.use('/bookings', bookingRoutes);
router.use('/schedules', scheduleRoutes);
router.use('/admin', adminRoutes);

export default router; 