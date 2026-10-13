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
  Mail,
  Inbox,
  Languages,
  PlugZap,
  Repeat,
  Send,
  Sparkles,
  UserPlus,
  X,
} from 'lucide-react'
import { toast } from 'sonner'
import {
  useListNotificationsQuery,
  useMarkAllNotificationsReadMutation,
  useMarkNotificationReadMutation,
  usePushStatusQuery,
  useSubscribePushMutation,
  useUnsubscribePushMutation,
} from '../../services/miscApi'
import { authorizedDownload } from '../../lib/download'
import {
  currentPushToken,
  forgetPushToken,
  pushEnabledPreference,
  pushPermission,
  requestPushPermission,
  setPushEnabledPreference,
  showPushToast,
  storedPushToken,
  type PushState,
} from '../../lib/push'
import { Switch } from '../ui/fields'
import { parseApiError } from '../../lib/utils'
import { cn, timeAgo } from '../../lib/utils'
import type { Notification as CrmNotification } from '../../types/models'

/** How the email-type keys read in the bell's "also by email" line. */
const EMAIL_TYPE_LABELS: Record<string, string> = {
  lead_assigned: 'lead assigned',
  lead_reassigned: 'lead reassigned',
  untouched: 'lead left untouched',
  task_due: 'follow-up due',
  task_overdue: 'follow-up overdue',
}
const emailTypeLabel = (key: string) => EMAIL_TYPE_LABELS[key] ?? key.replace(/_/g, ' ')

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
 * New notifications since the page loaded (GL-30), picked up by the poll. Each
 * one becomes a toast with a "View" action — the same toast a push message
 * produces (the notification id keeps the two from doubling up). A tab in the
 * background keeps its toast until the user is back, and also gets a browser
 * pop-up unless this browser is on real push, where the service worker shows it.
 */
function useFreshNotifications(
  items: CrmNotification[] | undefined,
  open: (n: CrmNotification) => void,
  markRead: (id: string) => void,
  fcmHandlesBackground: boolean,
  enabled: boolean
) {
  const seen = useRef<Set<string> | null>(null)
  useEffect(() => {
    if (!items) return
    if (seen.current === null) {
      seen.current = new Set(items.map((n) => n._id))
      return
    }
    const fresh = items.filter((n) => !n.readAt && !seen.current!.has(n._id))
    fresh.forEach((n) => seen.current!.add(n._id))
    if (!fresh.length || !enabled) return // switched off: the bell count still updates, nothing pops up
    const visible = document.visibilityState === 'visible'
    for (const n of fresh.slice(0, 3)) {
      showPushToast(
        { notificationId: n._id, type: n.type, title: n.title, body: n.body },
        () => {
          markRead(n._id)
          open(n)
        },
        { persist: !visible }
      )
      if (!visible && !fcmHandlesBackground && typeof window.Notification !== 'undefined' && window.Notification.permission === 'granted') {
        const popup = new window.Notification(n.title, { body: n.body ?? undefined, tag: n._id })
        popup.onclick = () => {
          window.focus()
          open(n)
          popup.close()
        }
      }
    }
  }, [items, open, markRead, fcmHandlesBackground, enabled])
}

