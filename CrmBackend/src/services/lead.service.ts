import { QueryFilter, Types } from 'mongoose';
import { ILead, Lead, LeadCreatedVia } from '../models/Lead';
import { CustomFieldDef, Source, Stage } from '../models/masters';
import { Note } from '../models/Note';
import { LeadActivity } from '../models/LeadActivity';
import { User } from '../models/User';
import { ApiError } from '../utils/ApiError';
import { escapeRegex } from '../utils/pagination';
import { normalizeEmail, normalizeMobile } from '../utils/normalize';
import { applyFieldRules, stripUneditableFields } from '../utils/masking';
import { buildOwnerScopeFilter } from '../utils/scope';
import { nextSequence } from '../models/Counter';
import { ListQuery } from '../types/api';
import { FieldRule } from '../constants/permissions';
import { logActivity } from './activity.service';
import { notify } from './notification.service';
import { pickNextOwner } from './assignment.service';

export interface ActorContext {
  id: string;
  name: string;
  isSuperAdmin: boolean;
  dataScope: string;
  fieldRules: FieldRule[];
  team?: string;
}

const LEAD_POPULATE = [
  { path: 'source', select: 'name channel' },
  { path: 'firstSource', select: 'name channel' },
  { path: 'stage', select: 'name color type order isSystem subStages' },
  { path: 'owner', select: 'name email' },
  { path: 'programInterest', select: 'name code' },
  { path: 'cohort', select: 'name' },
  { path: 'tags', select: 'name color' },
] as const;

function fullName(lead: Pick<ILead, 'firstName' | 'lastName'>): string {
  return [lead.firstName, lead.lastName].filter(Boolean).join(' ');
}

async function validateCustomFields(
  customFields: Record<string, unknown> | undefined,
  requireAllRequired: boolean
): Promise<void> {
  const defs = await CustomFieldDef.find({ isActive: true }).lean();
  const errors: Record<string, string> = {};
  const provided = customFields ?? {};

  for (const [key, value] of Object.entries(provided)) {
    const def = defs.find((d) => d.key === key);
    if (!def) {
      errors[`customFields.${key}`] = 'Unknown custom field';
      continue;
    }
    if (value == null || value === '') continue;
    if (def.type === 'number' && typeof value !== 'number') {
      errors[`customFields.${key}`] = `${def.label} must be a number`;
    } else if (def.type === 'boolean' && typeof value !== 'boolean') {
      errors[`customFields.${key}`] = `${def.label} must be true/false`;
    } else if (def.type === 'select' && !def.options.includes(String(value))) {
      errors[`customFields.${key}`] = `${def.label} must be one of: ${def.options.join(', ')}`;
    } else if (def.type === 'date' && Number.isNaN(Date.parse(String(value)))) {
      errors[`customFields.${key}`] = `${def.label} must be a valid date`;
    }
  }
  if (requireAllRequired) {
    for (const def of defs.filter((d) => d.required)) {
      const value = provided[def.key];
      if (value == null || value === '') {
        errors[`customFields.${def.key}`] = `${def.label} is required`;
      }
    }
  }
  if (Object.keys(errors).length) {
    throw ApiError.badRequest('Validation failed', errors);
  }
}

async function findDuplicate(mobile?: string, email?: string, excludeId?: string) {
  const or: QueryFilter<ILead>[] = [];
  if (mobile) or.push({ mobile });
  if (email) or.push({ email });
  if (!or.length) return null;
  return Lead.findOne({
    isDeleted: false,
    ...(excludeId ? { _id: { $ne: excludeId } } : {}),
    $or: or,
  })
    .select('leadNo firstName lastName mobile email owner')
    .lean();
}

async function defaultStageId(): Promise<Types.ObjectId | undefined> {
  const stage = await Stage.findOne({ isActive: true, type: 'open' }).sort({ order: 1 }).lean();
  return stage?._id;
}

/**
 * Validates a stage + sub-stage pick (Lead Stages sheet). The sub-stage must
 * belong to the stage, and is required when the stage has active sub-stages.
 * System stages (e.g. Untouched) are only ever set by the CRM itself.
 */
