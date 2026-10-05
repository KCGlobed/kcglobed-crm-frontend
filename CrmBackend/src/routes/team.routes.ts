import { Router } from 'express';
import * as controller from '../controllers/team.controller';
import { requireAuth } from '../middlewares/auth';
import { permit } from '../middlewares/permit';
import { validate } from '../middlewares/validate';
import { addMembersSchema, teamSchema } from '../validators/team.schema';

const router = Router();

router.use(requireAuth);

// Static paths first so they are not captured by /:id.
router.get('/options', controller.options);
router.get('/tree', permit('teams', 'view'), controller.tree);

router.get('/', permit('teams', 'view'), controller.list);
router.post('/', permit('teams', 'create'), validate(teamSchema), controller.create);

router.get('/:id', permit('teams', 'view'), controller.getById);
router.put('/:id', permit('teams', 'edit'), validate(teamSchema.partial()), controller.update);
router.delete('/:id', permit('teams', 'delete'), controller.remove);
router.get('/:id/stats', permit('teams', 'view'), controller.stats);
router.post('/:id/members', permit('teams', 'edit'), validate(addMembersSchema), controller.addMembers);
router.delete('/:id/members/:userId', permit('teams', 'edit'), controller.removeMember);

export default router;
