import type { TeamOption, TeamType } from '../../../types/models'

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

/** Active teams in hierarchy order, each sub-team under its parent and named with it ("Admissions › North"). */
export function teamsInOrder(teams: TeamOption[]): { team: TeamOption; label: string }[] {
  const ids = new Set(teams.map((t) => t._id))
  const children = new Map<string, TeamOption[]>()
  for (const t of teams) {
    const parent = t.parent && ids.has(t.parent) ? t.parent : ''
    children.set(parent, [...(children.get(parent) ?? []), t])
  }
  const out: { team: TeamOption; label: string }[] = []
  const seen = new Set<string>()
  const walk = (parent: string, prefix: string) => {
    for (const t of children.get(parent) ?? []) {
      if (seen.has(t._id)) continue
      seen.add(t._id)
      out.push({ team: t, label: prefix + t.name })
      walk(t._id, `${prefix}${t.name} › `)
    }
  }
  walk('', '')
  // a parent loop leaves teams unreached: list them at the top level
  for (const t of teams) if (!seen.has(t._id)) out.push({ team: t, label: t.name })
  return out
}
