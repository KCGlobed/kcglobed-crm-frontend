import type { ReactNode } from 'react'
import { Navigate, useLocation } from 'react-router-dom'
import { useAppSelector } from '../app/hooks'
import { can } from '../constants/permissions'
import type { ActionKey, ModuleKey } from '../types/models'
import { Spinner } from '../components/ui/feedback'

export function RequireAuth({ children }: { children: ReactNode }) {
  const { user, initialized } = useAppSelector((s) => s.auth)
  const location = useLocation()

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
