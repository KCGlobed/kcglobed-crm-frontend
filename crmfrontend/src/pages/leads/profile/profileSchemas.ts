import { z } from 'zod'
import type { FieldValues, Path, UseFormSetError } from 'react-hook-form'
import { toast } from 'sonner'
import { parseApiError } from '../../../lib/utils'
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
} from '../../../constants/profileOptions'

/** Form inputs give '' (or null for radios) when unanswered — treat it as "not answered". */
export function toNumber(v: unknown) {
  return v === '' || v === null || v === undefined ? undefined : Number(v)
}

/** Radio inputs always report strings; Yes/No is stored as a boolean. */
export function toBoolean(v: unknown) {
  if (typeof v === 'boolean') return v
  return v === 'true' ? true : v === 'false' ? false : undefined
}

const blankToUndefined = (v: unknown) => (v === '' || v === null ? undefined : v)

// Client-side copy of the backend rules (CrmBackend/src/validators/leadProfile.schema.ts,
// Deep Dive: Lead Management §4.2). The server stays the authority; its field errors show too.

const pick = <T extends readonly [string, ...string[]]>(values: T, label: string) =>
  z.enum(values, { error: `Select ${label}` })

const personName = (label: string) =>
  z
    .string()
    .trim()
    .min(1, `${label} is required`)
    .max(50, `${label} must be 50 characters or fewer`)
    .regex(/^[A-Za-z .]+$/, `${label} can only contain letters, spaces and "."`)

const digitsOnly = (v: string) => {
  const d = v.replace(/\D/g, '')
  return d.length > 10 ? d.slice(-10) : d
}
const indianMobile = (label: string) =>
  z
    .string()
    .min(1, `${label} is required`)
    .refine((v) => /^[6-9]\d{9}$/.test(digitsOnly(v)), `${label} must be 10 digits starting with 6–9`)

const optionalEmail = z.union([z.literal(''), z.email('Enter a valid email address')]).optional()

/** Whole years between a YYYY-MM-DD date and today (doc #6: "Calculated from DOB"). */
export function ageFrom(dob?: string): number | null {
  if (!dob) return null
  const d = new Date(`${dob}T00:00:00`)
  if (Number.isNaN(d.getTime())) return null
  const now = new Date()
  let age = now.getFullYear() - d.getFullYear()
  if (now.getMonth() < d.getMonth() || (now.getMonth() === d.getMonth() && now.getDate() < d.getDate())) age--
  return age >= 0 ? age : null
}

export const personalSchema = z
  .object({
    personal: z.object({
      firstName: personName('First name'),
      lastName: personName('Last name'),
      email: z.email('Enter a valid email address'),
      mobile: indianMobile('Mobile number'),
      dob: z
        .string()
        .min(1, 'Date of birth is required')
        .refine((v) => {
          const age = ageFrom(v)
          return age !== null && age >= MIN_AGE && age <= MAX_AGE
        }, `Age must be between ${MIN_AGE} and ${MAX_AGE}`),
      gender: pick(GENDERS, 'a gender'),
      state: pick(INDIAN_STATES, 'a state'),
      city: z.string().trim().min(1, 'City is required').max(100),
      pinCode: z.string().regex(/^\d{6}$/, 'PIN code must be 6 digits'),
      address: z.string().trim().max(250, 'Address must be 250 characters or fewer').optional(),
    }),
    guardian: z.object({
      name: z
        .string()
        .trim()
        .min(1, 'Parent/guardian name is required')
        .max(100)
        .regex(/^[A-Za-z ]+$/, 'Parent/guardian name can only contain letters'),
      relationship: pick(RELATIONSHIPS, 'a relationship'),
      mobile: indianMobile('Parent/guardian mobile'),
      email: optionalEmail,
    }),
  })
  .superRefine((v, ctx) => {
    if (v.guardian.mobile && digitsOnly(v.guardian.mobile) === digitsOnly(v.personal.mobile)) {
      ctx.addIssue({ code: 'custom', path: ['guardian', 'mobile'], message: "Must be different from the candidate's mobile" })
    }
  })
export type PersonalValues = z.infer<typeof personalSchema>

function checkScore(
  ctx: z.RefinementCtx,
  path: string[],
  gradeType: string | undefined,
  score: number | undefined,
  mandatory: boolean
) {
  if (score === undefined || Number.isNaN(score)) {
    if (mandatory) ctx.addIssue({ code: 'custom', path: [...path, 'score'], message: 'Score is required' })
    if (mandatory && !gradeType) ctx.addIssue({ code: 'custom', path: [...path, 'gradeType'], message: 'Select a grade type' })
    return
  }
  if (!gradeType) {
    ctx.addIssue({ code: 'custom', path: [...path, 'gradeType'], message: 'Select a grade type' })
    return
  }
  const max = gradeType === 'CGPA' ? 10 : 100
  if (score < 0 || score > max) {
    ctx.addIssue({ code: 'custom', path: [...path, 'score'], message: `${gradeType} must be between 0 and ${max}` })
  } else if (Math.abs(score * 100 - Math.round(score * 100)) > 1e-6) {
    ctx.addIssue({ code: 'custom', path: [...path, 'score'], message: 'Use at most 2 decimal places' })
  }
}

