import { Coffee, MoreHorizontal, Pause, Soup, Toilet, type LucideIcon } from 'lucide-react'
import type { BreakType } from '../types/models'

/**
 * The Punch Break types, in the order the panel, the Attendance columns and the CSV show them.
 * Mirrors the backend BREAK_TYPES (apps/attendance/models.py): keep the two in step.
 */
export const BREAK_OPTIONS: { type: BreakType; label: string; icon: LucideIcon }[] = [
  { type: 'tea', label: 'Tea Break', icon: Coffee },
  { type: 'lunch', label: 'Lunch Break', icon: Soup },
  { type: 'bio', label: 'Bio Break', icon: Toilet },
  { type: 'pause', label: 'Pause Break', icon: Pause },
  { type: 'other', label: 'Other Break', icon: MoreHorizontal },
]

/** Breaks that ask for a reason before they start (sent as `note`; required by the server). */
export const NOTE_TYPES = new Set<BreakType>(['pause', 'other'])

/** What a Pause Break can be for; "Other" in the dropdown lets the employee type their own. */
export const PAUSE_REASONS = ['Campus Visit', 'Training Session', 'Call Calibration Session'] as const
