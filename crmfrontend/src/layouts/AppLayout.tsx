import { useCallback, useEffect, useRef, useState } from 'react'
import { NavLink, Outlet, useNavigate } from 'react-router-dom'
import {
  AlarmClock,
  ArrowRightLeft,
  Bell,
  BellRing,
  Download,
  Hourglass,
  Inbox,
  Languages,
  PlugZap,
  Repeat,
  Send,
  CalendarClock,
  ChevronDown,
  GraduationCap,
  KeyRound,
  LogOut,
  Menu,
  Sparkles,
  UserPlus,
  X,
} from 'lucide-react'
import { toast } from 'sonner'
import { useAppDispatch, useCurrentUser } from '../app/hooks'
import { signedOut } from '../features/auth/authSlice'
import { useLogoutMutation } from '../services/authApi'
import {
  useListNotificationsQuery,
  useMarkAllNotificationsReadMutation,
  useMarkNotificationReadMutation,
} from '../services/miscApi'
import { NAV_SECTIONS } from '../constants/navigation'
import { can } from '../constants/permissions'
import { ErrorBoundary } from '../components/ErrorBoundary'
import { cn, initials, timeAgo } from '../lib/utils'
import { api } from '../services/api'
import { GlobalSearch } from '../components/GlobalSearch'
import { useIdleLogout } from '../hooks/useIdleLogout'
import { authorizedDownload } from '../lib/download'
import type { Notification as CrmNotification } from '../types/models'

function Sidebar({ open, onClose }: { open: boolean; onClose: () => void }) {
  const user = useCurrentUser()
  return (
    <>
      {open && <div className="fixed inset-0 z-30 bg-slate-900/40 lg:hidden" onClick={onClose} />}
      <aside
        className={cn(
          'fixed inset-y-0 left-0 z-40 flex w-60 flex-col bg-slate-900 text-slate-300 transition-transform lg:static lg:translate-x-0',
          open ? 'translate-x-0' : '-translate-x-full'
        )}
      >
        <div className="flex h-14 items-center gap-2.5 border-b border-slate-800 px-4">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-brand-600">
            <GraduationCap className="h-5 w-5 text-white" />
          </div>
          <div>
            <p className="text-sm font-semibold text-white">GCC School CRM</p>
            <p className="text-[10px] text-slate-400">Admissions Platform</p>
          </div>
          <button className="ml-auto text-slate-400 lg:hidden" onClick={onClose}>
            <X className="h-4 w-4" />
          </button>
        </div>
        <nav className="flex-1 space-y-4 overflow-y-auto px-2 py-4">
          {NAV_SECTIONS.map((section, i) => {
            const items = section.items.filter(
              (item) => can(user, item.module, item.action) && (!item.superAdminOnly || user?.isSuperAdmin)
            )
            if (!items.length) return null
            return (
              <div key={i}>
                {section.title && (
                  <p className="px-3 pb-1 text-[10px] font-semibold uppercase tracking-wider text-slate-500">
                    {section.title}
                  </p>
                )}
                {items.map((item) => (
                  <NavLink
                    key={item.path}
                    to={item.path}
                    onClick={onClose}
                    className={({ isActive }) =>
                      cn(
                        'mb-0.5 flex items-center gap-2.5 rounded-lg px-3 py-2 text-[13px] font-medium transition-colors',
                        isActive
                          ? 'bg-brand-600/20 text-white'
                          : 'text-slate-400 hover:bg-slate-800 hover:text-slate-200'
                      )
                    }
                  >
                    <item.icon className="h-4 w-4 shrink-0" />
                    {item.label}
                  </NavLink>
                ))}
              </div>
            )
          })}
        </nav>
        <div className="border-t border-slate-800 px-4 py-3 text-[11px] text-slate-500">
          Go-live · Lead Management
        </div>
      </aside>
    </>
  )
}

const NOTIFICATION_ICONS: Record<string, { icon: typeof Bell; className: string }> = {
  lead_assigned: { icon: UserPlus, className: 'bg-brand-50 text-brand-600' },
  lead_reassigned: { icon: ArrowRightLeft, className: 'bg-amber-50 text-amber-600' },
  task_due: { icon: CalendarClock, className: 'bg-orange-50 text-orange-600' },
  task_overdue: { icon: AlarmClock, className: 'bg-red-50 text-red-600' },
  re_enquiry: { icon: Repeat, className: 'bg-sky-50 text-sky-600' },
  unassigned_pool: { icon: Inbox, className: 'bg-amber-50 text-amber-600' },
  untouched: { icon: Hourglass, className: 'bg-orange-50 text-orange-600' },
  language_barrier: { icon: Languages, className: 'bg-violet-50 text-violet-600' },
  bulk_done: { icon: Send, className: 'bg-emerald-50 text-emerald-600' },
  export_ready: { icon: Download, className: 'bg-emerald-50 text-emerald-600' },
  integration_error: { icon: PlugZap, className: 'bg-red-50 text-red-600' },
  system: { icon: Sparkles, className: 'bg-slate-100 text-slate-500' },
}

