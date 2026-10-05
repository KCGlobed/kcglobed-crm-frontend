import { z } from 'zod';
import { passwordSchema } from './auth.schema';
import {
  dataScopeSchema,
  fieldRuleSchema,
  modulePermissionSchema,
  objectIdSchema,
} from './common';

export const createUserSchema = z.object({
  name: z.string().min(2, 'Name is required').max(100),
  email: z.email('Enter a valid email address'),
  password: passwordSchema,
  mobile: z.string().max(16).optional(),
  designation: z.string().max(100).optional(),
  isSuperAdmin: z.boolean().optional(),
  isActive: z.boolean().optional(),
  receivesLeads: z.boolean().optional(),
  team: objectIdSchema.optional().nullable(),
  reportingManager: objectIdSchema.optional().nullable(),
  templateKey: z.string().optional(),
  permissions: z.array(modulePermissionSchema).optional(),
  dataScope: dataScopeSchema.optional(),
  fieldRules: z.array(fieldRuleSchema).optional(),
});

export const updateUserSchema = createUserSchema
  .partial()
  .extend({ password: passwordSchema.optional() });

export const setPermissionsSchema = z.object({
  permissions: z.array(modulePermissionSchema),
  dataScope: dataScopeSchema,
  fieldRules: z.array(fieldRuleSchema).default([]),
  templateKey: z.string().optional().nullable(),
});

export const permissionTemplateSchema = z.object({
  key: z
    .string()
    .min(2)
    .max(50)
    .regex(/^[a-z0-9-_]+$/, 'Key must be lowercase letters, numbers, dashes'),
  name: z.string().min(2).max(100),
  description: z.string().max(500).optional(),
  permissions: z.array(modulePermissionSchema),
  dataScope: dataScopeSchema,
  fieldRules: z.array(fieldRuleSchema).default([]),
});