async function assertStageChoice(
  stageId: string,
  subStageId: string | null | undefined,
  opts: { allowSystem: boolean; requireSubStage: boolean }
) {
  const stage = await Stage.findById(stageId).lean();
  if (!stage || !stage.isActive) {
    throw ApiError.badRequest('Validation failed', { stage: 'Select an active stage' });
  }
  if (stage.isSystem && !opts.allowSystem) {
    throw ApiError.unprocessable(`"${stage.name}" is set by the system and cannot be chosen manually`, {
      stage: 'This stage is set by the system',
    });
  }
  const subStages = stage.subStages ?? [];
  if (subStageId) {
    const sub = subStages.find((ss) => String(ss._id) === String(subStageId));
    if (!sub) {
      throw ApiError.badRequest('Validation failed', { subStage: 'This sub-stage does not belong to the selected stage' });
    }
    return { stage, sub };
  }
  if (opts.requireSubStage && subStages.some((ss) => ss.isActive)) {
    throw ApiError.badRequest('Validation failed', { subStage: 'Select a sub-stage' });
  }
  return { stage, sub: undefined };
}

const stageLabel = (stageName?: string, subName?: string) =>
  stageName ? (subName ? `${stageName} (${subName})` : stageName) : '—';

interface CreateOptions {
  via: LeadCreatedVia;
  actor?: ActorContext;
  autoAssign?: boolean;
}

export async function createLead(payload: Record<string, unknown>, opts: CreateOptions) {
  const mobile = normalizeMobile(payload.mobile as string);
  const email = normalizeEmail(payload.email as string);
  if (!mobile) throw ApiError.badRequest('Validation failed', { mobile: 'Mobile number is required' });

  const duplicate = await findDuplicate(mobile, email);
  if (duplicate) {
    const field = duplicate.mobile === mobile ? 'mobile' : 'email';
    throw ApiError.conflict(
      `A lead with this ${field} already exists (${duplicate.leadNo} — ${fullName(duplicate as never)})`,
      { [field]: `Already exists on lead ${duplicate.leadNo}` }
    );
  }

  await validateCustomFields(payload.customFields as Record<string, unknown>, false);

  const seq = await nextSequence('lead');
  const leadNo = `LD-${String(seq).padStart(6, '0')}`;
  const stage = (payload.stage as string | undefined) ?? (await defaultStageId());
  if (payload.stage) {
    // A person picking the stage must also pick its sub-stage; imports may leave it empty.
    const manual = opts.via === 'manual';
    await assertStageChoice(String(payload.stage), payload.subStage as string | null | undefined, {
      allowSystem: !manual,
      requireSubStage: manual,
    });
  }

  let owner = (payload.owner as string | null | undefined) ?? undefined;
  if (!owner && (opts.autoAssign || payload.autoAssign)) {
    const picked = await pickNextOwner();
    owner = picked ? String(picked) : undefined;
  }

  const { autoAssign: _ignored, ...rest } = payload;
  const lead = await Lead.create({
    ...rest,
    mobile,
    email,
    leadNo,
    stage,
    stageChangedAt: new Date(),
    firstSource: payload.source,
    owner,
    assignedAt: owner ? new Date() : undefined,
    createdVia: opts.via,
    createdBy: opts.actor?.id,
    lastActivityAt: new Date(),
  } as unknown as ILead);

  await logActivity(lead._id, {
    type: 'created',
    title: `Lead created via ${opts.via}`,
    actor: opts.actor?.id,
    actorName: opts.actor?.name ?? 'system',
    data: { via: opts.via },
  });

  if (owner) {
    await logActivity(lead._id, {
      type: 'assignment',
      title: `Assigned to owner`,
      actor: opts.actor?.id,
      actorName: opts.actor?.name ?? 'system',
      data: { owner },
    });
    notify(owner, 'lead_assigned', 'New lead assigned to you', `${fullName(lead)} (${leadNo})`, {
      leadId: String(lead._id),
    });
  }

  return getPopulatedLead(lead._id);
}

