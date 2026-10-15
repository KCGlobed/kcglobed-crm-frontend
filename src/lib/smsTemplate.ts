/** DLT variable marker, exactly as a template is registered on the TRAI DLT portal; values are typed when sending. */
export const DLT_VAR = '{#var#}'

/** TRAI rule: one variable value is at most 30 characters. */
export const DLT_VAR_MAX = 30

/** How many values the sender has to type for this SMS template. */
export function dltVariableCount(body: string): number {
  return body.split(DLT_VAR).length - 1
}

/**
 * Fills the {#var#} markers in order with the typed values. A blank value leaves its marker in
 * place, so the live preview shows what is still missing; the server applies the same rule.
 */
export function fillDltVariables(body: string, values: string[]): string {
  const parts = body.split(DLT_VAR)
  let out = parts[0]
  for (let i = 1; i < parts.length; i++) {
    const value = (values[i - 1] ?? '').trim()
    out += (value || DLT_VAR) + parts[i]
  }
  return out
}

/**
 * Labels for the fixed lead fields a {#var#} value can name (the server's LEAD_FIELDS). The dropdown takes
 * the live list from /messaging/options, which also carries the custom lead fields; this is the fallback.
 */
export const LEAD_FIELD_LABELS: Record<string, string> = {
  first_name: 'First name',
  last_name: 'Last name',
  full_name: 'Full name',
  lead_id: 'Lead ID',
  mobile: 'Mobile',
  alt_mobile: 'Alternate mobile',
  email: 'Email',
  city: 'City',
  state: 'State',
  country: 'Country',
  program_interest: 'Program interest',
  cohort: 'Cohort',
  stage: 'Stage',
  sub_stage: 'Sub-stage',
  source: 'Source',
  first_source: 'First source',
  last_disposition: 'Last disposition',
  counsellor_name: 'Counsellor name',
  counsellor_mobile: 'Counsellor mobile',
  counsellor_email: 'Counsellor email',
  created_date: 'Created on (date)',
  lead_score: 'Lead score',
}

/** "{first_name}" → "first_name"; null for typed text. */
export function leadFieldOf(value: string): string | null {
  const m = /^\{(\w+)\}$/.exec(value.trim())
  return m ? m[1] : null
}

export function leadFieldToken(field: string): string {
  return `{${field}}`
}

/**
 * The values as they go out to one lead: a lead-field token becomes that lead's value, cut to the DLT
 * limit (the server applies the same rule); typed text stays as it is. A field the lead has no value
 * for comes back blank, so its marker stays in the preview and the server refuses the send.
 */
export function resolveDltVariables(values: string[], leadValues?: Record<string, string | null> | null): string[] {
  return values.map((v) => {
    const field = leadFieldOf(v)
    return field ? (leadValues?.[field] ?? '').slice(0, DLT_VAR_MAX).trim() : v
  })
}
