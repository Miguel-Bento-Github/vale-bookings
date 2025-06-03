import { Router } from 'express';
import { BookingController } from '../controllers/BookingController';
import { authenticate } from '../middleware/auth';

const router = Router();
const bookingController = new BookingController();

router.get('/', authenticate, bookingController.getUserBookings.bind(bookingController));
router.get('/:id', authenticate, bookingController.getBookingById.bind(bookingController));
router.post('/', authenticate, bookingController.createBooking.bind(bookingController));
router.put('/:id/status', authenticate, bookingController.updateBookingStatus.bind(bookingController));
router.delete('/:id', authenticate, bookingController.cancelBooking.bind(bookingController));

export default router; 