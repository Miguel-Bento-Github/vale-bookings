import { Router } from 'express';
import authRoutes from './auth';
import userRoutes from './users';
import locationRoutes from './locations';
import bookingRoutes from './bookings';
import scheduleRoutes from './schedules';

const router = Router();

router.use('/auth', authRoutes);
router.use('/users', userRoutes);
router.use('/locations', locationRoutes);
router.use('/bookings', bookingRoutes);
router.use('/schedules', scheduleRoutes);

export default router; 