import { useMemo, type SelectHTMLAttributes } from 'react'
import { useTeamOptionsQuery } from '../../services/adminApi'
import { Select } from '../../components/ui/fields'
import type { TeamOption } from '../../types/models'

/** Active teams in hierarchy order, each sub-team under its parent and named with it ("Admissions › North"). */
function ordered(teams: TeamOption[]): { team: TeamOption; label: string }[] {
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

/**
 * The report team filter: "All teams" or one team, which also covers the teams below it. `current` names a
 * chosen team that is no longer in the active list (deactivated), so an edited schedule still shows it.
 */
export function TeamSelect({
  value,
  onChange,
  current,
  ...props
}: { value: string; onChange: (team: string) => void; current?: string } & Omit<
  SelectHTMLAttributes<HTMLSelectElement>,
  'value' | 'onChange'
>) {
  const { data } = useTeamOptionsQuery()
  const options = useMemo(() => ordered(data?.data ?? []), [data])
  return (
    <Select value={value} onChange={(e) => onChange(e.target.value)} {...props}>
      <option value="">All teams</option>
      {value && current && !options.some((o) => o.team._id === value) && <option value={value}>{current}</option>}
      {options.map(({ team, label }) => (
        <option key={team._id} value={team._id}>
          {label}
        </option>
      ))}
    </Select>
  )
}
