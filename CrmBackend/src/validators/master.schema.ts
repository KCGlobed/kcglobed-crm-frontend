import { z } from 'zod';
import { CHANNELS, COHORT_STATUSES, CUSTOM_FIELD_TYPES, STAGE_TYPES } from '../models/masters';
import { objectIdSchema } from './common';

export const sourceSchema = z.object({
  name: z.string().min(1, 'Name is required').max(100),
  channel: z.enum(CHANNELS).optional(),
  description: z.string().max(500).optional(),
  isActive: z.boolean().optional(),
  sortOrder: z.number().int().optional(),
});

export const programSchema = z.object({
  name: z.string().min(1, 'Name is required').max(150),
  code: z.string().min(1, 'Code is required').max(20),
  track: z.string().max(100).optional(),
  durationMonths: z.number().int().positive().optional(),
  description: z.string().max(1000).optional(),
  isActive: z.boolean().optional(),
  sortOrder: z.number().int().optional(),
});

export const cohortSchema = z.object({
  name: z.string().min(1, 'Name is required').max(100),
  program: objectIdSchema,
  startDate: z.coerce.date().optional(),
  endDate: z.coerce.date().optional(),
  capacity: z.number().int().positive().optional(),
  status: z.enum(COHORT_STATUSES).optional(),
  sortOrder: z.number().int().optional(),
});

export const stageSchema = z.object({
  name: z.string().min(1, 'Name is required').max(100),
  type: z.enum(STAGE_TYPES).optional(),
  color: z.string().max(20).optional(),
  order: z.number().int().optional(),
  isActive: z.boolean().optional(),
  subStages: z
    .array(
      z.object({
        _id: objectIdSchema.optional(),
        name: z.string().trim().min(1, 'Sub-stage name is required').max(150),
        counsellorAction: z.string().trim().max(1000).optional(),
        isActive: z.boolean().optional(),
      })
    )
    .max(50)
    .optional(),
});

export const dispositionSchema = z.object({
  name: z.string().min(1, 'Name is required').max(100),
  category: z.string().max(100).optional(),
  requiresFollowUp: z.boolean().optional(),
  isActive: z.boolean().optional(),
  sortOrder: z.number().int().optional(),
});

export const tagSchema = z.object({
  name: z.string().min(1, 'Name is required').max(50),
  color: z.string().max(20).optional(),
  isActive: z.boolean().optional(),
  sortOrder: z.number().int().optional(),
});

export const customFieldSchema = z.object({
  key: z
    .string()
    .min(1)
    .max(50)
    .regex(/^[a-z][a-zA-Z0-9_]*$/, 'Key must start with a letter (camelCase, no spaces)'),
  label: z.string().min(1, 'Label is required').max(100),
  type: z.enum(CUSTOM_FIELD_TYPES),
  options: z.array(z.string().min(1)).optional(),
  required: z.boolean().optional(),
  isActive: z.boolean().optional(),
  sortOrder: z.number().int().optional(),
});
