import { Router } from 'express';
import { Model } from 'mongoose';
import { ZodType } from 'zod';
import { makeMasterController, bootstrap } from '../controllers/master.controller';
import { requireAuth } from '../middlewares/auth';
import { permit } from '../middlewares/permit';
import { validate } from '../middlewares/validate';
import {
  Cohort,
  CustomFieldDef,
  Disposition,
  Program,
  Source,
  Stage,
  Tag,
} from '../models/masters';
import {
  cohortSchema,
  customFieldSchema,
  dispositionSchema,
  programSchema,
  sourceSchema,
  stageSchema,
  tagSchema,
} from '../validators/master.schema';

const router = Router();
router.use(requireAuth);

// Dropdown data for any signed-in user; management stays behind masters.* permissions.
router.get('/bootstrap', bootstrap);

/* eslint-disable @typescript-eslint/no-explicit-any */
interface MountConfig {
  path: string;
  model: Model<any>;
  entityType: string;
  schema: ZodType;
  searchFields?: string[];
  sortable?: string[];
  defaultSort?: string;
  populate?: { path: string; select: string }[];
  deactivate?: (doc: Record<string, unknown>) => void;
  extraFilters?: (query: Record<string, unknown>) => Record<string, unknown>;
}

function mount(cfg: MountConfig) {
  const controller = makeMasterController({
    model: cfg.model,
    entityType: cfg.entityType,
    searchFields: cfg.searchFields ?? ['name'],
    sortable: cfg.sortable ?? ['name', 'createdAt', 'sortOrder'],
    defaultSort: cfg.defaultSort,
    populate: cfg.populate,
    deactivate: cfg.deactivate ?? ((doc) => { doc.isActive = false; }),
    extraFilters: cfg.extraFilters,
  });
  const sub = Router();
  sub.get('/', permit('masters', 'view'), controller.list);
  sub.post('/', permit('masters', 'create'), validate(cfg.schema), controller.create);
  sub.get('/:id', permit('masters', 'view'), controller.getById);
  sub.put('/:id', permit('masters', 'edit'), validate((cfg.schema as never as { partial: () => ZodType }).partial()), controller.update);
  sub.delete('/:id', permit('masters', 'delete'), controller.remove);
  router.use(cfg.path, sub);
}

mount({ path: '/sources', model: Source, entityType: 'Source', schema: sourceSchema, extraFilters: (q) => (q.channel ? { channel: q.channel } : {}) });
mount({ path: '/programs', model: Program, entityType: 'Program', schema: programSchema, searchFields: ['name', 'code'] });
mount({
  path: '/cohorts',
  model: Cohort,
  entityType: 'Cohort',
  schema: cohortSchema,
  sortable: ['name', 'startDate', 'createdAt'],
  defaultSort: 'startDate',
  populate: [{ path: 'program', select: 'name code' }],
  deactivate: (doc) => { doc.status = 'closed'; },
  extraFilters: (q) => ({ ...(q.program ? { program: q.program } : {}), ...(q.status ? { status: q.status } : {}) }),
});
mount({ path: '/stages', model: Stage, entityType: 'Stage', schema: stageSchema, sortable: ['name', 'order'], defaultSort: 'order' });
mount({ path: '/dispositions', model: Disposition, entityType: 'Disposition', schema: dispositionSchema });
mount({ path: '/tags', model: Tag, entityType: 'Tag', schema: tagSchema });
mount({ path: '/custom-fields', model: CustomFieldDef, entityType: 'Custom field', schema: customFieldSchema, searchFields: ['key', 'label'], sortable: ['label', 'sortOrder', 'createdAt'] });

export default router;
