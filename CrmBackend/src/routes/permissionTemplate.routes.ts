import { Router } from 'express';
import * as controller from '../controllers/permissionTemplate.controller';
import { requireAuth } from '../middlewares/auth';
import { permit } from '../middlewares/permit';
import { validate } from '../middlewares/validate';
import { permissionTemplateSchema } from '../validators/user.schema';

const router = Router();

router.use(requireAuth);

router.get('/', permit('users', 'view'), controller.list);
router.post('/', permit('users', 'create'), validate(permissionTemplateSchema), controller.create);
router.put(
  '/:id',
  permit('users', 'edit'),
  validate(permissionTemplateSchema.partial()),
  controller.update
);
router.delete('/:id', permit('users', 'delete'), controller.remove);

export default router;
