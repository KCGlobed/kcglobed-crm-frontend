import { Router } from 'express';
import authRoutes from './auth.routes';
import userRoutes from './user.routes';
import teamRoutes from './team.routes';
import permissionTemplateRoutes from './permissionTemplate.routes';
import masterRoutes from './master.routes';
import leadRoutes from './lead.routes';
import captureRoutes from './capture.routes';
import { requireAuth } from '../middlewares/auth';
import { permit } from '../middlewares/permit';
import * as notificationController from '../controllers/notification.controller';
import * as auditController from '../controllers/audit.controller';
import * as dashboardController from '../controllers/dashboard.controller';

const router = Router();

// Public capture endpoints must be mounted before the authed /leads router.
router.use('/', captureRoutes);

router.use('/auth', authRoutes);
router.use('/users', userRoutes);
router.use('/teams', teamRoutes);
router.use('/permission-templates', permissionTemplateRoutes);
router.use('/masters', masterRoutes);
router.use('/leads', leadRoutes);

router.get('/notifications', requireAuth, notificationController.list);
router.patch('/notifications/read-all', requireAuth, notificationController.markAllRead);
router.patch('/notifications/:id/read', requireAuth, notificationController.markRead);

router.get('/audit-logs', requireAuth, permit('audit', 'view'), auditController.list);
router.get('/dashboard/summary', requireAuth, permit('dashboard', 'view'), dashboardController.summary);

export default router;
