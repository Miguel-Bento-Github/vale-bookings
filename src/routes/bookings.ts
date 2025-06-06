import { Router } from 'express';
import { getUserBookings, getBookingById, createBooking, updateBookingStatus, cancelBooking } from '../controllers/BookingController';
import { authenticate } from '../middleware/auth';

const router = Router();

router.get('/', authenticate, getUserBookings);
router.get('/:id', authenticate, getBookingById);
router.post('/', authenticate, createBooking);
router.put('/:id/status', authenticate, updateBookingStatus);
router.delete('/:id', authenticate, cancelBooking);

export default router; 