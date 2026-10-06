import { useCallback, useMemo, useState } from 'react'

interface StoredPrefs {
  order: string[]
  visible: string[]
}

interface Options {
  /** every column key, in the default order */
  allKeys: string[]
  /** keys shown until the user changes the layout */
  defaultVisible: string[]
  /** keys that can never be hidden (e.g. the row's name) */
  locked?: string[]
}

function read(storageKey: string): StoredPrefs | null {
  try {
    const raw = localStorage.getItem(storageKey)
    return raw ? (JSON.parse(raw) as StoredPrefs) : null
  } catch {
    return null
  }
}

function write(storageKey: string, prefs: StoredPrefs) {
  try {
    localStorage.setItem(storageKey, JSON.stringify(prefs))
  } catch {
    // private mode / storage blocked — the layout simply isn't remembered
  }
}

/**
 * Which table columns are visible and in what order, remembered per user in
 * this browser. Columns added to the table later appear at the end, hidden;
 * columns that no longer exist are dropped from saved layouts.
 */
export function useColumnPrefs(storageKey: string, { allKeys, defaultVisible, locked = [] }: Options) {
  const defaults = useMemo<StoredPrefs>(() => ({ order: allKeys, visible: defaultVisible }), [allKeys, defaultVisible])

  const [prefs, setPrefs] = useState<StoredPrefs>(() => {
    const saved = read(storageKey)
    if (!saved) return defaults
    const known = new Set(allKeys)
    const order = [...saved.order.filter((k) => known.has(k)), ...allKeys.filter((k) => !saved.order.includes(k))]
    return { order, visible: saved.visible.filter((k) => known.has(k)) }
  })

  const update = useCallback(
    (next: StoredPrefs) => {
      setPrefs(next)
      write(storageKey, next)
    },
    [storageKey]
  )

  const visibleKeys = useMemo(() => {
    const shown = new Set([...prefs.visible, ...locked])
    return prefs.order.filter((k) => shown.has(k))
  }, [prefs, locked])

  const toggle = (key: string) => {
    if (locked.includes(key)) return
    const visible = prefs.visible.includes(key) ? prefs.visible.filter((k) => k !== key) : [...prefs.visible, key]
    update({ ...prefs, visible })
  }

  const move = (key: string, by: -1 | 1) => {
    const order = [...prefs.order]
    const from = order.indexOf(key)
    const to = from + by
    if (from < 0 || to < 0 || to >= order.length) return
    ;[order[from], order[to]] = [order[to], order[from]]
    update({ ...prefs, order })
  }

  const reset = () => update(defaults)

  return { order: prefs.order, visibleKeys, isVisible: (k: string) => visibleKeys.includes(k), toggle, move, reset }
}
