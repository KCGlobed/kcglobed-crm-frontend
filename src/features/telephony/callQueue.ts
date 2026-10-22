/**
 * "Start calling" queue (click-to-dial through a list): the lead ids of a filtered list, walked
 * one lead at a time. Nothing is dialled without a click — the next lead opens with ?dial=1 and
 * the page places the call. Kept in localStorage so it survives the navigation between leads.
 */
const KEY = 'crm.telephony.callQueue'
export const MAX_QUEUE = 200

export interface CallQueue {
  ids: string[]
  /** position of the lead being called now */
  index: number
  label?: string
}

export function readQueue(): CallQueue | null {
  try {
    const raw = localStorage.getItem(KEY)
    if (!raw) return null
    const q = JSON.parse(raw) as CallQueue
    return Array.isArray(q.ids) && q.ids.length ? q : null
  } catch {
    return null
  }
}

function write(q: CallQueue | null) {
  try {
    if (q) localStorage.setItem(KEY, JSON.stringify(q))
    else localStorage.removeItem(KEY)
  } catch {
    // storage blocked — the queue just isn't remembered
  }
  window.dispatchEvent(new Event('crm:call-queue'))
}

/** Starts a queue on these leads and returns the first to open. */
export function startQueue(ids: string[], label?: string): string | null {
  const unique = [...new Set(ids)].slice(0, MAX_QUEUE)
  if (!unique.length) return null
  write({ ids: unique, index: 0, label })
  return unique[0]
}

/** How many leads are still to come after the current one. */
export function remainingInQueue(q: CallQueue | null = readQueue()): number {
  return q ? Math.max(0, q.ids.length - q.index - 1) : 0
}

/** Moves to the next lead and returns its id; clears the queue at the end. */
export function advanceQueue(): string | null {
  const q = readQueue()
  if (!q) return null
  const index = q.index + 1
  if (index >= q.ids.length) {
    write(null)
    return null
  }
  write({ ...q, index })
  return q.ids[index]
}

export function clearQueue() {
  write(null)
}