export async function getPopulatedLead(id: Types.ObjectId | string) {
  let q = Lead.findById(id);
  for (const p of LEAD_POPULATE) q = q.populate(p.path, p.select);
  const lead = await q.lean();
  if (!lead) throw ApiError.notFound('Lead not found');
  return lead;
}

interface LeadFilters {
  stage?: string;
  subStage?: string;
  source?: string;
  owner?: string;
  program?: string;
  cohort?: string;
  tag?: string;
  status?: string;
  track?: string;
  created_from?: string;
  created_to?: string;
  unassigned?: string;
}

async function buildLeadWhere(
  actor: ActorContext,
  search: string | undefined,
  filters: LeadFilters
): Promise<QueryFilter<ILead>> {
  const where: QueryFilter<ILead> = { isDeleted: false };

  const scope = await buildOwnerScopeFilter(actor);
  if (scope.owner) {
    // Scoped users also see unassigned leads so new arrivals are not invisible
    // to the team that must pick them up; own-scope stays strictly own.
    if (actor.dataScope === 'own') Object.assign(where, scope);
    else where.$and = [{ $or: [scope, { owner: null }] }];
  }

  if (search) {
    const rx = new RegExp(escapeRegex(search), 'i');
    const digits = search.replace(/\D/g, '');
    const or: QueryFilter<ILead>[] = [
      { firstName: rx },
      { lastName: rx },
      { email: rx },
      { leadNo: rx },
    ];
    if (digits.length >= 4) or.push({ mobile: new RegExp(escapeRegex(digits)) });
    where.$or = or;
  }

  if (filters.stage) where.stage = filters.stage;
  if (filters.subStage && Types.ObjectId.isValid(filters.subStage)) where.subStage = new Types.ObjectId(filters.subStage);
  if (filters.source) where.source = filters.source;
  if (filters.owner) where.owner = filters.owner;
  if (filters.unassigned === 'true') where.owner = null;
  if (filters.program) where.programInterest = filters.program;
  if (filters.cohort) where.cohort = filters.cohort;
  if (filters.tag) where.tags = filters.tag;
  if (filters.status) where.status = filters.status as ILead['status'];
  if (filters.track) where.track = filters.track as ILead['track'];
  if (filters.created_from || filters.created_to) {
    where.createdAt = {};
    if (filters.created_from) (where.createdAt as Record<string, Date>).$gte = new Date(filters.created_from);
    if (filters.created_to) {
      const to = new Date(filters.created_to);
      to.setHours(23, 59, 59, 999);
      (where.createdAt as Record<string, Date>).$lte = to;
    }
  }
  return where;
}

export async function listLeads(actor: ActorContext, query: ListQuery, filters: LeadFilters) {
  const where = await buildLeadWhere(actor, query.search, filters);

  let find = Lead.find(where)
    .sort({ [query.sortBy]: query.sortOrder })
    .skip((query.page - 1) * query.pageSize)
    .limit(query.pageSize);
  for (const p of LEAD_POPULATE) find = find.populate(p.path, p.select);

  const [items, total] = await Promise.all([find.lean(), Lead.countDocuments(where)]);
  const masked = items.map((l) => applyFieldRules(l as unknown as Record<string, unknown>, actor.fieldRules));
  return { items: masked, total };
}

export async function getLeadForActor(actor: ActorContext, id: string) {
  const scope = await buildOwnerScopeFilter(actor);
  const where: QueryFilter<ILead> = { _id: id, isDeleted: false };
  if (scope.owner) {
    if (actor.dataScope === 'own') Object.assign(where, scope);
    else where.$or = [scope, { owner: null }];
  }
  let q = Lead.findOne(where);
  for (const p of LEAD_POPULATE) q = q.populate(p.path, p.select);
  const lead = await q.populate('createdBy', 'name').lean();
  if (!lead) throw ApiError.notFound('Lead not found or not accessible');
  return applyFieldRules(lead as unknown as Record<string, unknown>, actor.fieldRules);
}

