import { useMemo } from 'react'
import { useMasterBootstrapQuery } from '../../services/mastersApi'
import { LEAD_COLUMNS, customFieldColumn, type LeadColumn } from './leadColumns'

/**
 * Every column the leads table can show: the static lead columns plus one per
 * active custom field (Masters → Custom fields), so values imported or entered
 * into custom fields are visible and exportable from the list.
 */
export function useLeadColumns(): { columns: LeadColumn[]; keys: string[] } {
  const { data } = useMasterBootstrapQuery()
  const defs = data?.data.customFields
  return useMemo(() => {
    const columns = [...LEAD_COLUMNS, ...(defs ?? []).map(customFieldColumn)]
    return { columns, keys: columns.map((c) => c.key) }
  }, [defs])
}
