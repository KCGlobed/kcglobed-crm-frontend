import { z } from 'zod';
import { LEAD_STATUSES, LEAD_TRACKS } from '../models/Lead';
import { mobileSchema, objectIdSchema } from './common';

const utmSchema = z
  .object({
    source: z.string().max(200).optional(),
    medium: z.string().max(200).optional(),
    campaign: z.string().max(200).optional(),
    term: z.string().max(200).optional(),
    content: z.string().max(200).optional(),
    landingPage: z.string().max(500).optional(),
  })
  .optional();

const referralSchema = z
  .object({
    code: z.string().max(100).optional(),
    partnerName: z.string().max(200).optional(),
    partnerLink: z.string().max(500).optional(),
  })
  .optional();

export const createLeadSchema = z.object({
  firstName: z.string().min(1, 'First name is required').max(100),
  lastName: z.string().max(100).optional(),
  email: z.email('Enter a valid email address').optional().or(z.literal('')),
  mobile: mobileSchema,
  altMobile: z.string().max(16).optional(),
  city: z.string().max(100).optional(),
  state: z.string().max(100).optional(),
  country: z.string().max(100).optional(),
  source: objectIdSchema.optional(),
  utm: utmSchema,
  referral: referralSchema,
  track: z.enum(LEAD_TRACKS).optional(),
  programInterest: objectIdSchema.optional().nullable(),
  cohort: objectIdSchema.optional().nullable(),
  stage: objectIdSchema.optional(),
  subStage: objectIdSchema.optional().nullable(),
  owner: objectIdSchema.optional().nullable(),
  tags: z.array(objectIdSchema).optional(),
  customFields: z.record(z.string(), z.unknown()).optional(),
  consent: z
    .object({
      email: z.boolean().optional(),
      sms: z.boolean().optional(),
      whatsapp: z.boolean().optional(),
    })
    .optional(),
  autoAssign: z.boolean().optional(),
});

export const updateLeadSchema = createLeadSchema
  .omit({ owner: true, autoAssign: true })
  .partial()
  .extend({
    status: z.enum(LEAD_STATUSES).optional(),
    lastDisposition: z.string().max(100).optional(),
  });

export const assignLeadSchema = z.object({
  owner: objectIdSchema,
});

export const noteSchema = z.object({
  body: z.string().min(1, 'Note cannot be empty').max(5000),
  category: z.string().max(100).optional(),
});

/** Public capture endpoint: looser contract for website forms & connectors. */
export const captureLeadSchema = z.object({
  firstName: z.string().min(1).max(100).optional(),
  name: z.string().min(1).max(200).optional(),
  lastName: z.string().max(100).optional(),
  email: z.email().optional().or(z.literal('')),
  mobile: mobileSchema,
  city: z.string().max(100).optional(),
  state: z.string().max(100).optional(),
  source: z.string().max(100).optional(),
  program: z.string().max(150).optional(),
  utm_source: z.string().max(200).optional(),
  utm_medium: z.string().max(200).optional(),
  utm_campaign: z.string().max(200).optional(),
  utm_term: z.string().max(200).optional(),
  utm_content: z.string().max(200).optional(),
  landing_page: z.string().max(500).optional(),
  referral_code: z.string().max(100).optional(),
  partner_name: z.string().max(200).optional(),
  partner_link: z.string().max(500).optional(),
  track: z.enum(LEAD_TRACKS).optional(),
  channel: z.enum(['capture', 'meta', 'google']).optional(),
});

export const bulkUploadBodySchema = z.object({
  /** maps lead field → column header in the uploaded file */
  mapping: z.record(z.string(), z.string()),
  defaults: z
    .object({
      source: objectIdSchema.optional(),
      programInterest: objectIdSchema.optional(),
      stage: objectIdSchema.optional(),
      track: z.enum(LEAD_TRACKS).optional(),
      autoAssign: z.boolean().optional(),
    })
    .optional(),
});
