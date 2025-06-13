import { Router } from 'express';

import {
  getUserBookings,
  getBookingById,
  createBooking,
  updateBookingStatus,
  cancelBooking
} from '../controllers/BookingController';
import { authenticate } from '../middleware/auth';

const router = Router();

router.get('/', authenticate, (req, res, next) => {
  getUserBookings(req, res).catch(next);
});
router.get('/:id', authenticate, (req, res, next) => {
  getBookingById(req, res).catch(next);
});
router.post('/', authenticate, (req, res, next) => {
  createBooking(req, res).catch(next);
});
router.put('/:id/status', authenticate, (req, res, next) => {
  updateBookingStatus(req, res).catch(next);
});
router.delete('/:id', authenticate, (req, res, next) => {
  cancelBooking(req, res).catch(next);
});

export default router; 