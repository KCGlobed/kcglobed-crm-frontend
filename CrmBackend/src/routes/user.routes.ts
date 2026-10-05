import { Router } from 'express';
import * as controller from '../controllers/user.controller';
import { requireAuth } from '../middlewares/auth';
import { permit } from '../middlewares/permit';
import { validate } from '../middlewares/validate';
import {
  createUserSchema,
  setPermissionsSchema,
  updateUserSchema,
} from '../validators/user.schema';

const router = Router();

router.use(requireAuth);

router.get('/options', controller.options);
router.get('/', permit('users', 'view'), controller.list);
router.post('/', permit('users', 'create'), validate(createUserSchema), controller.create);
router.get('/:id', permit('users', 'view'), controller.getById);
router.put('/:id', permit('users', 'edit'), validate(updateUserSchema), controller.update);
router.post(
  '/:id/permissions',
  permit('users', 'edit'),
  validate(setPermissionsSchema),
  controller.setPermissions
);
router.delete('/:id', permit('users', 'delete'), controller.deactivate);

export default router;
