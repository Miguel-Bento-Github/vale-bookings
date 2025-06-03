import { Router } from 'express';
import { UserController } from '../controllers/UserController';
import { authenticate } from '../middleware/auth';

const router = Router();
const userController = new UserController();

router.get('/profile', authenticate, userController.getProfile.bind(userController));
router.put('/profile', authenticate, userController.updateProfile.bind(userController));
router.delete('/profile', authenticate, userController.deleteAccount.bind(userController));

export default router; 