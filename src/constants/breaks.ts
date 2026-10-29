import { Coffee, GraduationCap, Headset, MoreHorizontal, Pause, School, Soup, Toilet, type LucideIcon } from 'lucide-react'
import type { BreakType } from '../types/models'

/**
 * The break types, in the order the Attendance columns and the CSV show them.
 * Mirrors the backend BREAK_TYPES (apps/attendance/models.py): keep the two in step.
 */
export const BREAK_OPTIONS: { type: BreakType; label: string; icon: LucideIcon }[] = [
  { type: 'tea', label: 'Tea Break', icon: Coffee },
  { type: 'lunch', label: 'Lunch Break', icon: Soup },
  { type: 'bio', label: 'Bio Break', icon: Toilet },
  { type: 'pause', label: 'Pause Break', icon: Pause },
  { type: 'other', label: 'Other Break', icon: MoreHorizontal },
]

/** The Punch Break tiles: every type but the pause, which has its own section under it. */
export const PUNCH_BREAK_OPTIONS = BREAK_OPTIONS.filter((o) => o.type !== 'pause')

/** Breaks that ask for a reason before they start (sent as `note`; required by the server). */
export const NOTE_TYPES = new Set<BreakType>(['pause', 'other'])

/**
 * The Punch Pause Break tiles. A preset starts the pause with that reason at once (it is the break's note);
 * Other asks the employee to type one. A pause is time away from the desk: neither break time nor signed-in time.
 */
export const PAUSE_OPTIONS: { reason: string | null; label: string; icon: LucideIcon }[] = [
  { reason: 'Campus Visit', label: 'Campus Visit', icon: School },
  { reason: 'Call Calibration', label: 'Call Calibration', icon: Headset },
  { reason: 'Training Session', label: 'Training Session', icon: GraduationCap },
  { reason: null, label: 'Other', icon: MoreHorizontal },
]
