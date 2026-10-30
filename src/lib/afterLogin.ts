/**
 * Where to go after signing in. The page a session ended on (RequireAuth keeps it as `from`) is reopened only for
 * the same person: on a shared computer the next person signing in would otherwise land on the previous user's
 * page — an admin screen they have no access to (403), or a lead that is not theirs ("not accessible").
 */
export function afterLoginPath(from: string | null | undefined, previousUserId: string | null | undefined, userId: string): string {
  if (!from || from === '/login') return '/app'
  if (previousUserId && previousUserId !== userId) return '/app'
  return from
}

/**
 * The last account signed in on this browser (localStorage: kept across reloads, so a session that expired overnight
 * still counts) and the account this tab was showing (sessionStorage: per tab, also kept across a reload — a tab left
 * on the Super Admin's page and reloaded after a counsellor signed in elsewhere is told apart by it).
 */
const LAST_USER_KEY = 'crm.lastSignedInUser'

function read(storage: () => Storage): string | null {
  try {
    return storage().getItem(LAST_USER_KEY)
  } catch {
    return null
  }
}

export const lastSignedInUser = () => read(() => localStorage)
export const lastTabUser = () => read(() => sessionStorage)

export function rememberSignedInUser(userId: string): void {
  for (const storage of [() => localStorage, () => sessionStorage]) {
    try {
      storage().setItem(LAST_USER_KEY, userId)
    } catch {
      // no storage (private window): the return-to page is then reopened for anyone, as before
    }
  }
}
