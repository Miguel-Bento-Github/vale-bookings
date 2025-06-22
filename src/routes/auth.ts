import { Router } from 'express';

import { 
  register, 
  login, 
  refreshToken, 
  me, 
  changePassword, 
  deleteAccount, 
  getAllUsers, 
  deleteUser 
} from '../controllers/AuthController';
import { authenticate, requireAdmin } from '../middleware/auth';

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
router.post('/change-password', authenticate, (req, res, next) => {
  changePassword(req, res).catch(next);
});
router.delete('/delete-account', authenticate, (req, res, next) => {
  deleteAccount(req, res).catch(next);
});
router.get('/users', authenticate, requireAdmin, (req, res, next) => {
  getAllUsers(req, res).catch(next);
});
router.delete('/users/:id', authenticate, requireAdmin, (req, res, next) => {
  deleteUser(req, res).catch(next);
});

export default router; 