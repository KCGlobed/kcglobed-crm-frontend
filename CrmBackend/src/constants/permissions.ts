/**
 * Plug-and-play access model (SOW "Roles & Access" sheet).
 * Permissions live on the USER (module → actions → data scope → field rules).
 * Templates are saved tick-sets used to pre-fill a user; they are not enforced at runtime.
 */

export const MODULES = [
  'dashboard',
  'leads',
  'tasks',
  'applications',
  'documents',
  'exams',
  'interviews',
  'offers',
  'payments',
  'loans',
  'communications',
  'automation',
  'reports',
  'users',
  'teams',
  'masters',
  'audit',
] as const;
export type ModuleKey = (typeof MODULES)[number];

export const ACTIONS = [
  'view',
  'create',
  'edit',
  'delete',
  'export',
  'import',
  'reassign',
  'approve',
] as const;
export type ActionKey = (typeof ACTIONS)[number];

/** Data visibility scopes, per SOW permission builder step 5. */
export const DATA_SCOPES = ['own', 'team', 'location', 'program', 'cohort', 'all'] as const;
export type DataScope = (typeof DATA_SCOPES)[number];

export const FIELD_RULE_MODES = ['hidden', 'readonly', 'masked'] as const;
export type FieldRuleMode = (typeof FIELD_RULE_MODES)[number];

export interface ModulePermission {
  module: ModuleKey;
  actions: ActionKey[];
}

export interface FieldRule {
  /** dot-path of the field on the lead/candidate record, e.g. "mobile", "email" */
  field: string;
  mode: FieldRuleMode;
}

export function hasAction(perms: ModulePermission[], module: ModuleKey, action: ActionKey): boolean {
  const entry = perms.find((p) => p.module === module);
  return !!entry && entry.actions.includes(action);
}
