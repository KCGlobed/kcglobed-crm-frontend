import type { CpStageType } from '../../types/consultants'

/** Channel Partners screens live under /app/consultants (apart from the student /app/leads). */
export const CP_LEADS_PATH = '/app/consultants/leads'
export const cpLeadPath = (id: string) => `${CP_LEADS_PATH}/${id}`

export const CP_STAGE_TYPES: { value: CpStageType; label: string; hint: string }[] = [
  { value: 'open', label: 'Open', hint: 'Still being worked: needs a next follow-up' },
  { value: 'won', label: 'Won', hint: 'Partner onboarded: the lead locks' },
  { value: 'closed', label: 'Closed', hint: 'Not going ahead: no follow-up' },
]

/** ISO for an <input type="datetime-local"> value (local time), or null when empty. */
export function localInputToIso(value: string): string | null {
  return value ? new Date(value).toISOString() : null
}

/** An ISO date as an <input type="datetime-local"> value, in local time. */
export function isoToLocalInput(value?: string | null): string {
  if (!value) return ''
  const d = new Date(value)
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`
}
