import { Router } from 'express';
import { authenticate, authorize } from '../middleware/auth';
import AdminController from '../controllers/AdminController';

const router = Router();

// Apply authentication and admin authorization to all routes
router.use(authenticate);
router.use(authorize(['ADMIN']));

// Admin user management
router.get('/users', AdminController.getAllUsers);
router.put('/users/:id/role', AdminController.updateUserRole);
router.delete('/users/:id', AdminController.deleteUser);

// Admin valet management
router.get('/valets', AdminController.getAllValets);
router.post('/valets', AdminController.createValet);
router.put('/valets/:id', AdminController.updateValet);
router.delete('/valets/:id', AdminController.deleteValet);

// Admin location management
router.post('/locations', AdminController.createLocation);
router.put('/locations/:id', AdminController.updateLocation);
router.delete('/locations/:id', AdminController.deleteLocation);

// Admin schedule management
router.get('/schedules', AdminController.getAllSchedules);
router.post('/schedules', AdminController.createSchedule);
router.put('/schedules/:id', AdminController.updateSchedule);
router.delete('/schedules/:id', AdminController.deleteSchedule);
router.post('/schedules/bulk', AdminController.createBulkSchedules);

// Admin booking oversight
router.get('/bookings', AdminController.getAllBookings);
router.put('/bookings/:id/status', AdminController.updateBookingStatus);

// Admin analytics
router.get('/analytics/overview', AdminController.getAnalyticsOverview);
router.get('/analytics/revenue', AdminController.getRevenueAnalytics);
router.get('/analytics/bookings', AdminController.getBookingAnalytics);

export default router; 