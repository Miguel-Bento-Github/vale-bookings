import { Router } from 'express';

import {
  getAllUsers,
  updateUserRole,
  deleteUser,
  getAllValets,
  createValet,
  updateValet,
  deleteValet,
  createLocation,
  updateLocation,
  deleteLocation,
  getAllSchedules,
  createSchedule,
  updateSchedule,
  deleteSchedule,
  createBulkSchedules,
  getAllBookings,
  updateBookingStatus,
  getAnalyticsOverview,
  getRevenueAnalytics,
  getBookingAnalytics
} from '../controllers/AdminController';
import { authenticate, authorize } from '../middleware/auth';

const router = Router();

// Apply authentication and admin authorization to all routes
router.use(authenticate);
router.use(authorize(['ADMIN']));

// Admin user management
router.get('/users', getAllUsers);
router.put('/users/:id/role', updateUserRole);
router.delete('/users/:id', deleteUser);

// Admin valet management
router.get('/valets', getAllValets);
router.post('/valets', createValet);
router.put('/valets/:id', updateValet);
router.delete('/valets/:id', deleteValet);

// Admin location management
router.post('/locations', createLocation);
router.put('/locations/:id', updateLocation);
router.delete('/locations/:id', deleteLocation);

// Admin schedule management
router.get('/schedules', getAllSchedules);
router.post('/schedules', createSchedule);
router.put('/schedules/:id', updateSchedule);
router.delete('/schedules/:id', deleteSchedule);
router.post('/schedules/bulk', createBulkSchedules);

// Admin booking oversight
router.get('/bookings', getAllBookings);
router.put('/bookings/:id/status', updateBookingStatus);

// Admin analytics
router.get('/analytics/overview', getAnalyticsOverview);
router.get('/analytics/revenue', getRevenueAnalytics);
router.get('/analytics/bookings', getBookingAnalytics);

export default router; 