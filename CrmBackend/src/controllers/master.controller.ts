import { Model } from 'mongoose';
import { RequestHandler } from 'express';
import { asyncHandler } from '../utils/asyncHandler';
import { buildPagination, created, ok } from '../utils/respond';
import { escapeRegex, parseListQuery } from '../utils/pagination';
import { ApiError } from '../utils/ApiError';
import { audit } from '../services/audit.service';
import {
  Cohort,
  CustomFieldDef,
  Disposition,
  Program,
  Source,
  Stage,
  Tag,
} from '../models/masters';

// Masters share one controller across heterogeneous schemas, so the model is
// intentionally untyped here; each mount's zod schema enforces the shape.
/* eslint-disable @typescript-eslint/no-explicit-any */
interface MasterConfig {
  model: Model<any>;
  entityType: string;
  searchFields: string[];
  sortable: string[];
  defaultSort?: string;
  populate?: { path: string; select: string }[];
  /** how "delete" behaves — all masters deactivate rather than hard-delete */
  deactivate: (doc: Record<string, unknown>) => void;
  extraFilters?: (query: Record<string, unknown>) => Record<string, unknown>;
}

export function makeMasterController(cfg: MasterConfig) {
  const list: RequestHandler = asyncHandler(async (req, res) => {
    const query = parseListQuery(req, cfg.sortable, cfg.defaultSort ?? 'createdAt');
    const where: Record<string, unknown> = {};
    if (query.search) {
      const rx = new RegExp(escapeRegex(query.search), 'i');
      where.$or = cfg.searchFields.map((f) => ({ [f]: rx }));
    }
    if (req.query.is_active === 'true') where.isActive = true;
    if (req.query.is_active === 'false') where.isActive = false;
    Object.assign(where, cfg.extraFilters?.(req.query as Record<string, unknown>) ?? {});

    let find = cfg.model
      .find(where)
      .sort({ [query.sortBy]: query.sortOrder })
      .skip((query.page - 1) * query.pageSize)
      .limit(query.pageSize);
    for (const p of cfg.populate ?? []) find = find.populate(p.path, p.select);

    const [items, total] = await Promise.all([find.lean(), cfg.model.countDocuments(where)]);
    ok(res, `${cfg.entityType} list fetched successfully`, items, buildPagination(total, query.page, query.pageSize));
  });

  const createOne: RequestHandler = asyncHandler(async (req, res) => {
    const doc = await cfg.model.create(req.body);
    audit(req, { action: 'create', module: 'masters', entityType: cfg.entityType, entityId: String(doc._id), after: req.body });
    created(res, `${cfg.entityType} created successfully`, doc);
  });

  const getById: RequestHandler = asyncHandler(async (req, res) => {
    let find = cfg.model.findById(req.params.id);
    for (const p of cfg.populate ?? []) find = find.populate(p.path, p.select);
    const doc = await find.lean();
    if (!doc) throw ApiError.notFound(`${cfg.entityType} not found`);
    ok(res, `${cfg.entityType} fetched successfully`, doc);
  });

  const update: RequestHandler = asyncHandler(async (req, res) => {
    const doc = await cfg.model.findById(req.params.id);
    if (!doc) throw ApiError.notFound(`${cfg.entityType} not found`);
    const before = doc.toObject();
    Object.assign(doc, req.body);
    await doc.save();
    audit(req, { action: 'update', module: 'masters', entityType: cfg.entityType, entityId: String(doc._id), before, after: req.body });
    ok(res, `${cfg.entityType} updated successfully`, doc);
  });

  const remove: RequestHandler = asyncHandler(async (req, res) => {
    const doc = await cfg.model.findById(req.params.id);
    if (!doc) throw ApiError.notFound(`${cfg.entityType} not found`);
    cfg.deactivate(doc as unknown as Record<string, unknown>);
    await doc.save();
    audit(req, { action: 'deactivate', module: 'masters', entityType: cfg.entityType, entityId: String(doc._id) });
    ok(res, `${cfg.entityType} deactivated successfully`, doc);
  });

  return { list, create: createOne, getById, update, remove };
}

/** Single call that loads every dropdown the CRM UI needs (cached client-side). */
export const bootstrap: RequestHandler = asyncHandler(async (_req, res) => {
  const [sources, programs, cohorts, stages, dispositions, tags, customFields] = await Promise.all([
    Source.find({ isActive: true }).sort({ sortOrder: 1, name: 1 }).lean(),
    Program.find({ isActive: true }).sort({ sortOrder: 1, name: 1 }).lean(),
    Cohort.find({ status: { $in: ['planned', 'open'] } })
      .populate('program', 'name code')
      .sort({ startDate: 1 })
      .lean(),
    Stage.find({ isActive: true }).sort({ order: 1 }).lean(),
    Disposition.find({ isActive: true }).sort({ sortOrder: 1, name: 1 }).lean(),
    Tag.find({ isActive: true }).sort({ sortOrder: 1, name: 1 }).lean(),
    CustomFieldDef.find({ isActive: true }).sort({ sortOrder: 1 }).lean(),
  ]);
  ok(res, 'Master data fetched successfully', {
    sources,
    programs,
    cohorts,
    stages,
    dispositions,
    tags,
    customFields,
  });
});
