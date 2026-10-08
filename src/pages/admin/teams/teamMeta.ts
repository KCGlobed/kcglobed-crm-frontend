import type { TeamType } from '../../../types/models'

export const TEAM_TYPES: { key: TeamType; label: string; hint: string }[] = [
  { key: 'department', label: 'Department', hint: 'Top-level unit such as Admissions or Marketing' },
  { key: 'team', label: 'Team', hint: 'A working team with a manager' },
  { key: 'counsellor_group', label: 'Counsellor group', hint: 'A pod of counsellors inside a team' },
]

export const TEAM_TYPE_LABEL: Record<TeamType, string> = {
  department: 'Department',
  team: 'Team',
  counsellor_group: 'Counsellor group',
}

export const TEAM_TYPE_TONE: Record<TeamType, 'violet' | 'blue' | 'amber'> = {
  department: 'violet',
  team: 'blue',
  counsellor_group: 'amber',
}

/**
 * The org hierarchy: Department → Team → Counsellor group. What may sit
 * directly under a unit of the given type (`null` = top level).
 */
export function allowedChildTypes(parentType: TeamType | null | undefined): TeamType[] {
  if (!parentType) return ['department']
  if (parentType === 'department') return ['team', 'counsellor_group']
  if (parentType === 'team') return ['counsellor_group']
  return []
}
