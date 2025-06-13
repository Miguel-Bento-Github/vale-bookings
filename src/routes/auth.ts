import { Router } from 'express';

import { register, login, refreshToken, me } from '../controllers/AuthController';
import { authenticate } from '../middleware/auth';

const router = Router();

router.post('/register', (req, res, next) => {
    register(req, res).catch(next);
});
router.post('/login', (req, res, next) => {
    login(req, res).catch(next);
});
router.post('/refresh', (req, res, next) => {
    refreshToken(req, res).catch(next);
});
router.get('/me', authenticate, (req, res, next) => {
    me(req, res).catch(next);
});

export default router; 