/** Where a click on a notification goes: the lead, a filtered list, or a file. */
function useOpenNotification() {
  const navigate = useNavigate()
  return useCallback(
    (n: CrmNotification) => {
      if (n.data?.leadId) navigate(`/app/leads/${n.data.leadId}`)
      else if (n.data?.smart) navigate(`/app/leads?smart=${n.data.smart}`)
      else if (n.data?.url)
        authorizedDownload(n.data.url, 'leads-export.xlsx').catch(() => toast.error('This download link has expired'))
      else if (n.data?.errorFile)
        authorizedDownload(`/leads/import/errors/${n.data.errorFile}`, 'upload-errors.xlsx').catch(() =>
          toast.error('Error file not found')
        )
      else if (n.type === 'integration_error') navigate('/app/admin/integrations')
    },
    [navigate]
  )
}

/**
 * Browser pop-ups (GL-30) for new notifications while the CRM tab is open or
 * in the background. Only notifications that arrive after the page loaded pop up.
 */
function useBrowserPush(items: CrmNotification[] | undefined, open: (n: CrmNotification) => void) {
  const seen = useRef<Set<string> | null>(null)
  useEffect(() => {
    if (!items) return
    if (seen.current === null) {
      seen.current = new Set(items.map((n) => n._id))
      return
    }
    const fresh = items.filter((n) => !n.readAt && !seen.current!.has(n._id))
    fresh.forEach((n) => seen.current!.add(n._id))
    if (!fresh.length || typeof window.Notification === 'undefined' || window.Notification.permission !== 'granted') return
    for (const n of fresh.slice(0, 3)) {
      const popup = new window.Notification(n.title, { body: n.body ?? undefined, tag: n._id })
      popup.onclick = () => {
        window.focus()
        open(n)
        popup.close()
      }
    }
  }, [items, open])
}

function NotificationsBell() {
  const [open, setOpen] = useState(false)
  const openNotification = useOpenNotification()
  const { data } = useListNotificationsQuery({ page: 1 }, { pollingInterval: 30000 })
  const [permission, setPermission] = useState(() =>
    typeof window.Notification === 'undefined' ? 'unsupported' : window.Notification.permission
  )
  useBrowserPush(data?.data.items, openNotification)
  const [markRead] = useMarkNotificationReadMutation()
  const [markAll] = useMarkAllNotificationsReadMutation()
  const unread = data?.data.unreadCount ?? 0

  return (
    <div className="relative">
      <button
        onClick={() => setOpen((o) => !o)}
        className="relative rounded-lg p-2 text-slate-500 hover:bg-slate-100 hover:text-slate-700"
      >
        <Bell className="h-4.5 w-4.5" />
        {unread > 0 && (
          <span className="absolute -right-0.5 -top-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-red-500 px-1 text-[9px] font-bold text-white">
            {unread > 99 ? '99+' : unread}
          </span>
        )}
      </button>
      {open && (
        <>
          <div className="fixed inset-0 z-30" onClick={() => setOpen(false)} />
          <div className="absolute right-0 z-40 mt-1 w-80 overflow-hidden rounded-xl border border-slate-200 bg-white shadow-xl">
            <div className="flex items-center justify-between border-b border-slate-100 px-3 py-2">
              <p className="text-xs font-semibold text-slate-700">Notifications</p>
              <div className="flex items-center gap-2">
                {permission === 'default' && (
                  <button
                    className="inline-flex items-center gap-1 text-[11px] font-medium text-slate-500 hover:text-brand-600"
                    onClick={() => window.Notification.requestPermission().then(setPermission)}
                    title="Show pop-ups when a lead or follow-up needs you"
                  >
                    <BellRing className="h-3 w-3" /> Enable pop-ups
                  </button>
                )}
                {unread > 0 && (
                  <button className="text-[11px] font-medium text-brand-600 hover:underline" onClick={() => markAll()}>
                    Mark all read
                  </button>
                )}
              </div>
            </div>
            <div className="max-h-80 overflow-y-auto">
              {(data?.data.items ?? []).length === 0 && (
                <p className="px-3 py-8 text-center text-xs text-slate-400">No notifications yet</p>
              )}
              {data?.data.items.map((n) => (
                <button
                  key={n._id}
                  onClick={() => {
                    if (!n.readAt) markRead(n._id)
                    openNotification(n)
                    setOpen(false)
                  }}
                  className={cn(
                    'block w-full border-b border-slate-50 px-3 py-2.5 text-left hover:bg-slate-50',
                    !n.readAt && 'bg-brand-50/50'
                  )}
                >
                  <div className="flex gap-2.5">
                    {(() => {
                      const meta = NOTIFICATION_ICONS[n.type] ?? NOTIFICATION_ICONS.system
                      const Icon = meta.icon
                      return (
                        <span className={cn('mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full', meta.className)}>
                          <Icon className="h-3 w-3" />
                        </span>
                      )
                    })()}
                    <div className="min-w-0">
                      <p className={cn('text-xs font-medium', ['task_overdue', 'integration_error'].includes(n.type) ? 'text-red-700' : 'text-slate-700')}>{n.title}</p>
                      {n.body && <p className="mt-0.5 truncate text-[11px] text-slate-500">{n.body}</p>}
                      <p className="mt-0.5 text-[10px] text-slate-400">{timeAgo(n.createdAt)}</p>
                    </div>
                  </div>
                </button>
              ))}
            </div>
          </div>
        </>
      )}
    </div>
  )
}

