import { Request } from 'express';
import { asyncHandler } from '../utils/asyncHandler';
import { buildPagination, created, ok } from '../utils/respond';
import { parseListQuery } from '../utils/pagination';
import * as leadService from '../services/lead.service';
import { importLeads } from '../services/leadImport.service';
import { audit } from '../services/audit.service';
import { ApiError } from '../utils/ApiError';
import { bulkUploadBodySchema } from '../validators/lead.schema';

const SORTABLE = ['createdAt', 'updatedAt', 'firstName', 'stageChangedAt', 'lastActivityAt', 'assignedAt'];

function actorOf(req: Request): leadService.ActorContext {
  const u = req.user!;
  return {
    id: u.id,
    name: u.name,
    isSuperAdmin: u.isSuperAdmin,
    dataScope: u.dataScope,
    fieldRules: u.fieldRules,
    team: u.team,
  };
}

function filtersOf(req: Request) {
  const q = req.query;
  return {
    stage: q.stage as string | undefined,
    subStage: q.sub_stage as string | undefined,
    source: q.source as string | undefined,
    owner: q.owner as string | undefined,
    program: q.program as string | undefined,
    cohort: q.cohort as string | undefined,
    tag: q.tag as string | undefined,
    status: q.status as string | undefined,
    track: q.track as string | undefined,
    created_from: q.created_from as string | undefined,
    created_to: q.created_to as string | undefined,
    unassigned: q.unassigned as string | undefined,
  };
}

export const list = asyncHandler(async (req, res) => {
  const query = parseListQuery(req, SORTABLE);
  const { items, total } = await leadService.listLeads(actorOf(req), query, filtersOf(req));
  ok(res, 'Leads fetched successfully', items, buildPagination(total, query.page, query.pageSize));
});

export const create = asyncHandler(async (req, res) => {
  // Own-scope users keep leads they add — otherwise the lead would vanish
  // from their view the moment it is created.
  if (!req.body.owner && !req.body.autoAssign && req.user!.dataScope === 'own' && !req.user!.isSuperAdmin) {
    req.body.owner = req.user!.id;
  }
  const lead = await leadService.createLead(req.body, {
    via: 'manual',
    actor: actorOf(req),
    autoAssign: req.body.autoAssign,
  });
  audit(req, {
    action: 'create',
    module: 'leads',
    entityType: 'Lead',
    entityId: String((lead as { _id: unknown })._id),
  });
  created(res, 'Lead created successfully', lead);
});

export const getById = asyncHandler(async (req, res) => {
  const lead = await leadService.getLeadForActor(actorOf(req), req.params.id);
  ok(res, 'Lead fetched successfully', lead);
});

export const update = asyncHandler(async (req, res) => {
  const { lead } = await leadService.updateLead(actorOf(req), req.params.id, req.body);
  audit(req, { action: 'update', module: 'leads', entityType: 'Lead', entityId: req.params.id, after: req.body });
  ok(res, 'Lead updated successfully', lead);
});

export const assign = asyncHandler(async (req, res) => {
  const lead = await leadService.assignLead(actorOf(req), req.params.id, req.body.owner);
  audit(req, {
    action: 'assign',
    module: 'leads',
    entityType: 'Lead',
    entityId: req.params.id,
    after: { owner: req.body.owner },
  });
  ok(res, 'Lead assigned successfully', lead);
});

export const remove = asyncHandler(async (req, res) => {
  await leadService.softDeleteLead(actorOf(req), req.params.id);
  audit(req, { action: 'delete', module: 'leads', entityType: 'Lead', entityId: req.params.id });
  ok(res, 'Lead deleted successfully', null);
});

export const addNote = asyncHandler(async (req, res) => {
  const note = await leadService.addNote(actorOf(req), req.params.id, req.body.body, req.body.category);
  created(res, 'Note added successfully', note);
});

export const listNotes = asyncHandler(async (req, res) => {
  const notes = await leadService.listNotes(actorOf(req), req.params.id);
  ok(res, 'Notes fetched successfully', notes);
});

export const timeline = asyncHandler(async (req, res) => {
  const page = Math.max(1, Number(req.query.page) || 1);
  const pageSize = Math.min(100, Math.max(1, Number(req.query.page_size) || 25));
  const { items, total } = await leadService.getTimeline(actorOf(req), req.params.id, page, pageSize);
  ok(res, 'Timeline fetched successfully', items, buildPagination(total, page, pageSize));
});

export const exportCsv = asyncHandler(async (req, res) => {
  const search = typeof req.query.search === 'string' ? req.query.search : undefined;
  const csv = await leadService.exportLeads(actorOf(req), search, filtersOf(req));
  audit(req, { action: 'export', module: 'leads', entityType: 'Lead' });
  res
    .status(200)
    .setHeader('Content-Type', 'text/csv; charset=utf-8')
    .setHeader('Content-Disposition', `attachment; filename="leads-${Date.now()}.csv"`)
    .send(csv);
});

export const bulkUpload = asyncHandler(async (req, res) => {
  if (!req.file) throw ApiError.badRequest('Upload a CSV or Excel file');

  let mapping: unknown;
  let defaults: unknown;
  try {
    mapping = JSON.parse(req.body.mapping ?? '{}');
    defaults = req.body.defaults ? JSON.parse(req.body.defaults) : {};
  } catch {
    throw ApiError.badRequest('mapping/defaults must be valid JSON');
  }
  const parsed = bulkUploadBodySchema.safeParse({ mapping, defaults });
  if (!parsed.success) {
    throw ApiError.badRequest('Invalid mapping payload', {
      mapping: parsed.error.issues[0]?.message ?? 'Invalid',
    });
  }

  const result = await importLeads(req.file.buffer, parsed.data.mapping, parsed.data.defaults ?? {}, actorOf(req));
  audit(req, {
    action: 'import',
    module: 'leads',
    entityType: 'Lead',
    after: { total: result.total, inserted: result.inserted, failed: result.failed },
  });
  ok(res, `Import finished: ${result.inserted} created, ${result.failed} failed`, result);
});

export const capture = asyncHandler(async (req, res) => {
  const result = await leadService.captureLead(req.body);
  created(res, result.duplicate ? 'Existing lead updated with re-enquiry' : 'Lead captured successfully', result);
});
