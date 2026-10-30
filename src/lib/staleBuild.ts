/**
 * A deploy while the tab is open: the page still runs the old build and asks for the old build's JS chunks
 * (`/assets/UsersPage-<hash>.js`) the next time a route is opened, but the server only has the new ones — the
 * import fails ("Failed to fetch dynamically imported module") and the route shows an error until the user
 * refreshes. A reload picks up the new build, so that is done for them, at most once a minute so that a chunk
 * that is really broken does not reload the page for ever.
 */
const KEY = 'crm.reloadedForNewBuild'

export function isStaleChunkError(error: unknown): boolean {
  const text = error instanceof Error ? `${error.name} ${error.message}` : String(error ?? '')
  return /dynamically imported module|Importing a module script failed|Loading (CSS )?chunk|Unable to preload CSS/i.test(text)
}

/** Reloads to the new build; false when the page was already reloaded for this less than a minute ago. */
export function reloadForNewBuild(): boolean {
  try {
    if (Date.now() - Number(sessionStorage.getItem(KEY) ?? 0) < 60_000) return false
    sessionStorage.setItem(KEY, String(Date.now()))
  } catch {
    // no session storage (private window): reload anyway
  }
  window.location.reload()
  return true
}