export async function updateLead(actor: ActorContext, id: string, payload: Record<string, unknown>) {
  const scope = await buildOwnerScopeFilter(actor);
  const where: QueryFilter<ILead> = { _id: id, isDeleted: false };
  if (scope.owner) {
    if (actor.dataScope === 'own') Object.assign(where, scope);
    else where.$or = [scope, { owner: null }];
  }
  const lead = await Lead.findOne(where);
  if (!lead) throw ApiError.notFound('Lead not found or not accessible');

  const safePayload = stripUneditableFields(payload, actor.fieldRules);

  if (safePayload.mobile) {
    safePayload.mobile = normalizeMobile(safePayload.mobile as string);
  }
  if (safePayload.email !== undefined) {
    safePayload.email = normalizeEmail(safePayload.email as string);
  }
  if (safePayload.mobile || safePayload.email) {
    const duplicate = await findDuplicate(
      (safePayload.mobile as string) ?? undefined,
      (safePayload.email as string) ?? undefined,
      id
    );
    if (duplicate) {
      const field = safePayload.mobile && duplicate.mobile === safePayload.mobile ? 'mobile' : 'email';
      throw ApiError.conflict(`Another lead already uses this ${field} (${duplicate.leadNo})`, {
        [field]: `Already exists on lead ${duplicate.leadNo}`,
      });
    }
  }

  if (safePayload.customFields) {
    await validateCustomFields(safePayload.customFields as Record<string, unknown>, false);
  }

  const before = lead.toObject();
  const stageChanged =
    safePayload.stage !== undefined && String(safePayload.stage) !== String(lead.stage ?? '');
  const stageTouched = safePayload.stage !== undefined || safePayload.subStage !== undefined;

  let stagePick: Awaited<ReturnType<typeof assertStageChoice>> | undefined;
  if (stageTouched) {
    const targetStage = String(safePayload.stage ?? lead.stage ?? '');
    // Moving to another stage drops the old sub-stage unless a new one is sent.
    const targetSub =
      safePayload.subStage !== undefined ? (safePayload.subStage as string | null) : stageChanged ? null : lead.subStage;
    stagePick = await assertStageChoice(targetStage, targetSub ? String(targetSub) : null, {
      allowSystem: !stageChanged,
      requireSubStage: true,
    });
    safePayload.subStage = stagePick.sub?._id ?? null;
  }
  const subStageChanged = stageTouched && String(safePayload.subStage ?? '') !== String(lead.subStage ?? '');

  Object.assign(lead, safePayload);

  if (stagePick && (stageChanged || subStageChanged)) {
    const newStage = stagePick.stage;
    if (stageChanged) {
      lead.stageChangedAt = new Date();
      lead.status =
        newStage.type === 'converted' ? 'converted' : newStage.type === 'lost' ? 'lost' : 'active';
    }
    const oldStage = before.stage ? await Stage.findById(before.stage).lean() : null;
    const oldSub = oldStage?.subStages?.find((ss) => String(ss._id) === String(before.subStage ?? ''));
    const from = stageLabel(oldStage?.name, oldSub?.name);
    const to = stageLabel(newStage.name, stagePick.sub?.name);
    await logActivity(lead._id, {
      type: 'stage_change',
      title: `Stage changed: ${from} → ${to}`,
      actor: actor.id,
      actorName: actor.name,
      data: { from: oldStage?.name, fromSubStage: oldSub?.name, to: newStage.name, toSubStage: stagePick.sub?.name },
    });
  }

  await lead.save();

  const changedKeys = Object.keys(safePayload).filter((k) => k !== 'stage' && k !== 'subStage');
  if (changedKeys.length) {
    await logActivity(lead._id, {
      type: 'edit',
      title: `Lead updated (${changedKeys.join(', ')})`,
      actor: actor.id,
      actorName: actor.name,
    });
  }

  return { lead: await getPopulatedLead(lead._id), before };
}

