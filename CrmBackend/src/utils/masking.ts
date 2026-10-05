import { FieldRule } from '../constants/permissions';
import { maskEmail, maskMobile } from './normalize';

/**
 * Applies per-user field rules (SOW permission builder step 6) to an outgoing record.
 * - hidden   → field removed entirely
 * - masked   → mobile/email get partial masks, everything else becomes "****"
 * - readonly → returned as-is (enforced on write, not on read)
 */
export function applyFieldRules<T extends Record<string, unknown>>(
  record: T,
  rules: FieldRule[]
): T {
  if (!rules.length) return record;
  const clone: Record<string, unknown> = { ...record };

  for (const rule of rules) {
    if (!(rule.field in clone)) continue;
    if (rule.mode === 'hidden') {
      delete clone[rule.field];
    } else if (rule.mode === 'masked') {
      const value = clone[rule.field];
      if (typeof value === 'string') {
        if (rule.field.toLowerCase().includes('email')) clone[rule.field] = maskEmail(value);
        else if (rule.field.toLowerCase().includes('mobile') || rule.field.toLowerCase().includes('phone'))
          clone[rule.field] = maskMobile(value);
        else clone[rule.field] = '****';
      } else if (value != null) {
        clone[rule.field] = '****';
      }
    }
  }
  return clone as T;
}

/** Strips fields the user may not edit (readonly/hidden) from an incoming payload. */
export function stripUneditableFields<T extends Record<string, unknown>>(
  payload: T,
  rules: FieldRule[]
): T {
  if (!rules.length) return payload;
  const clone: Record<string, unknown> = { ...payload };
  for (const rule of rules) {
    if (rule.mode === 'readonly' || rule.mode === 'hidden') delete clone[rule.field];
  }
  return clone as T;
}
