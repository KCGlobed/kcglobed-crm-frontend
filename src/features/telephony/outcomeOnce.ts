/**
 * The calls whose outcome drawer already opened by itself (when the call ended): it never opens by itself again for
 * them — not on another visit to the lead, not after a refresh (kept for the browser session). Saving the outcome
 * later from the lead's calls list is still possible.
 */
const KEY = 'crm.outcomeShown'
const LIMIT = 200

let shown: string[] | null = null

function load(): string[] {
  if (shown) return shown
  try {
    shown = JSON.parse(sessionStorage.getItem(KEY) || '[]') as string[]
  } catch {
    shown = []
  }
  return shown
}

export function outcomeShown(callId: string): boolean {
  return load().includes(callId)
}

export function markOutcomeShown(callId: string): void {
  const list = load()
  if (list.includes(callId)) return
  shown = [...list, callId].slice(-LIMIT)
  try {
    sessionStorage.setItem(KEY, JSON.stringify(shown))
  } catch {
    // storage blocked — remembered for this page only
  }
}
