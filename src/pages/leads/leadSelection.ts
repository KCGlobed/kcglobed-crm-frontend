import { useMemo } from 'react'
import { useUserOptionsQuery } from '../../services/adminApi'
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

/** "Name · in round-robin" so pool members are easy to spot in Assign / Reassign lists. */
export const ownerLabel = (u: { name: string; receivesLeads?: boolean }) => (u.receivesLeads ? `${u.name} · in round-robin` : u.name)

/**
 * Everyone a lead can be assigned to: active users who can view Leads, except Super
 * Admins — the same people the round-robin pool draws from, whatever their role.
 */
export function useAssignableOwners() {
  const { data } = useUserOptionsQuery()
  return useMemo(
    () =>
      (data?.data ?? []).filter(
        // assignable = can own leads AND inside the caller's own team hierarchy;
        // older backends without the flags: fall back to counsellors and pool members
        (u) => u.assignable ?? u.canOwnLeads ?? (u.role === 'counsellor' || u.receivesLeads)
      ),
    [data]
  )
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