export async function assignLead(actor: ActorContext, id: string, ownerId: string) {
  const lead = await Lead.findOne({ _id: id, isDeleted: false });
  if (!lead) throw ApiError.notFound('Lead not found');

  const newOwner = await User.findOne({ _id: ownerId, isActive: true }).select('name').lean();
  if (!newOwner) throw ApiError.badRequest('Selected owner is not an active user');

  const previousOwner = lead.owner ? String(lead.owner) : null;
  lead.owner = new Types.ObjectId(ownerId);
  lead.assignedAt = new Date();
  await lead.save();

  await logActivity(lead._id, {
    type: 'assignment',
    title: `${previousOwner ? 'Reassigned' : 'Assigned'} to ${newOwner.name}`,
    actor: actor.id,
    actorName: actor.name,
    data: { from: previousOwner, to: ownerId },
  });

  notify(ownerId, 'lead_assigned', 'Lead assigned to you', `${fullName(lead)} (${lead.leadNo})`, {
    leadId: String(lead._id),
  });
  if (previousOwner && previousOwner !== ownerId) {
    notify(
      previousOwner,
      'lead_reassigned',
      'Lead reassigned',
      `${fullName(lead)} (${lead.leadNo}) now belongs to ${newOwner.name}`,
      { leadId: String(lead._id) }
    );
  }

  return getPopulatedLead(lead._id);
}

export async function softDeleteLead(actor: ActorContext, id: string) {
  const lead = await Lead.findOne({ _id: id, isDeleted: false });
  if (!lead) throw ApiError.notFound('Lead not found');
  lead.isDeleted = true;
  lead.deletedAt = new Date();
  lead.deletedBy = new Types.ObjectId(actor.id);
  await lead.save();
  return lead;
}

export async function addNote(actor: ActorContext, leadId: string, body: string, category?: string) {
  await getLeadForActor(actor, leadId); // scope check
  const note = await Note.create({ lead: leadId, body, category, createdBy: actor.id });
  await logActivity(leadId, {
    type: 'note',
    title: category ? `Note added (${category})` : 'Note added',
    description: body.length > 300 ? `${body.slice(0, 300)}…` : body,
    actor: actor.id,
    actorName: actor.name,
    data: { noteId: String(note._id) },
  });
  return note.populate('createdBy', 'name');
}

export async function listNotes(actor: ActorContext, leadId: string) {
  await getLeadForActor(actor, leadId);
  return Note.find({ lead: leadId }).populate('createdBy', 'name').sort({ createdAt: -1 }).lean();
}

export async function getTimeline(actor: ActorContext, leadId: string, page: number, pageSize: number) {
  await getLeadForActor(actor, leadId);
  const where = { lead: leadId };
  const [items, total] = await Promise.all([
    LeadActivity.find(where)
      .populate('actor', 'name')
      .sort({ createdAt: -1 })
      .skip((page - 1) * pageSize)
      .limit(pageSize)
      .lean(),
    LeadActivity.countDocuments(where),
  ]);
  return { items, total };
}

const EXPORT_LIMIT = 5000;

function subStageName(lead: { stage?: unknown; subStage?: unknown }) {
  const subs = (lead.stage as { subStages?: { _id: unknown; name: string }[] } | undefined)?.subStages ?? [];
  return subs.find((ss) => String(ss._id) === String(lead.subStage ?? ''))?.name ?? '';
}

