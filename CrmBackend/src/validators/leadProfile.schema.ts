import { z } from 'zod';
import {
  EMPLOYMENT_STATUSES,
  GENDERS,
  GRADE_TYPES,
  INDIAN_STATES,
  MAX_AGE,
  MEDIUMS,
  MIN_AGE,
  MIN_PASSING_YEAR,
  QUALIFICATION_STATUSES,
  RELATIONSHIPS,
  UG_QUALIFICATIONS,
  maxPursuingYear,
} from '../constants/profile';
import { normalizeMobile } from '../utils/normalize';

/**
 * Student profile form rules — Deep Dive: Lead Management Module §4.2.
 * Field numbers (#) in comments refer to that table.
 */

const required = (label: string) => ({ error: `${label} is required` });
const pick = <T extends readonly [string, ...string[]]>(values: T, label: string) =>
  z.enum(values, { error: `Select ${label}` });

/** #1, #2: letters, space and "." only; max 50. */
const personName = (label: string) =>
  z
    .string(required(label))
    .trim()
    .min(1, `${label} is required`)
    .max(50, `${label} must be 50 characters or fewer`)
    .regex(/^[A-Za-z .]+$/, `${label} can only contain letters, spaces and "."`);

/** #4, #14: 10 digits starting 6–9 (after stripping +91, spaces, leading 0). */
const indianMobile = (label: string) =>
  z
    .string(required(label))
    .transform((v) => normalizeMobile(v) ?? '')
    .refine((v) => /^[6-9]\d{9}$/.test(v), `${label} must be 10 digits starting with 6–9`);

const optionalEmail = z
  .union([z.literal(''), z.email('Enter a valid email address')])
  .optional()
  .transform((v) => v || undefined);

const currentYear = () => new Date().getFullYear();

function ageOn(dob: string, today = new Date()) {
  const d = new Date(`${dob}T00:00:00Z`);
  let age = today.getUTCFullYear() - d.getUTCFullYear();
  const beforeBirthday =
    today.getUTCMonth() < d.getUTCMonth() ||
    (today.getUTCMonth() === d.getUTCMonth() && today.getUTCDate() < d.getUTCDate());
  if (beforeBirthday) age--;
  return age;
}

export const personalStepSchema = z
  .object({
    personal: z.object({
      firstName: personName('First name'),
      lastName: personName('Last name'),
      email: z.email('Enter a valid email address'),
      mobile: indianMobile('Mobile number'),
      // #5 — stored as YYYY-MM-DD; age between MIN_AGE and MAX_AGE
      dob: z
        .string(required('Date of birth'))
        .regex(/^\d{4}-\d{2}-\d{2}$/, 'Date of birth is required')
        .refine((v) => !Number.isNaN(new Date(`${v}T00:00:00Z`).getTime()), 'Enter a valid date')
        .refine((v) => {
          const age = ageOn(v);
          return age >= MIN_AGE && age <= MAX_AGE;
        }, `Age must be between ${MIN_AGE} and ${MAX_AGE}`),
      gender: pick(GENDERS, 'a gender'),
      state: pick(INDIAN_STATES, 'a state'),
      city: z.string(required('City')).trim().min(1, 'City is required').max(100),
      pinCode: z.string(required('PIN code')).regex(/^\d{6}$/, 'PIN code must be 6 digits'),
      // #11 — optional
      address: z
        .string()
        .trim()
        .max(250, 'Address must be 250 characters or fewer')
        .optional()
        .transform((v) => v || undefined),
    }),
    guardian: z.object({
      name: z
        .string(required('Parent/guardian name'))
        .trim()
        .min(1, 'Parent/guardian name is required')
        .max(100)
        .regex(/^[A-Za-z ]+$/, 'Parent/guardian name can only contain letters'),
      relationship: pick(RELATIONSHIPS, 'a relationship'),
      mobile: indianMobile('Parent/guardian mobile'),
      // #15 — optional
      email: optionalEmail,
    }),
  })
  .superRefine((v, ctx) => {
    // #14: must not equal the candidate's mobile
    if (v.guardian.mobile && v.guardian.mobile === v.personal.mobile) {
      ctx.addIssue({ code: 'custom', path: ['guardian', 'mobile'], message: "Must be different from the candidate's mobile" });
    }
  });

/** #17/#20/#25: pick the type, then the value — % 0–100 or CGPA 0–10, up to 2 decimals. */
function checkScore(
  ctx: z.RefinementCtx,
  path: (string | number)[],
  gradeType: string | undefined,
  score: number | undefined,
  mandatory: boolean
) {
  if (score === undefined) {
    if (mandatory) ctx.addIssue({ code: 'custom', path: [...path, 'score'], message: 'Score is required' });
    if (mandatory && !gradeType) ctx.addIssue({ code: 'custom', path: [...path, 'gradeType'], message: 'Select a grade type' });
    return;
  }
  if (!gradeType) {
    ctx.addIssue({ code: 'custom', path: [...path, 'gradeType'], message: 'Select a grade type' });
    return;
  }
  const max = gradeType === 'CGPA' ? 10 : 100;
  if (score < 0 || score > max) {
    ctx.addIssue({ code: 'custom', path: [...path, 'score'], message: `${gradeType} must be between 0 and ${max}` });
  } else if (Math.abs(score * 100 - Math.round(score * 100)) > 1e-6) {
    // tolerance: 9.2 * 100 is 919.9999… in floating point
    ctx.addIssue({ code: 'custom', path: [...path, 'score'], message: 'Use at most 2 decimal places' });
  }
}

