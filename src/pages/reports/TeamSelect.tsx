import { useMemo, type SelectHTMLAttributes } from 'react'
import { useTeamOptionsQuery } from '../../services/adminApi'
import { Select } from '../../components/ui/fields'
import { teamsInOrder as ordered } from '../admin/teams/teamMeta'

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
