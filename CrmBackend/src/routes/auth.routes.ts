import { Router } from 'express';
import * as controller from '../controllers/auth.controller';
import { validate } from '../middlewares/validate';
import {
  changePasswordSchema,
  forgotPasswordSchema,
  loginSchema,
  resetPasswordSchema,
} from '../validators/auth.schema';
import { requireAuth } from '../middlewares/auth';
import { loginLimiter } from '../middlewares/rateLimiters';

const router = Router();

router.post('/login', loginLimiter, validate(loginSchema), controller.login);
router.post('/refresh', controller.refresh);
router.post('/logout', controller.logout);
router.post('/forgot-password', loginLimiter, validate(forgotPasswordSchema), controller.forgotPassword);
router.post('/reset-password', loginLimiter, validate(resetPasswordSchema), controller.resetPassword);
router.post('/change-password', requireAuth, validate(changePasswordSchema), controller.changePassword);
router.get('/me', requireAuth, controller.me);

export default router;
