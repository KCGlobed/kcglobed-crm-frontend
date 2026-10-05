import { z } from 'zod';
import { objectIdSchema } from './common';
import { TEAM_TYPES } from '../models/Team';

export const teamSchema = z.object({
  name: z.string().trim().min(2, 'Team name is required').max(100),
  code: z
    .string()
    .trim()
    .max(20, 'Code must be 20 characters or fewer')
    .regex(/^[A-Za-z0-9_-]*$/, 'Code can only contain letters, numbers, dashes and underscores')
    .optional()
    .nullable(),
  type: z.enum(TEAM_TYPES).optional(),
  description: z.string().max(500).optional().nullable(),
  manager: objectIdSchema.optional().nullable(),
  parent: objectIdSchema.optional().nullable(),
  location: z.string().max(100).optional().nullable(),
  programs: z.array(objectIdSchema).max(50).optional(),
  receivesLeads: z.boolean().optional(),
  isActive: z.boolean().optional(),
});

export const addMembersSchema = z.object({
  userIds: z.array(objectIdSchema).min(1, 'Pick at least one user').max(200),
  /** also point each moved user's reporting manager at the team manager */
  setReportingManager: z.boolean().optional(),
});
