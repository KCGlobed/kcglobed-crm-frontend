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
 * this browser. `allKeys` may change after mount (custom-field columns arrive
 * with the masters): columns added later appear at the end, hidden, except a
 * default column that a saved layout predates, which is shown in its default
 * place; columns that no longer exist are dropped from saved layouts.
 */
export function useColumnPrefs(storageKey: string, { allKeys, defaultVisible, locked = [] }: Options) {
  const defaults = useMemo<StoredPrefs>(() => ({ order: allKeys, visible: defaultVisible }), [allKeys, defaultVisible])

  const [stored, setStored] = useState<StoredPrefs>(() => read(storageKey) ?? defaults)

  const update = useCallback(
    (next: StoredPrefs) => {
      setStored(next)
      write(storageKey, next)
    },
    [storageKey]
  )

  // the saved layout reconciled with the columns that exist right now
  const prefs = useMemo<StoredPrefs>(() => {
    const known = new Set(allKeys)
    const order = stored.order.filter((k) => known.has(k))
    const visible = stored.visible.filter((k) => known.has(k))
    for (const key of allKeys) {
      if (order.includes(key)) continue
      if (defaultVisible.includes(key)) {
        // a default column added since this layout was saved: shown, right after the nearest
        // column that precedes it in the default order (a hidden default stays in `order`, so
        // only a column the layout has never seen lands here)
        const before = allKeys.slice(0, allKeys.indexOf(key)).reverse().find((k) => order.includes(k))
        order.splice(before ? order.indexOf(before) + 1 : 0, 0, key)
        visible.push(key)
      } else {
        order.push(key)
      }
    }
    return { order, visible }
  }, [stored, allKeys, defaultVisible])

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
