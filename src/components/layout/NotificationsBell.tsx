import { useCallback, useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  AlarmClock,
  ArrowRightLeft,
  Bell,
  BellRing,
  CalendarClock,
  CheckCheck,
  Download,
  Hourglass,
  Inbox,
  Languages,
  PlugZap,
  Repeat,
  Send,
  Sparkles,
  UserPlus,
} from 'lucide-react'
import { toast } from 'sonner'
import {
  useListNotificationsQuery,
  useMarkAllNotificationsReadMutation,
  useMarkNotificationReadMutation,
} from '../../services/miscApi'
import { authorizedDownload } from '../../lib/download'
import { cn, timeAgo } from '../../lib/utils'
import type { Notification as CrmNotification } from '../../types/models'

const NOTIFICATION_ICONS: Record<string, { icon: typeof Bell; className: string }> = {
  lead_assigned: { icon: UserPlus, className: 'bg-brand-50 text-brand-600' },
  lead_reassigned: { icon: ArrowRightLeft, className: 'bg-amber-50 text-amber-700' },
  task_due: { icon: CalendarClock, className: 'bg-amber-50 text-amber-700' },
  task_overdue: { icon: AlarmClock, className: 'bg-red-50 text-red-600' },
  re_enquiry: { icon: Repeat, className: 'bg-sky-50 text-sky-700' },
  unassigned_pool: { icon: Inbox, className: 'bg-amber-50 text-amber-700' },
  untouched: { icon: Hourglass, className: 'bg-amber-50 text-amber-700' },
  language_barrier: { icon: Languages, className: 'bg-pink-50 text-pink-600' },
  bulk_done: { icon: Send, className: 'bg-emerald-50 text-emerald-700' },
  export_ready: { icon: Download, className: 'bg-emerald-50 text-emerald-700' },
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

export function NotificationsBell() {
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
  const items = data?.data.items ?? []

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-label={`Notifications${unread ? `, ${unread} unread` : ''}`}
        className="relative inline-flex h-9 w-9 items-center justify-center rounded-lg text-slate-500 transition-colors hover:bg-brand-50 hover:text-brand-700"
      >
        <Bell className="h-[18px] w-[18px]" />
        {unread > 0 && (
          <span className="absolute right-1 top-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-red-500 px-1 text-[9px] font-bold text-white ring-2 ring-white">
            {unread > 99 ? '99+' : unread}
          </span>
        )}
      </button>
      {open && (
        <>
          <div className="fixed inset-0 z-30" onClick={() => setOpen(false)} />
          <div className="fixed inset-x-2 top-14 z-40 overflow-hidden rounded-xl border border-slate-200 bg-white shadow-[var(--shadow-md)] sm:absolute sm:inset-x-auto sm:right-0 sm:top-auto sm:mt-1.5 sm:w-96">
            <div className="flex items-center justify-between border-b border-slate-200 px-4 py-2.5">
              <p className="text-sm font-semibold text-slate-800">
                Notifications {unread > 0 && <span className="ml-1 rounded-full bg-red-50 px-1.5 py-0.5 text-[10px] text-red-600">{unread} new</span>}
              </p>
              <div className="flex items-center gap-3">
                {permission === 'default' && (
                  <button
                    type="button"
                    className="inline-flex items-center gap-1 text-[11px] font-medium text-slate-500 hover:text-brand-600"
                    onClick={() => window.Notification.requestPermission().then(setPermission)}
                    title="Show pop-ups when a lead or follow-up needs you"
                  >
                    <BellRing className="h-3 w-3" /> Enable pop-ups
                  </button>
                )}
                {unread > 0 && (
                  <button type="button" className="inline-flex items-center gap-1 text-[11px] font-medium text-brand-600 hover:underline" onClick={() => markAll()}>
                    <CheckCheck className="h-3 w-3" /> Mark all read
                  </button>
                )}
              </div>
            </div>
            <div className="max-h-[26rem] overflow-y-auto">
              {items.length === 0 && (
                <div className="flex flex-col items-center gap-1 px-4 py-10 text-center">
                  <Bell className="h-6 w-6 text-slate-300" />
                  <p className="text-xs font-medium text-slate-600">You're all caught up</p>
                  <p className="text-[11px] text-slate-400">New leads, follow-ups and alerts will appear here.</p>
                </div>
              )}
              {items.map((n) => {
                const meta = NOTIFICATION_ICONS[n.type] ?? NOTIFICATION_ICONS.system
                const Icon = meta.icon
                return (
                  <button
                    key={n._id}
                    type="button"
                    onClick={() => {
                      if (!n.readAt) markRead(n._id)
                      openNotification(n)
                      setOpen(false)
                    }}
                    className={cn(
                      'flex w-full gap-3 border-b border-slate-100 px-4 py-3 text-left transition-colors last:border-0 hover:bg-slate-50',
                      !n.readAt && 'bg-brand-50/40'
                    )}
                  >
                    <span className={cn('mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full', meta.className)}>
                      <Icon className="h-3.5 w-3.5" />
                    </span>
                    <span className="min-w-0 flex-1">
                      <span
                        className={cn(
                          'block text-xs font-medium leading-5',
                          ['task_overdue', 'integration_error'].includes(n.type) ? 'text-red-700' : 'text-slate-800'
                        )}
                      >
                        {n.title}
                      </span>
                      {n.body && <span className="block truncate text-[11px] text-slate-500">{n.body}</span>}
                      <span className="mt-0.5 block text-[10px] text-slate-400">{timeAgo(n.createdAt)}</span>
                    </span>
                    {!n.readAt && <span className="mt-2 h-2 w-2 shrink-0 rounded-full bg-gold-500" aria-label="Unread" />}
                  </button>
                )
              })}
            </div>
          </div>
        </>
      )}
    </div>
  )
}