export async function exportLeads(actor: ActorContext, search: string | undefined, filters: LeadFilters) {
  const where = await buildLeadWhere(actor, search, filters);
  let find = Lead.find(where).sort({ createdAt: -1 }).limit(EXPORT_LIMIT);
  for (const p of LEAD_POPULATE) find = find.populate(p.path, p.select);
  const leads = await find.lean();

  const headers = [
    'Lead No', 'First Name', 'Last Name', 'Mobile', 'Email', 'City', 'State',
    'Source', 'Channel', 'Stage', 'Sub Stage', 'Status', 'Owner', 'Program', 'Cohort', 'Track',
    'UTM Source', 'UTM Medium', 'UTM Campaign', 'Partner', 'Created At',
  ];
  const escape = (v: unknown) => {
    const s = v == null ? '' : String(v);
    return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };

  const rows = leads.map((raw) => {
    const l = applyFieldRules(raw as unknown as Record<string, unknown>, actor.fieldRules) as Record<string, never>;
    const g = (path: string) => {
      const [a, b] = path.split('.');
      const first = (l as Record<string, unknown>)[a];
      return b && first && typeof first === 'object'
        ? (first as Record<string, unknown>)[b]
        : first;
    };
    return [
      g('leadNo'), g('firstName'), g('lastName'), g('mobile'), g('email'), g('city'), g('state'),
      g('source.name'), g('source.channel'), g('stage.name'), subStageName(raw), g('status'), g('owner.name'),
      g('programInterest.name'), g('cohort.name'), g('track'),
      g('utm.source'), g('utm.medium'), g('utm.campaign'), g('referral.partnerName'),
      raw.createdAt ? new Date(raw.createdAt as never).toISOString() : '',
    ].map(escape).join(',');
  });

  return [headers.join(','), ...rows].join('\n');
}

/** Public capture (website / landing pages / Meta / Google connectors). */
export async function captureLead(payload: Record<string, unknown>) {
  const mobile = normalizeMobile(payload.mobile as string);
  const email = normalizeEmail(payload.email as string);
  if (!mobile) throw ApiError.badRequest('Validation failed', { mobile: 'Mobile number is required' });

  // Resolve source by name; fall back to a generic bucket so capture never fails.
  const sourceName = (payload.source as string) || 'Website';
  let source = await Source.findOne({ name: new RegExp(`^${escapeRegex(sourceName)}$`, 'i') });
  if (!source) {
    source = await Source.findOneAndUpdate(
      { name: sourceName },
      { $setOnInsert: { name: sourceName, channel: 'other' } },
      { upsert: true, returnDocument: 'after' }
    );
  }
  if (!source) throw ApiError.badRequest('Unable to resolve lead source');

  const existing = await findDuplicate(mobile, email);
  if (existing) {
    // Re-enquiry: keep first-touch, update latest-touch (SOW IDs 19, 38, 39).
    await Lead.updateOne({ _id: existing._id }, { source: source._id });
    await logActivity(existing._id, {
      type: 'system',
      title: `Re-enquiry via ${sourceName}`,
      data: { utm_campaign: payload.utm_campaign, landing_page: payload.landing_page },
    });
    return { duplicate: true, leadNo: existing.leadNo, leadId: String(existing._id) };
  }

  let firstName = payload.firstName as string | undefined;
  let lastName = payload.lastName as string | undefined;
  if (!firstName && payload.name) {
    const parts = String(payload.name).trim().split(/\s+/);
    firstName = parts[0];
    lastName = parts.slice(1).join(' ') || undefined;
  }
  if (!firstName) throw ApiError.badRequest('Validation failed', { name: 'Name is required' });

  const programName = payload.program as string | undefined;
  const program = programName
    ? await (await import('../models/masters')).Program.findOne({
        $or: [{ name: new RegExp(`^${escapeRegex(programName)}$`, 'i') }, { code: programName.toUpperCase() }],
      }).lean()
    : null;

  const via = (payload.channel as LeadCreatedVia) || 'capture';
  const lead = await createLead(
    {
      firstName,
      lastName,
      email,
      mobile,
      city: payload.city,
      state: payload.state,
      source: String(source._id),
      programInterest: program ? String(program._id) : undefined,
      track: payload.track ?? (via === 'meta' || via === 'google' ? 'ads' : payload.partner_name || payload.referral_code ? 'partner' : 'other'),
      utm: {
        source: payload.utm_source,
        medium: payload.utm_medium,
        campaign: payload.utm_campaign,
        term: payload.utm_term,
        content: payload.utm_content,
        landingPage: payload.landing_page,
      },
      referral: {
        code: payload.referral_code,
        partnerName: payload.partner_name,
        partnerLink: payload.partner_link,
      },
    },
    { via, autoAssign: true }
  );
  return { duplicate: false, leadNo: (lead as { leadNo: string }).leadNo, leadId: String((lead as { _id: unknown })._id) };
}
