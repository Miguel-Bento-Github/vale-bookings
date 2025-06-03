import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import mongoose from 'mongoose';
import dotenv from 'dotenv';

import { AuthController } from './controllers/AuthController';
import { UserController } from './controllers/UserController';
import { LocationController } from './controllers/LocationController';
import { BookingController } from './controllers/BookingController';
import { ScheduleController } from './controllers/ScheduleController';
import { authenticate, authorize } from './middleware/auth';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(helmet());
app.use(cors());
app.use(morgan('combined'));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Controllers
const authController = new AuthController();
const userController = new UserController();
const locationController = new LocationController();
const bookingController = new BookingController();
const scheduleController = new ScheduleController();

// Health check
app.get('/health', (req, res) => {
  res.json({ status: 'OK', timestamp: new Date().toISOString() });
});

// Auth routes
app.post('/api/auth/register', authController.register.bind(authController));
app.post('/api/auth/login', authController.login.bind(authController));
app.post('/api/auth/refresh', authController.refreshToken.bind(authController));

// User routes
app.get('/api/users/profile', authenticate, userController.getProfile.bind(userController));
app.put('/api/users/profile', authenticate, userController.updateProfile.bind(userController));
app.delete('/api/users/profile', authenticate, userController.deleteAccount.bind(userController));

// Location routes
app.get('/api/locations', locationController.getLocations.bind(locationController));
app.get('/api/locations/nearby', locationController.getNearbyLocations.bind(locationController));
app.get('/api/locations/:id', locationController.getLocationById.bind(locationController));
app.post('/api/locations', authenticate, authorize(['ADMIN']), locationController.createLocation.bind(locationController));
app.put('/api/locations/:id', authenticate, authorize(['ADMIN']), locationController.updateLocation.bind(locationController));
app.delete('/api/locations/:id', authenticate, authorize(['ADMIN']), locationController.deleteLocation.bind(locationController));

// Booking routes
app.get('/api/bookings', authenticate, bookingController.getUserBookings.bind(bookingController));
app.get('/api/bookings/:id', authenticate, bookingController.getBookingById.bind(bookingController));
app.post('/api/bookings', authenticate, bookingController.createBooking.bind(bookingController));
app.put('/api/bookings/:id/status', authenticate, bookingController.updateBookingStatus.bind(bookingController));
app.delete('/api/bookings/:id', authenticate, bookingController.cancelBooking.bind(bookingController));

// Schedule routes
app.get('/api/schedules/location/:locationId', scheduleController.getLocationSchedules.bind(scheduleController));
app.post('/api/schedules', authenticate, authorize(['ADMIN']), scheduleController.createSchedule.bind(scheduleController));
app.put('/api/schedules/:id', authenticate, authorize(['ADMIN']), scheduleController.updateSchedule.bind(scheduleController));
app.delete('/api/schedules/:id', authenticate, authorize(['ADMIN']), scheduleController.deleteSchedule.bind(scheduleController));

// Error handling middleware
app.use((err: Error, req: express.Request, res: express.Response, next: express.NextFunction) => {
  console.error('Error:', err);
  res.status(500).json({
    success: false,
    message: 'Internal server error'
  });
});

// 404 handler
app.use('*', (req, res) => {
  res.status(404).json({
    success: false,
    message: 'Route not found'
  });
});

// Database connection and server start
const startServer = async () => {
  try {
    const mongoUri = process.env.MONGODB_URI || 'mongodb://localhost:27017/valet_db';
    await mongoose.connect(mongoUri);
    console.log('Connected to MongoDB');
    
    app.listen(PORT, () => {
      console.log(`Server running on port ${PORT}`);
    });
  } catch (error) {
    console.error('Failed to start server:', error);
    process.exit(1);
  }
};

if (process.env.NODE_ENV !== 'test') {
  startServer();
}

export default app; 