/** GL-05: 30 minutes without activity signs the user out. */
function useIdleSignOut() {
  const dispatch = useAppDispatch()
  const navigate = useNavigate()
  const [logout] = useLogoutMutation()
  const onIdle = useCallback(() => {
    logout()
      .unwrap()
      .catch(() => undefined)
      .finally(() => {
        dispatch(signedOut())
        dispatch(api.util.resetApiState())
        toast.info('Signed out after 30 minutes of inactivity')
        navigate('/login')
      })
  }, [dispatch, logout, navigate])
  useIdleLogout(onIdle)
}

function ProfileMenu() {
  const [open, setOpen] = useState(false)
  const user = useCurrentUser()
  const dispatch = useAppDispatch()
  const navigate = useNavigate()
  const [logout] = useLogoutMutation()

  const onLogout = async () => {
    try {
      await logout().unwrap()
    } catch {
      // Already signed out server-side — proceed regardless.
    }
    dispatch(signedOut())
    dispatch(api.util.resetApiState())
    toast.success('Signed out')
    navigate('/login')
  }
  useIdleSignOut()

  return (
    <div className="relative">
      <button
        onClick={() => setOpen((o) => !o)}
        className="flex items-center gap-2 rounded-lg px-2 py-1.5 hover:bg-slate-100"
      >
        <span className="flex h-7 w-7 items-center justify-center rounded-full bg-brand-600 text-[11px] font-semibold text-white">
          {initials(user?.name)}
        </span>
        <span className="hidden text-left sm:block">
          <span className="block text-xs font-medium text-slate-700">{user?.name}</span>
          <span className="block text-[10px] text-slate-400">
            {user?.isSuperAdmin ? 'Super Admin' : user?.roleLabel && user.role !== 'other' ? user.roleLabel : user?.designation || 'User'}
          </span>
        </span>
        <ChevronDown className="h-3.5 w-3.5 text-slate-400" />
      </button>
      {open && (
        <>
          <div className="fixed inset-0 z-30" onClick={() => setOpen(false)} />
          <div className="absolute right-0 z-40 mt-1 w-48 overflow-hidden rounded-xl border border-slate-200 bg-white py-1 shadow-xl">
            <button
              onClick={() => {
                navigate('/app/profile')
                setOpen(false)
              }}
              className="flex w-full items-center gap-2 px-3 py-2 text-xs text-slate-600 hover:bg-slate-50"
            >
              <KeyRound className="h-3.5 w-3.5" /> Change password
            </button>
            <button
              onClick={onLogout}
              className="flex w-full items-center gap-2 px-3 py-2 text-xs text-red-600 hover:bg-red-50"
            >
              <LogOut className="h-3.5 w-3.5" /> Sign out
            </button>
          </div>
        </>
      )}
    </div>
  )
}

export default function AppLayout() {
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const user = useCurrentUser()
  return (
    <div className="flex h-screen overflow-hidden">
      <Sidebar open={sidebarOpen} onClose={() => setSidebarOpen(false)} />
      <div className="flex min-w-0 flex-1 flex-col">
        <header className="flex h-14 shrink-0 items-center justify-between gap-3 border-b border-slate-200 bg-white px-4">
          <button
            className="rounded-lg p-2 text-slate-500 hover:bg-slate-100 lg:hidden"
            onClick={() => setSidebarOpen(true)}
          >
            <Menu className="h-4.5 w-4.5" />
          </button>
          <div className="flex flex-1 justify-center">{can(user, 'leads') && <GlobalSearch />}</div>
          <NotificationsBell />
          <ProfileMenu />
        </header>
        <main className="flex-1 overflow-y-auto p-4 lg:p-6">
          <ErrorBoundary>
            <Outlet />
          </ErrorBoundary>
        </main>
      </div>
    </div>
  )
}
