import { useMemo } from 'react'
import { useSearchParams } from 'react-router-dom'

export interface ListQueryParams {
  page: number
  page_size: number
  search?: string
  sort_by: string
  sort_order: 'asc' | 'desc'
  [key: string]: unknown
}

/**
 * Keeps list state (page, size, search, sort, filters) in the URL so it
 * survives navigation and refresh, and is shareable.
 */
export function useListParams(
  defaults: { sort_by: string; sort_order: 'asc' | 'desc'; page_size?: number },
  filterKeys: string[] = []
) {
  const [params, setParams] = useSearchParams()

  const query: ListQueryParams = useMemo(() => {
    const q: ListQueryParams = {
      page: Number(params.get('page')) || 1,
      page_size: Number(params.get('page_size')) || defaults.page_size || 25,
      search: params.get('search') ?? undefined,
      sort_by: params.get('sort_by') ?? defaults.sort_by,
      sort_order: (params.get('sort_order') as 'asc' | 'desc') ?? defaults.sort_order,
    }
    for (const key of filterKeys) {
      const v = params.get(key)
      if (v) q[key] = v
    }
    return q
  }, [params]) // eslint-disable-line react-hooks/exhaustive-deps

  const setParam = (key: string, value?: string | number) => {
    const next = new URLSearchParams(params)
    if (value === undefined || value === '') next.delete(key)
    else next.set(key, String(value))
    if (key !== 'page') next.set('page', '1')
    setParams(next, { replace: true })
  }

  const onSort = (key: string) => {
    const next = new URLSearchParams(params)
    if (query.sort_by === key) next.set('sort_order', query.sort_order === 'asc' ? 'desc' : 'asc')
    else {
      next.set('sort_by', key)
      next.set('sort_order', 'asc')
    }
    setParams(next, { replace: true })
  }

  return { query, setParam, onSort }
}
