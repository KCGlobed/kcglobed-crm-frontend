import { lazy, Suspense, type ReactNode } from 'react'
import { Navigate, Route, Routes } from 'react-router-dom'
import { RequireAuth, RequirePermission, RequireSuperAdmin } from './guards'
import AppLayout from '../layouts/AppLayout'
import { Spinner } from '../components/ui/feedback'
import { useCurrentUser } from '../app/hooks'
import { can } from '../constants/permissions'
import { NAV_SECTIONS } from '../constants/navigation'

const LoginPage = lazy(() => import('../pages/auth/LoginPage'))
const ForgotPasswordPage = lazy(() => import('../pages/auth/ForgotPasswordPage'))
const ResetPasswordPage = lazy(() => import('../pages/auth/ResetPasswordPage'))
const SetPasswordPage = lazy(() => import('../pages/auth/SetPasswordPage'))
const MessagingPage = lazy(() => import('../pages/admin/messaging/MessagingPage'))
const IntegrationsPage = lazy(() => import('../pages/admin/IntegrationsPage'))
const DashboardPage = lazy(() => import('../pages/dashboard/DashboardPage'))
const LeadsListPage = lazy(() => import('../pages/leads/LeadsListPage'))
const LeadDetailPage = lazy(() => import('../pages/leads/LeadDetailPage'))
const TasksPage = lazy(() => import('../pages/tasks/TasksPage'))
const UsersPage = lazy(() => import('../pages/admin/users/UsersPage'))
const TeamsPage = lazy(() => import('../pages/admin/teams/TeamsPage'))
const TeamDetailPage = lazy(() => import('../pages/admin/teams/TeamDetailPage'))
const MastersPage = lazy(() => import('../pages/admin/MastersPage'))
const AuditLogPage = lazy(() => import('../pages/admin/AuditLogPage'))
const ProfilePage = lazy(() => import('../pages/ProfilePage'))

function PageLoader() {
  return (
    <div className="flex h-64 items-center justify-center">
      <Spinner className="h-7 w-7" />
    </div>
  )
}

function Lazy({ children }: { children: ReactNode }) {
  return <Suspense fallback={<PageLoader />}>{children}</Suspense>
}

/** Sends users to the first module they can actually open. */
function HomeRedirect() {
  const user = useCurrentUser()
  const first = NAV_SECTIONS.flatMap((s) => s.items).find((i) => can(user, i.module, i.action))
  return <Navigate to={first?.path ?? '/app/profile'} replace />
}

function Forbidden() {
  return (
    <div className="flex flex-col items-center justify-center gap-2 py-24 text-center">
      <p className="text-4xl font-bold text-slate-300">403</p>
      <p className="text-sm font-medium text-slate-700">You don't have access to this page</p>
      <p className="text-xs text-slate-500">Ask your administrator to grant the module in your permissions.</p>
    </div>
  )
}

function NotFound() {
  return (
    <div className="flex flex-col items-center justify-center gap-2 py-24 text-center">
      <p className="text-4xl font-bold text-slate-300">404</p>
      <p className="text-sm font-medium text-slate-700">Page not found</p>
    </div>
  )
}

export default function AppRoutes() {
  return (
    <Routes>
      <Route path="/login" element={<Lazy><LoginPage /></Lazy>} />
      <Route path="/forgot-password" element={<Lazy><ForgotPasswordPage /></Lazy>} />
      <Route path="/reset-password" element={<Lazy><ResetPasswordPage /></Lazy>} />
      <Route path="/set-password" element={<RequireAuth><Lazy><SetPasswordPage /></Lazy></RequireAuth>} />

      <Route
        path="/app"
        element={
          <RequireAuth>
            <AppLayout />
          </RequireAuth>
        }
      >
        <Route index element={<HomeRedirect />} />
        <Route path="dashboard" element={<RequirePermission module="dashboard"><Lazy><DashboardPage /></Lazy></RequirePermission>} />
        <Route path="leads" element={<RequirePermission module="leads"><Lazy><LeadsListPage /></Lazy></RequirePermission>} />
        <Route path="leads/:id" element={<RequirePermission module="leads"><Lazy><LeadDetailPage /></Lazy></RequirePermission>} />
        <Route path="tasks" element={<RequirePermission module="tasks"><Lazy><TasksPage /></Lazy></RequirePermission>} />
        <Route path="admin/users" element={<RequirePermission module="users"><Lazy><UsersPage /></Lazy></RequirePermission>} />
        <Route path="admin/teams" element={<RequirePermission module="teams"><Lazy><TeamsPage /></Lazy></RequirePermission>} />
        <Route path="admin/teams/:id" element={<RequirePermission module="teams"><Lazy><TeamDetailPage /></Lazy></RequirePermission>} />
        <Route path="admin/masters" element={<RequirePermission module="masters"><Lazy><MastersPage /></Lazy></RequirePermission>} />
        <Route path="admin/messaging" element={<RequirePermission module="communications" action="edit"><Lazy><MessagingPage /></Lazy></RequirePermission>} />
        <Route path="admin/integrations" element={<RequireSuperAdmin><Lazy><IntegrationsPage /></Lazy></RequireSuperAdmin>} />
        <Route path="admin/audit" element={<RequirePermission module="audit"><Lazy><AuditLogPage /></Lazy></RequirePermission>} />
        <Route path="profile" element={<Lazy><ProfilePage /></Lazy>} />
        <Route path="forbidden" element={<Forbidden />} />
        <Route path="*" element={<NotFound />} />
      </Route>

      <Route path="/" element={<Navigate to="/app" replace />} />
      <Route path="*" element={<Navigate to="/app" replace />} />
    </Routes>
  )
}
