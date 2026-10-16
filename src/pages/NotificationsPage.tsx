import { useState } from 'react'
import { Bell, CheckCheck } from 'lucide-react'
import { Card, PageHeader } from '../components/ui/misc'
import { Button } from '../components/ui/Button'
import { Skeleton } from '../components/ui/feedback'
import { Pagination } from '../components/ui/DataTable'
import { NOTIFICATION_ICONS, useOpenNotification } from '../components/layout/notifications'
import { useListNotificationsQuery, useMarkAllNotificationsReadMutation, useMarkNotificationReadMutation } from '../services/miscApi'
import { cn, timeAgo } from '../lib/utils'

/**
 * Every notification sent to the signed-in user, newest first, a page at a time: the
 * bell's "View All" for anyone without the admin Activity Log. Rows open the same
 * target as in the bell and are marked read on the way.
 */
export default function NotificationsPage() {
  const [page, setPage] = useState(1)
  const [unreadOnly, setUnreadOnly] = useState(false)
  const { data, isLoading } = useListNotificationsQuery({ page, unread: unreadOnly || undefined })
  const [markRead] = useMarkNotificationReadMutation()
  const [markAll] = useMarkAllNotificationsReadMutation()
  const openNotification = useOpenNotification()
  const items = data?.data.items ?? []
  const unread = data?.data.unreadCount ?? 0
  const toggleUnread = () => {
    setUnreadOnly((v) => !v)
    setPage(1)
  }

  return (
    <>
      <PageHeader
        title="Notifications"
        description={unread ? `${unread} unread` : 'Everything sent to you, newest first'}
        actions={
          <>
            <Button variant={unreadOnly ? 'secondary' : 'outline'} size="sm" aria-pressed={unreadOnly} onClick={toggleUnread}>
              Unread only
            </Button>
            {unread > 0 && (
              <Button variant="outline" size="sm" onClick={() => markAll()}>
                <CheckCheck className="h-3.5 w-3.5" /> Mark All Read
              </Button>
            )}
          </>
        }
      />
      <Card bodyClassName="p-0">
        {isLoading && (
          <div className="space-y-3 p-4">
            {Array.from({ length: 6 }).map((_, i) => (
              <Skeleton key={i} className="h-10 w-full" />
            ))}
          </div>
        )}
        {!isLoading && items.length === 0 && (
          <div className="flex flex-col items-center gap-1 px-4 py-14 text-center">
            <Bell className="h-6 w-6 text-slate-300" />
            <p className="text-sm font-medium text-slate-600">{unreadOnly ? 'No unread notifications' : "You're all caught up"}</p>
            <p className="text-xs text-slate-400">New leads, follow-ups and alerts will appear here.</p>
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
              }}
              className={cn(
                'flex w-full gap-3 border-b border-slate-100 px-4 py-3 text-left transition-colors last:border-0 hover:bg-slate-50',
                !n.readAt && 'bg-brand-50/40'
              )}
            >
              <span className={cn('mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full', meta.className)}>
                <Icon className="h-4 w-4" />
              </span>
              <span className="min-w-0 flex-1">
                <span className={cn('block text-sm font-medium leading-5', ['task_overdue', 'integration_error'].includes(n.type) ? 'text-red-700' : 'text-slate-800')}>
                  {n.title}
                </span>
                {n.body && <span className="block text-xs text-slate-500">{n.body}</span>}
                <span className="mt-0.5 block text-[11px] text-slate-400">{timeAgo(n.createdAt)}</span>
              </span>
              {!n.readAt && <span className="mt-2 h-2 w-2 shrink-0 rounded-full bg-gold-500" aria-label="Unread" />}
            </button>
          )
        })}
        {data?.pagination && data.pagination.total_pages > 1 && <Pagination pagination={data.pagination} onPageChange={setPage} />}
      </Card>
    </>
  )
}
