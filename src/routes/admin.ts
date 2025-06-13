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
router.get('/users', (req, res, next) => {
  getAllUsers(req, res).catch(next);
});
router.put('/users/:id/role', (req, res, next) => {
  updateUserRole(req, res).catch(next);
});
router.delete('/users/:id', (req, res, next) => {
  deleteUser(req, res).catch(next);
});

// Admin valet management
router.get('/valets', (req, res, next) => {
  getAllValets(req, res).catch(next);
});
router.post('/valets', (req, res, next) => {
  createValet(req, res).catch(next);
});
router.put('/valets/:id', (req, res, next) => {
  updateValet(req, res).catch(next);
});
router.delete('/valets/:id', (req, res, next) => {
  deleteValet(req, res).catch(next);
});

// Admin location management
router.post('/locations', (req, res, next) => {
  createLocation(req, res).catch(next);
});
router.put('/locations/:id', (req, res, next) => {
  updateLocation(req, res).catch(next);
});
router.delete('/locations/:id', (req, res, next) => {
  deleteLocation(req, res).catch(next);
});

// Admin schedule management
router.get('/schedules', (req, res, next) => {
  getAllSchedules(req, res).catch(next);
});
router.post('/schedules', (req, res, next) => {
  createSchedule(req, res).catch(next);
});
router.put('/schedules/:id', (req, res, next) => {
  updateSchedule(req, res).catch(next);
});
router.delete('/schedules/:id', (req, res, next) => {
  deleteSchedule(req, res).catch(next);
});
router.post('/schedules/bulk', (req, res, next) => {
  createBulkSchedules(req, res).catch(next);
});

// Admin booking oversight
router.get('/bookings', (req, res, next) => {
  getAllBookings(req, res).catch(next);
});
router.put('/bookings/:id/status', (req, res, next) => {
  updateBookingStatus(req, res).catch(next);
});

// Admin analytics
router.get('/analytics/overview', (req, res, next) => {
  getAnalyticsOverview(req, res).catch(next);
});
router.get('/analytics/revenue', (req, res, next) => {
  getRevenueAnalytics(req, res).catch(next);
});
router.get('/analytics/bookings', (req, res, next) => {
  getBookingAnalytics(req, res).catch(next);
});

export default router; 