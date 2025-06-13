import { Router } from 'express';

import { getProfile, updateProfile, deleteAccount } from '../controllers/UserController';
import { authenticate } from '../middleware/auth';

const router = Router();

router.get('/profile', authenticate, (req, res, next) => {
  getProfile(req, res).catch(next);
});
router.put('/profile', authenticate, (req, res, next) => {
  updateProfile(req, res).catch(next);
});
router.delete('/profile', authenticate, (req, res, next) => {
  deleteAccount(req, res).catch(next);
});

export default router; 