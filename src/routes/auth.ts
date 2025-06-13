import { Router } from 'express';

import { register, login, refreshToken, me } from '../controllers/AuthController';
import { authenticate } from '../middleware/auth';

const router = Router();

router.post('/register', register);
router.post('/login', login);
router.post('/refresh', refreshToken);
router.get('/me', authenticate, me);

export default router; 