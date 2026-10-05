import { z } from 'zod';
import { ACTIONS, DATA_SCOPES, FIELD_RULE_MODES, MODULES } from '../constants/permissions';

export const objectIdSchema = z
  .string()
  .regex(/^[0-9a-fA-F]{24}$/, 'Invalid identifier');

export const modulePermissionSchema = z.object({
  module: z.enum(MODULES),
  actions: z.array(z.enum(ACTIONS)),
});

export const fieldRuleSchema = z.object({
  field: z.string().min(1),
  mode: z.enum(FIELD_RULE_MODES),
});

export const dataScopeSchema = z.enum(DATA_SCOPES);

export const mobileSchema = z
  .string()
  .min(7, 'Enter a valid mobile number')
  .max(16, 'Enter a valid mobile number')
  .regex(/^[+\d][\d\s-]+$/, 'Enter a valid mobile number');
