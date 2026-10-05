import * as XLSX from 'xlsx';
import { Types } from 'mongoose';
import { Lead } from '../models/Lead';
import { LeadActivity } from '../models/LeadActivity';
import { RoundRobinState } from '../models/RoundRobinState';
import { User } from '../models/User';
import { Stage } from '../models/masters';
import { nextSequenceRange } from '../models/Counter';
import { ApiError } from '../utils/ApiError';
import { normalizeEmail, normalizeMobile } from '../utils/normalize';
import { notify } from './notification.service';
import { ActorContext } from './lead.service';

const MAX_ROWS = 5000;
const EMAIL_RX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export interface ImportDefaults {
  source?: string;
  programInterest?: string;
  stage?: string;
  track?: string;
  autoAssign?: boolean;
}

export interface ImportRowError {
  row: number;
  field: string;
  message: string;
}

export interface ImportResult {
  total: number;
  inserted: number;
  failed: number;
  errors: ImportRowError[];
}

/**
 * Bulk lead upload (SOW ID 13): CSV/XLSX with field mapping, validation and a
 * row-level error report. Valid rows load; invalid rows are reported, not silently dropped.
 */
export async function importLeads(
  buffer: Buffer,
  mapping: Record<string, string>,
  defaults: ImportDefaults,
  actor: ActorContext
): Promise<ImportResult> {
  const workbook = XLSX.read(buffer, { type: 'buffer', raw: false });
  const sheet = workbook.Sheets[workbook.SheetNames[0]];
  if (!sheet) throw ApiError.badRequest('The uploaded file has no readable sheet');

  const rows = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet, { defval: '' });
  if (!rows.length) throw ApiError.badRequest('The uploaded file has no data rows');
  if (rows.length > MAX_ROWS) {
    throw ApiError.badRequest(`Maximum ${MAX_ROWS} rows per upload (file has ${rows.length})`);
  }

  const col = (row: Record<string, unknown>, field: string): string => {
    const column = mapping[field];
    if (!column) return '';
    return String(row[column] ?? '').trim();
  };

  if (!mapping.firstName && !mapping.name) {
    throw ApiError.badRequest('Mapping must include a name column (firstName or name)');
  }
  if (!mapping.mobile) {
    throw ApiError.badRequest('Mapping must include a mobile column');
  }

  const errors: ImportRowError[] = [];
  const candidates: {
    rowNo: number;
    doc: Record<string, unknown>;
  }[] = [];
  const seenMobiles = new Set<string>();
  const seenEmails = new Set<string>();

  rows.forEach((row, i) => {
    const rowNo = i + 2; // header is row 1 in the user's file
    let firstName = col(row, 'firstName');
    let lastName = col(row, 'lastName');
    if (!firstName && mapping.name) {
      const parts = col(row, 'name').split(/\s+/).filter(Boolean);
      firstName = parts[0] ?? '';
      lastName = lastName || parts.slice(1).join(' ');
    }
    const mobile = normalizeMobile(col(row, 'mobile'));
    const email = normalizeEmail(col(row, 'email'));

    if (!firstName) {
      errors.push({ row: rowNo, field: 'firstName', message: 'Name is missing' });
      return;
    }
    if (!mobile || mobile.length < 7) {
      errors.push({ row: rowNo, field: 'mobile', message: 'Mobile is missing or invalid' });
      return;
    }
    if (email && !EMAIL_RX.test(email)) {
      errors.push({ row: rowNo, field: 'email', message: `Invalid email: ${email}` });
      return;
    }
    if (seenMobiles.has(mobile)) {
      errors.push({ row: rowNo, field: 'mobile', message: 'Duplicate mobile within the file' });
      return;
    }
    if (email && seenEmails.has(email)) {
      errors.push({ row: rowNo, field: 'email', message: 'Duplicate email within the file' });
      return;
    }
    seenMobiles.add(mobile);
    if (email) seenEmails.add(email);

    candidates.push({
      rowNo,
      doc: {
        firstName,
        lastName: lastName || undefined,
        mobile,
        email,
        city: col(row, 'city') || undefined,
        state: col(row, 'state') || undefined,
        source: defaults.source,
        firstSource: defaults.source,
        programInterest: defaults.programInterest,
        track: defaults.track ?? 'other',
        createdVia: 'import',
        createdBy: actor.id,
      },
    });
  });

  // Existing-lead duplicate check in bulk.
  const existing = await Lead.find({
    isDeleted: false,
    $or: [
      { mobile: { $in: [...seenMobiles] } },
      ...(seenEmails.size ? [{ email: { $in: [...seenEmails] } }] : []),
    ],
  })
    .select('mobile email leadNo')
    .lean();
  const existingMobiles = new Map(existing.map((l) => [l.mobile, l.leadNo]));
  const existingEmails = new Map(existing.filter((l) => l.email).map((l) => [l.email as string, l.leadNo]));

  const toInsert = candidates.filter((c) => {
    const mobile = c.doc.mobile as string;
    const email = c.doc.email as string | undefined;
    if (existingMobiles.has(mobile)) {
      errors.push({ row: c.rowNo, field: 'mobile', message: `Already exists on lead ${existingMobiles.get(mobile)}` });
      return false;
    }
    if (email && existingEmails.has(email)) {
      errors.push({ row: c.rowNo, field: 'email', message: `Already exists on lead ${existingEmails.get(email)}` });
      return false;
    }
    return true;
  });

  let inserted = 0;
  if (toInsert.length) {
    const stageId =
      defaults.stage ??
      (await Stage.findOne({ isActive: true, type: 'open' }).sort({ order: 1 }).lean())?._id;

    // Round-robin pool resolved once for the whole batch.
    let pool: Types.ObjectId[] = [];
    let poolIdx = 0;
    if (defaults.autoAssign) {
      const users = await User.find({ isActive: true, receivesLeads: true })
        .select('_id')
        .sort({ _id: 1 })
        .lean();
      pool = users.map((u) => u._id);
      if (pool.length) {
        const state = await RoundRobinState.findOneAndUpdate(
          { key: 'leads' },
          { $setOnInsert: { key: 'leads' } },
          { upsert: true, returnDocument: 'after' }
        );
        if (state.lastUser) {
          const idx = pool.findIndex((id) => String(id) === String(state.lastUser));
          poolIdx = (idx + 1) % pool.length;
        }
      }
    }

    const startSeq = await nextSequenceRange('lead', toInsert.length);
    const now = new Date();
    const docs = toInsert.map((c, i) => {
      const owner = pool.length ? pool[(poolIdx + i) % pool.length] : undefined;
      return {
        ...c.doc,
        leadNo: `LD-${String(startSeq + i).padStart(6, '0')}`,
        stage: stageId,
        stageChangedAt: now,
        owner,
        assignedAt: owner ? now : undefined,
        lastActivityAt: now,
      };
    });

    const result = await Lead.insertMany(docs, { ordered: false, rawResult: true });
    inserted = result.insertedCount ?? docs.length;

    if (pool.length && docs.length) {
      const lastOwner = pool[(poolIdx + docs.length - 1) % pool.length];
      await RoundRobinState.updateOne({ key: 'leads' }, { lastUser: lastOwner });
    }

    const insertedIds = Object.values(result.insertedIds ?? {});
    await LeadActivity.insertMany(
      insertedIds.map((id) => ({
        lead: id,
        type: 'import',
        title: 'Lead created via bulk import',
        actor: actor.id,
        actorType: 'user',
        actorName: actor.name,
      })),
      { ordered: false }
    );

    // One summary notification per distinct owner.
    if (pool.length) {
      const perOwner = new Map<string, number>();
      docs.forEach((d) => {
        if (d.owner) perOwner.set(String(d.owner), (perOwner.get(String(d.owner)) ?? 0) + 1);
      });
      for (const [ownerId, count] of perOwner) {
        notify(ownerId, 'lead_assigned', `${count} new lead(s) assigned to you`, 'Bulk import distribution');
      }
    }
  }

  return {
    total: rows.length,
    inserted,
    failed: rows.length - inserted,
    errors: errors.slice(0, 200),
  };
}
