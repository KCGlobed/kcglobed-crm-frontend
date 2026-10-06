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
