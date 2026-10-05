import { Types } from 'mongoose';
import { ILeadProfile, LeadProfile } from '../models/LeadProfile';
import { ApiError } from '../utils/ApiError';
import { applyFieldRules } from '../utils/masking';
import { normalizeEmail, normalizeMobile } from '../utils/normalize';
import { academicStepSchema, personalStepSchema, workStepSchema } from '../validators/leadProfile.schema';
import { DECLARATION_TEXT, DECLARATION_VERSION } from '../constants/profile';
import { ActorContext, getLeadForActor } from './lead.service';

/**
 * Candidate profile for a lead. Access always goes through the lead, so data
 * scope and field rules match the lead itself. Kept free of HTTP concerns so
 * the student portal can reuse it later.
 */

export type ProfileStep = 'personal' | 'academic' | 'work';

const STEP_SCHEMAS = {
  personal: personalStepSchema,
  academic: academicStepSchema,
  work: workStepSchema,
} as const;

const STEP_LABELS: Record<ProfileStep, string> = {
  personal: 'Step 1 (personal & guardian)',
  academic: 'Step 2 (academic)',
  work: 'Step 3 (work experience)',
};

type ProfileDoc = Pick<
  ILeadProfile,
  'personal' | 'guardian' | 'academic' | 'work' | 'declaration' | 'locked' | 'updatedAt'
>;

const filled = (v: unknown) => v !== undefined && v !== null && v !== '';

/**
 * Profile Completion % (Deep Dive LM-15) = filled fields ÷ applicable fields.
 * Hidden conditional fields don't count, Age is calculated, and the document
 * uploads (#34–#41) are left out until that step is built.
 */
function completionPercent(profile: Partial<ProfileDoc>) {
  const p = profile.personal ?? ({} as Partial<NonNullable<ILeadProfile['personal']>>);
  const g = profile.guardian ?? ({} as Partial<NonNullable<ILeadProfile['guardian']>>);
  const a = profile.academic;
  const w = profile.work;
  const school = (s?: { yearOfPassing?: number; gradeType?: string; score?: number; medium?: string }) => [
    s?.yearOfPassing,
    filled(s?.gradeType) && filled(s?.score) ? true : undefined,
    s?.medium,
  ];
  const fields: unknown[] = [
    p.firstName, p.lastName, p.email, p.mobile, p.dob, p.gender, p.state, p.city, p.pinCode, p.address,
    g.name, g.relationship, g.mobile, g.email,
    ...school(a?.class10),
    ...school(a?.class12),
    a?.ug?.qualification, a?.ug?.status, a?.ug?.institution,
    filled(a?.ug?.gradeType) && filled(a?.ug?.score) ? true : undefined,
    a?.ug?.yearOfPassing, a?.ug?.medium,
    a?.higherQualification?.has,
    ...(a?.higherQualification?.has ? [a.higherQualification.details] : []),
    w?.employmentStatus,
    ...(w?.employmentStatus === 'Experienced'
      ? [w.organization, w.designation, w.functionalArea, filled(w.experienceYears) && filled(w.experienceMonths) ? true : undefined]
      : []),
    profile.declaration?.accepted ? true : undefined,
  ];
  return Math.round((fields.filter(filled).length / fields.length) * 100);
}

/** A step counts as complete when what is stored still passes that step's validation. */
function completedSteps(profile: Partial<ProfileDoc>): Record<ProfileStep, boolean> {
  return {
    personal: personalStepSchema.safeParse({ personal: profile.personal, guardian: profile.guardian }).success,
    academic: academicStepSchema.safeParse({ academic: profile.academic }).success,
    work: workStepSchema.safeParse({ work: profile.work }).success,
  };
}

function present(actor: ActorContext, leadId: string, profile: Partial<ProfileDoc>, exists: boolean) {
  const mask = (section?: object) =>
    section ? applyFieldRules(section as Record<string, unknown>, actor.fieldRules) : null;
  return {
    lead: leadId,
    exists,
    personal: mask(profile.personal),
    guardian: mask(profile.guardian),
    academic: profile.academic ?? null,
    work: profile.work ?? null,
    declaration: profile.declaration?.accepted
      ? { accepted: true, acceptedAt: profile.declaration.acceptedAt, textVersion: profile.declaration.textVersion }
      : { accepted: false },
    declarationText: DECLARATION_TEXT,
    locked: !!profile.locked,
    steps: completedSteps(profile),
    completionPercent: completionPercent(profile),
    updatedAt: profile.updatedAt ?? null,
  };
}