export function NotificationsBell() {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)
  const openNotification = useOpenNotification()
  // 10 s, plus at once when the tab regains focus: a new lead, follow-up or alert shows as a toast
  // within that time even without real push
  const { data } = useListNotificationsQuery({ page: 1 }, { pollingInterval: 10000, refetchOnFocus: true })
  const { data: pushStatus } = usePushStatusQuery()
  const [permission, setPermission] = useState<PushState>(pushPermission)
  const [pushToken, setPushToken] = useState(storedPushToken)
  const [pushEnabled, setPushEnabled] = useState(pushEnabledPreference)
  const [enabling, setEnabling] = useState(false)
  const [subscribePush] = useSubscribePushMutation()
  const [unsubscribePush] = useUnsubscribePushMutation()
  const pushOn = pushEnabled && permission === 'granted' && !!pushToken
  // Permission prompt → device token → registered with the backend, in one click.
  const enablePush = async () => {
    setEnabling(true)
    try {
      setPushEnabledPreference(true)
      setPushEnabled(true)
      const state = await requestPushPermission()
      setPermission(state)
      if (state === 'denied') toast.error('Notifications are blocked for this site in the browser settings')
      if (state !== 'granted') return
      const token = await currentPushToken()
      if (!token) {
        toast.error('Push notifications are not available in this browser')
        return
      }
      await subscribePush({ token, platform: 'web' }).unwrap()
      setPushToken(token)
      toast.success('Push notifications are on for this browser')
    } catch (err) {
      toast.error(parseApiError(err).message)
    } finally {
      setEnabling(false)
    }
  }
  // Off: this browser is unregistered and nothing pops up here until it is switched on again.
  const disablePush = async () => {
    setEnabling(true)
    try {
      setPushEnabledPreference(false)
      setPushEnabled(false)
      const token = await forgetPushToken()
      setPushToken(null)
      if (token) await unsubscribePush({ token }).unwrap()
      toast('Push notifications are off for this browser')
    } catch (err) {
      toast.error(parseApiError(err).message)
    } finally {
      setEnabling(false)
    }
  }
  const [markRead] = useMarkNotificationReadMutation()
  const markReadById = useCallback((id: string) => void markRead(id), [markRead])
  useFreshNotifications(data?.data.items, openNotification, markReadById, pushOn && pushStatus?.data.provider === 'fcm', pushEnabled)
  const [markAll] = useMarkAllNotificationsReadMutation()
  const unread = data?.data.unreadCount ?? 0
  const items = data?.data.items ?? []
  // Email copies (lead assigned, untouched, follow-up overdue) go to the user's own address, browser open or not.
  const emailStatus = pushStatus?.data.email

  // Close on a click anywhere outside the bell and its panel, or on Escape.
  useEffect(() => {
    if (!open) return
    const onClick = (e: MouseEvent) => !ref.current?.contains(e.target as Node) && setOpen(false)
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setOpen(false)
    document.addEventListener('mousedown', onClick)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('mousedown', onClick)
      document.removeEventListener('keydown', onKey)
    }
  }, [open])

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-label={`Notifications${unread ? `, ${unread} unread` : ''}`}
        aria-expanded={open}
        aria-haspopup="true"
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
          <div className="fixed inset-x-2 top-14 z-40 overflow-hidden rounded-xl border border-slate-200 bg-white shadow-[var(--shadow-md)] sm:absolute sm:inset-x-auto sm:right-0 sm:top-auto sm:mt-1.5 sm:w-96">
            <div className="flex items-center justify-between border-b border-slate-200 px-4 py-2.5">
              <p className="min-w-0 truncate whitespace-nowrap text-sm font-semibold text-slate-800">
                Notifications {unread > 0 && <span className="ml-1 rounded-full bg-red-50 px-1.5 py-0.5 text-[10px] text-red-600">{unread} new</span>}
              </p>
              <div className="flex shrink-0 items-center gap-3">
                {unread > 0 && (
                  <button type="button" className="inline-flex items-center gap-1 whitespace-nowrap text-[11px] font-medium text-brand-600 hover:underline" onClick={() => markAll()}>
                    <CheckCheck className="h-3 w-3" /> Mark All Read
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => setOpen(false)}
                  aria-label="Close notifications"
                  title="Close"
                  className="-mr-1.5 rounded-md p-1 text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-700"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
            </div>
            {permission !== 'unsupported' && (
              <div className="flex items-center justify-between gap-3 border-b border-slate-100 bg-slate-50/70 px-4 py-1.5">
                <span
                  className="inline-flex min-w-0 items-center gap-1.5 text-[11px] font-medium text-slate-600"
                  title={
                    permission === 'denied'
                      ? 'Notifications are blocked for this site in the browser settings'
                      : 'Push notifications, toasts and pop-ups for this browser: a lead assigned to you, a lead left untouched, a follow-up due'
                  }
                >
                  <BellRing className={cn('h-3 w-3 shrink-0', pushOn ? 'text-emerald-600' : 'text-slate-400')} />
                  <span className={cn('truncate', pushOn && 'text-emerald-700')}>
                    {enabling ? 'Turning push…' : pushOn ? 'Push notifications on' : permission === 'denied' ? 'Notifications blocked in the browser' : 'Push notifications off'}
                  </span>
                </span>
                <Switch
                  label="Push Notifications"
                  checked={pushOn}
                  loading={enabling}
                  disabled={permission === 'denied'}
                  onChange={(on) => (on ? enablePush() : disablePush())}
                />
              </div>
            )}
            {emailStatus && (
              <div
                className="flex items-center gap-1.5 border-b border-slate-100 px-4 py-1.5 text-[11px] text-slate-500"
                title={
                  emailStatus.enabled
                    ? `Also emailed to ${emailStatus.address ?? 'your address'}: ${emailStatus.types.map(emailTypeLabel).join(', ')}`
                    : 'Email alerts are off for this account'
                }
              >
                <Mail className={cn('h-3 w-3 shrink-0', emailStatus.enabled ? 'text-emerald-600' : 'text-slate-400')} />
                <span className="min-w-0 truncate">
                  {emailStatus.enabled
                    ? `Also by email (${emailStatus.types.map(emailTypeLabel).join(', ')})`
                    : 'Email alerts off'}
                </span>
              </div>
            )}
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