const year = (label: string) => z.number({ error: `${label} is required` })
const optionalPick = <T extends readonly [string, ...string[]]>(values: T, label: string) =>
  z.preprocess(blankToUndefined, pick(values, label).optional())
const school = (cls: string) =>
  z.object({
    yearOfPassing: year(`Class ${cls} year of passing`),
    gradeType: optionalPick(GRADE_TYPES, 'a grade type'),
    score: z.number().optional(),
    medium: pick(MEDIUMS, 'a medium'),
  })

export const academicSchema = z.object({
  academic: z
    .object({
      class10: school('10th'),
      class12: school('12th'),
      ug: z.object({
        qualification: pick(UG_QUALIFICATIONS, 'a qualification'),
        status: pick(QUALIFICATION_STATUSES, 'a status'),
        institution: z
          .string()
          .trim()
          .min(1, 'Institution name is required')
          .max(150, 'Institution name must be 150 characters or fewer'),
        gradeType: optionalPick(GRADE_TYPES, 'a grade type'),
        score: z.number().optional(),
        yearOfPassing: year('UG year of passing'),
        medium: pick(MEDIUMS, 'a medium'),
      }),
      higherQualification: z.object({
        has: z.preprocess(toBoolean, z.boolean({ error: 'Select Yes or No' })),
        details: z.string().trim().max(150, 'Qualification details must be 150 characters or fewer').optional(),
      }),
    })
    .superRefine((a, ctx) => {
      const now = new Date().getFullYear()
      if (a.class10.yearOfPassing < MIN_PASSING_YEAR || a.class10.yearOfPassing > now) {
        ctx.addIssue({ code: 'custom', path: ['class10', 'yearOfPassing'], message: `Year must be between ${MIN_PASSING_YEAR} and ${now}` })
      }
      if (a.class12.yearOfPassing <= a.class10.yearOfPassing) {
        ctx.addIssue({ code: 'custom', path: ['class12', 'yearOfPassing'], message: 'Must be later than the Class 10th year' })
      } else if (a.class12.yearOfPassing > now) {
        ctx.addIssue({ code: 'custom', path: ['class12', 'yearOfPassing'], message: `Year cannot be after ${now}` })
      }
      checkScore(ctx, ['class10'], a.class10.gradeType, a.class10.score, true)
      checkScore(ctx, ['class12'], a.class12.gradeType, a.class12.score, true)
      checkScore(ctx, ['ug'], a.ug.gradeType, a.ug.score, a.ug.status === 'Completed')
      const latest = a.ug.status === 'Pursuing' ? maxPursuingYear() : now
      if (a.ug.yearOfPassing <= a.class12.yearOfPassing) {
        ctx.addIssue({ code: 'custom', path: ['ug', 'yearOfPassing'], message: 'Must be later than the Class 12th year' })
      } else if (a.ug.yearOfPassing > latest) {
        ctx.addIssue({
          code: 'custom',
          path: ['ug', 'yearOfPassing'],
          message: a.ug.status === 'Pursuing' ? `Year cannot be after ${latest}` : 'A future year is allowed only while Pursuing',
        })
      }
      if (a.higherQualification.has && !a.higherQualification.details) {
        ctx.addIssue({ code: 'custom', path: ['higherQualification', 'details'], message: 'Enter the qualification details' })
      }
    }),
})
export type AcademicInput = z.input<typeof academicSchema>
export type AcademicValues = z.output<typeof academicSchema>

export const workSchema = z.object({
  work: z
    .object({
      employmentStatus: pick(EMPLOYMENT_STATUSES, 'an employment status'),
      organization: z.string().trim().max(100).optional(),
      designation: z.string().trim().max(100).optional(),
      functionalArea: z.string().trim().max(100).optional(),
      experienceYears: z.number().int('Whole years only').min(0, 'Years must be 0–30').max(30, 'Years must be 0–30').optional(),
      experienceMonths: z.number().int('Whole months only').min(0, 'Months must be 0–11').max(11, 'Months must be 0–11').optional(),
    })
    .superRefine((v, ctx) => {
      if (v.employmentStatus !== 'Experienced') return
      const required = [
        ['organization', 'Organization name is required'],
        ['designation', 'Designation is required'],
        ['functionalArea', 'Functional area is required'],
        ['experienceYears', 'Years are required'],
        ['experienceMonths', 'Months are required'],
      ] as const
      for (const [key, message] of required) {
        if (v[key] === undefined || v[key] === '') ctx.addIssue({ code: 'custom', path: [key], message })
      }
    }),
})
export type WorkValues = z.infer<typeof workSchema>

/**
 * Shows a failed save: field errors from the API (keys like "personal.dob") land
 * on their inputs, the message goes to a toast, and the typed values stay put.
 */
export function showSaveError<T extends FieldValues>(err: unknown, setError: UseFormSetError<T>) {
  const { message, errors } = parseApiError(err)
  Object.entries(errors).forEach(([field, msg]) => setError(field as Path<T>, { message: msg }))
  toast.error(message)
}