export async function getProfile(actor: ActorContext, leadId: string) {
  const lead = (await getLeadForActor(actor, leadId)) as Record<string, unknown>;
  const profile = await LeadProfile.findOne({ lead: leadId }).lean();
  if (profile) return present(actor, leadId, profile, true);

  // Doc: "Autocapture from Lead Form" — prefill contact fields from the lead.
  const prefill = Object.fromEntries(
    ['firstName', 'lastName', 'email', 'mobile']
      .filter((k) => typeof lead[k] === 'string' && lead[k])
      .map((k) => [k, lead[k]])
  );
  return present(actor, leadId, { personal: prefill as ILeadProfile['personal'] }, false);
}

export async function saveStep(
  actor: ActorContext,
  leadId: string,
  step: ProfileStep,
  body: Record<string, unknown>
) {
  await getLeadForActor(actor, leadId); // 404 outside the caller's scope
  const before = await LeadProfile.findOne({ lead: leadId }).lean();
  if (before?.locked) {
    throw ApiError.unprocessable('The profile is locked after the declaration. Ask an admin to unlock it.');
  }
  // JSON round-trip drops undefined keys — Mongo would otherwise store them as null.
  const data = JSON.parse(JSON.stringify(STEP_SCHEMAS[step].parse(body))) as Record<string, Record<string, unknown>>;

  for (const section of [data.personal, data.guardian]) {
    if (!section) continue;
    if (section.email) section.email = normalizeEmail(section.email as string);
    section.mobile = normalizeMobile(section.mobile as string);
  }

  const profile = await LeadProfile.findOneAndUpdate(
    { lead: leadId },
    {
      $set: { ...data, updatedBy: new Types.ObjectId(actor.id) },
      $setOnInsert: { lead: new Types.ObjectId(leadId) },
    },
    { upsert: true, returnDocument: 'after' }
  ).lean();
  return { before, profile: present(actor, leadId, profile!, true) };
}

export async function acceptDeclaration(actor: ActorContext, leadId: string) {
  await getLeadForActor(actor, leadId);
  const profile = await LeadProfile.findOne({ lead: leadId });
  const steps = completedSteps(profile?.toObject() ?? {});
  const missing = (Object.keys(steps) as ProfileStep[]).filter((s) => !steps[s]);
  if (!profile || missing.length) {
    throw ApiError.unprocessable(
      `Complete ${missing.map((s) => STEP_LABELS[s]).join(', ')} before the declaration`
    );
  }
  if (profile.locked) throw ApiError.unprocessable('The declaration has already been accepted');
  profile.declaration = {
    accepted: true,
    acceptedAt: new Date(),
    acceptedBy: new Types.ObjectId(actor.id),
    textVersion: DECLARATION_VERSION,
  };
  profile.locked = true; // LM-17
  profile.updatedBy = new Types.ObjectId(actor.id);
  await profile.save();
  return present(actor, leadId, profile.toObject(), true);
}

/** LM-17: only an admin can unlock a declared profile, with a reason. The declaration is withdrawn. */
export async function unlockProfile(actor: ActorContext, leadId: string, reason: string) {
  if (!actor.isSuperAdmin) throw ApiError.forbidden('Only an admin can unlock a profile');
  await getLeadForActor(actor, leadId);
  const profile = await LeadProfile.findOne({ lead: leadId });
  if (!profile?.locked) throw ApiError.unprocessable('The profile is not locked');
  profile.locked = false;
  profile.declaration = undefined;
  profile.unlockHistory = [...(profile.unlockHistory ?? []), { by: new Types.ObjectId(actor.id), at: new Date(), reason }];
  profile.updatedBy = new Types.ObjectId(actor.id);
  await profile.save();
  return present(actor, leadId, profile.toObject(), true);
}
