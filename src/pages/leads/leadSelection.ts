import { useListUsersQuery } from '../../services/adminApi'
import type { FilterCondition } from '../../types/models'

export interface LeadSelection {
  /** "select all N matching this filter" */
  allMatching: boolean
  ids: string[]
  /** the list's current filters (used when allMatching) */
  filters: Record<string, string>
  count: number
}

export function selectionBody(sel: LeadSelection) {
  return sel.allMatching ? { selectAll: true, filters: sel.filters } : { leadIds: sel.ids }
}

/** Active Admission Counsellors — the only people leads can be assigned to. */
export function useCounsellors() {
  const { data } = useListUsersQuery({ role: 'counsellor', is_active: 'true', page_size: 100, sort_by: 'name', sort_order: 'asc' })
  return data?.data ?? []
}

/** The list's `filters` URL param → conditions. */
export function parseConditions(raw: string | null): FilterCondition[] {
  if (!raw) return []
  try {
    const parsed = JSON.parse(raw)
    return Array.isArray(parsed) ? parsed : []
  } catch {
    return []
  }
}
