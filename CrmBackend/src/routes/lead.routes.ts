import { Router } from 'express';
import * as controller from '../controllers/lead.controller';
import { requireAuth } from '../middlewares/auth';
import { permit } from '../middlewares/permit';
import { validate } from '../middlewares/validate';
import { spreadsheetUpload } from '../middlewares/upload';
import {
  assignLeadSchema,
  createLeadSchema,
  noteSchema,
  updateLeadSchema,
} from '../validators/lead.schema';
import * as profileController from '../controllers/leadProfile.controller';
import {
  academicStepSchema,
  declarationSchema,
  personalStepSchema,
  unlockSchema,
  workStepSchema,
} from '../validators/leadProfile.schema';

const router = Router();

router.use(requireAuth);

router.get('/', permit('leads', 'view'), controller.list);
router.post('/', permit('leads', 'create'), validate(createLeadSchema), controller.create);
router.post(
  '/bulk-upload',
  permit('leads', 'import'),
  spreadsheetUpload.single('file'),
  controller.bulkUpload
);
router.get('/export', permit('leads', 'export'), controller.exportCsv);
router.get('/:id', permit('leads', 'view'), controller.getById);
router.put('/:id', permit('leads', 'edit'), validate(updateLeadSchema), controller.update);
router.post('/:id/assign', permit('leads', 'reassign'), validate(assignLeadSchema), controller.assign);
router.delete('/:id', permit('leads', 'delete'), controller.remove);
router.post('/:id/notes', permit('leads', 'view'), validate(noteSchema), controller.addNote);
router.get('/:id/notes', permit('leads', 'view'), controller.listNotes);
router.get('/:id/timeline', permit('leads', 'view'), controller.timeline);

// Student profile (Deep Dive: Lead Management §4.2)
router.get('/:id/profile', permit('leads', 'view'), profileController.get);
router.put('/:id/profile/personal', permit('leads', 'edit'), validate(personalStepSchema), profileController.savePersonal);
router.put('/:id/profile/academic', permit('leads', 'edit'), validate(academicStepSchema), profileController.saveAcademic);
router.put('/:id/profile/work', permit('leads', 'edit'), validate(workStepSchema), profileController.saveWork);
router.post('/:id/profile/declaration', permit('leads', 'edit'), validate(declarationSchema), profileController.declare);
router.post('/:id/profile/unlock', permit('leads', 'edit'), validate(unlockSchema), profileController.unlock);

export default router;
