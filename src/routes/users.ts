import { Router } from 'express';
import { getProfile, updateProfile, deleteAccount } from '../controllers/UserController';
import { authenticate } from '../middleware/auth';

const router = Router();

router.get('/profile', authenticate, getProfile);
router.put('/profile', authenticate, updateProfile);
router.delete('/profile', authenticate, deleteAccount);

export default router; 