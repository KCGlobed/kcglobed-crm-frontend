import { useEffect, type ReactNode } from 'react'
import { Navigate, useLocation } from 'react-router-dom'
import { useAppSelector } from '../app/hooks'
import { can } from '../constants/permissions'
import { lastTabUser, rememberSignedInUser } from '../lib/afterLogin'
import type { ActionKey, ModuleKey } from '../types/models'
import { Spinner } from '../components/ui/feedback'

export function RequireAuth({ children }: { children: ReactNode }) {
  const { user, initialized } = useAppSelector((s) => s.auth)
  const location = useLocation()
  // the account this tab shows, noted after every render; read below before the page renders
  const userId = user?._id
  useEffect(() => {
    if (userId) rememberSignedInUser(userId)
  }, [userId])

  if (!initialized) {
    return (
      <div className="flex h-screen items-center justify-center">
        <Spinner className="h-8 w-8" />
      </div>
    )
  }
  if (!user) {
    return <Navigate to="/login" state={{ from: location.pathname }} replace />
  }
  // GL-02: a temporary password must be replaced before anything else
  if (user.mustChangePassword && location.pathname !== '/set-password') {
    return <Navigate to="/set-password" replace />
  }
  // Another account took over this tab (someone signed in as another user in another tab and this tab's session was
  // renewed with theirs — now, or found on a reload): their home, not the previous user's page (a 403, or a lead that
  // is not theirs). Decided here, before the page renders, so no page guard can redirect first.
  const tabUser = lastTabUser()
  if (tabUser && tabUser !== user._id && location.pathname !== '/app') {
    return <Navigate to="/app" replace />
  }
  return <>{children}</>
}

export function RequirePermission({
  module,
  action = 'view',
  children,
}: {
  module: ModuleKey
  action?: ActionKey
  children: ReactNode
}) {
  const user = useAppSelector((s) => s.auth.user)
  if (!can(user, module, action)) {
    return <Navigate to="/app/forbidden" replace />
  }
  return <>{children}</>
}

export function RequireSuperAdmin({ children }: { children: ReactNode }) {
  const user = useAppSelector((s) => s.auth.user)
  if (!user?.isSuperAdmin) return <Navigate to="/app/forbidden" replace />
  return <>{children}</>
}
