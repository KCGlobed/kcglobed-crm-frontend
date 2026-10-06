import { Badge } from '../../../components/ui/Badge'
import type { TeamType } from '../../../types/models'
import { TEAM_TYPE_LABEL, TEAM_TYPE_TONE } from './teamMeta'

/** Records saved before `type` existed have none — they are plain teams. */
export function TeamTypeBadge({ type }: { type?: TeamType }) {
  const t = type ?? 'team'
  return <Badge tone={TEAM_TYPE_TONE[t]}>{TEAM_TYPE_LABEL[t]}</Badge>
}