const year = (label: string) => z.number(required(label)).int(`${label} must be a year`);

const schoolSchema = (cls: string) =>
  z.object({
    yearOfPassing: year(`Class ${cls} year of passing`),
    gradeType: pick(GRADE_TYPES, 'a grade type'),
    score: z.number(required('Score')),
    medium: pick(MEDIUMS, 'a medium'),
  });

export const academicStepSchema = z.object({
  academic: z
    .object({
      class10: schoolSchema('10th'),
      class12: schoolSchema('12th'),
      ug: z.object({
        qualification: pick(UG_QUALIFICATIONS, 'a qualification'),
        status: pick(QUALIFICATION_STATUSES, 'a status'),
        institution: z
          .string(required('Institution name'))
          .trim()
          .min(1, 'Institution name is required')
          .max(150, 'Institution name must be 150 characters or fewer'),
        gradeType: pick(GRADE_TYPES, 'a grade type').optional(),
        score: z.number().optional(),
        yearOfPassing: year('UG year of passing'),
        medium: pick(MEDIUMS, 'a medium'),
      }),
      higherQualification: z.object({
        has: z.boolean({ error: 'Select Yes or No' }),
        details: z.string().trim().max(150, 'Qualification details must be 150 characters or fewer').optional(),
      }),
    })
    .superRefine((a, ctx) => {
      const now = currentYear();
      // #16 — 1990 to current year
      if (a.class10.yearOfPassing < MIN_PASSING_YEAR || a.class10.yearOfPassing > now) {
        ctx.addIssue({ code: 'custom', path: ['class10', 'yearOfPassing'], message: `Year must be between ${MIN_PASSING_YEAR} and ${now}` });
      }
      // #19 — later than #16 (and not in the future)
      if (a.class12.yearOfPassing <= a.class10.yearOfPassing) {
        ctx.addIssue({ code: 'custom', path: ['class12', 'yearOfPassing'], message: 'Must be later than the Class 10th year' });
      } else if (a.class12.yearOfPassing > now) {
        ctx.addIssue({ code: 'custom', path: ['class12', 'yearOfPassing'], message: `Year cannot be after ${now}` });
      }
      checkScore(ctx, ['class10'], a.class10.gradeType, a.class10.score, true);
      checkScore(ctx, ['class12'], a.class12.gradeType, a.class12.score, true);
      // #25 — mandatory if Completed
      checkScore(ctx, ['ug'], a.ug.gradeType, a.ug.score, a.ug.status === 'Completed');
      // #26 — later than #19; a future year only while Pursuing
      const ugYear = a.ug.yearOfPassing;
      const latest = a.ug.status === 'Pursuing' ? maxPursuingYear() : now;
      if (ugYear <= a.class12.yearOfPassing) {
        ctx.addIssue({ code: 'custom', path: ['ug', 'yearOfPassing'], message: 'Must be later than the Class 12th year' });
      } else if (ugYear > latest) {
        ctx.addIssue({
          code: 'custom',
          path: ['ug', 'yearOfPassing'],
          message: a.ug.status === 'Pursuing' ? `Year cannot be after ${latest}` : 'A future year is allowed only while Pursuing',
        });
      }
      // #28 — Yes → details mandatory
      if (a.higherQualification.has && !a.higherQualification.details) {
        ctx.addIssue({ code: 'custom', path: ['higherQualification', 'details'], message: 'Enter the qualification details' });
      }
    })
    // Hidden fields are cleared on save (Deep Dive LM-18).
    .transform((a) => ({
      ...a,
      higherQualification: a.higherQualification.has ? a.higherQualification : { has: false },
    })),
});

export const workStepSchema = z.object({
  work: z
    .object({
      employmentStatus: pick(EMPLOYMENT_STATUSES, 'an employment status'),
      organization: z.string().trim().max(100).optional(),
      designation: z.string().trim().max(100).optional(),
      functionalArea: z.string().trim().max(100).optional(),
      // #33 — years 0–30, months 0–11
      experienceYears: z.number().int('Whole years only').min(0, 'Years must be 0–30').max(30, 'Years must be 0–30').optional(),
      experienceMonths: z.number().int('Whole months only').min(0, 'Months must be 0–11').max(11, 'Months must be 0–11').optional(),
    })
    .superRefine((v, ctx) => {
      if (v.employmentStatus !== 'Experienced') return;
      const needed: [keyof typeof v, string][] = [
        ['organization', 'Organization name is required'],
        ['designation', 'Designation is required'],
        ['functionalArea', 'Functional area is required'],
        ['experienceYears', 'Years are required'],
        ['experienceMonths', 'Months are required'],
      ];
      for (const [key, message] of needed) {
        if (v[key] === undefined || v[key] === '') ctx.addIssue({ code: 'custom', path: [key], message });
      }
    })
    // #30–#33 show only for Experienced; a fresher keeps none of them (LM-18).
    .transform((v) => (v.employmentStatus === 'Fresher' ? { employmentStatus: v.employmentStatus } : v)),
});

export const declarationSchema = z.object({
  accepted: z.literal(true, { error: 'Accept the declaration to continue' }),
});

export const unlockSchema = z.object({
  reason: z.string().trim().min(3, 'Enter a reason for unlocking').max(500),
});
