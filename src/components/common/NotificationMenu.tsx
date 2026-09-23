import React, { useCallback, useMemo, useState } from 'react';
import { Bell, CheckCheck, ClipboardList, Settings2, UserPlus, Users } from 'lucide-react';
import useClickOutside from '../../hooks/useClickOutside';
import { mockNotifications } from '../../utils/mockNotifications';
import type { NotificationItem, NotificationKind } from '../../utils/types';

const kindStyles: Record<NotificationKind, { icon: React.ReactNode; className: string }> = {
  lead: {
    icon: <UserPlus size={15} />,
    className: 'bg-primary-soft text-primary-contrast border-primary/20',
  },
  task: {
    icon: <ClipboardList size={15} />,
    className: 'bg-secondary-soft text-secondary-contrast border-secondary/25',
  },
  user: {
    icon: <Users size={15} />,
    className: 'bg-crmSuccess-bg text-crmSuccess border-crmSuccess-border',
  },
  system: {
    icon: <Settings2 size={15} />,
    className: 'bg-crmInfo-bg text-crmInfo border-crmInfo-border',
  },
};

/**
 * Header notification dropdown.
 * Data is local mock state - no notifications API exists yet.
 */
export const NotificationMenu: React.FC = () => {
  const [isOpen, setIsOpen] = useState(false);
  const [items, setItems] = useState<NotificationItem[]>(mockNotifications);

  const close = useCallback(() => setIsOpen(false), []);
  const wrapperRef = useClickOutside<HTMLDivElement>(isOpen, close);

  const unreadCount = useMemo(() => items.filter((item) => !item.read).length, [items]);

  const markAllAsRead = () => setItems((prev) => prev.map((item) => ({ ...item, read: true })));

  const markAsRead = (id: number) =>
    setItems((prev) => prev.map((item) => (item.id === id ? { ...item, read: true } : item)));

  return (
    <div className="relative" ref={wrapperRef}>
      <button
        type="button"
        onClick={() => setIsOpen((prev) => !prev)}
        aria-haspopup="menu"
        aria-expanded={isOpen}
        aria-label={unreadCount > 0 ? `Notifications, ${unreadCount} unread` : 'Notifications'}
        title="Notifications"
        className={`relative flex h-9 w-9 items-center justify-center rounded-xl border transition-all ${
          isOpen
            ? 'border-primary/30 bg-primary-soft text-primary-contrast'
            : 'border-crmBorder bg-major-tint text-crmText-secondary hover:border-primary/30 hover:bg-primary-soft hover:text-primary-contrast'
        }`}
      >
        <Bell size={17} />
        {unreadCount > 0 && (
          <span className="absolute -right-0.5 -top-0.5 flex h-[18px] min-w-[18px] items-center justify-center rounded-full border-2 border-major bg-secondary px-1 text-[10px] font-bold leading-none text-white shadow-sm">
            {unreadCount > 9 ? '9+' : unreadCount}
          </span>
        )}
      </button>

      {isOpen && (
        <div
          role="menu"
          className="animate-menu-in absolute right-0 z-50 mt-2 w-[min(22rem,calc(100vw-2rem))] origin-top-right overflow-hidden rounded-2xl border border-crmBorder bg-major shadow-crm-lg"
        >
          {/* Header */}
          <div className="flex items-center justify-between gap-3 border-b border-crmBorder px-4 py-3">
            <div>
              <p className="font-outfit text-sm font-semibold text-crmText">Notifications</p>
              <p className="text-[11px] text-crmText-tertiary">
                {unreadCount > 0 ? `${unreadCount} unread` : 'You are all caught up'}
              </p>
            </div>
            <button
              type="button"
              onClick={markAllAsRead}
              disabled={unreadCount === 0}
              className="inline-flex items-center gap-1.5 rounded-lg px-2 py-1 text-[11px] font-semibold text-minor-contrast transition-colors hover:bg-minor-soft disabled:cursor-not-allowed disabled:text-crmText-tertiary disabled:hover:bg-transparent"
            >
              <CheckCheck size={13} />
              Mark all as read
            </button>
          </div>

          {/* List */}
          <div className="max-h-[22rem] overflow-y-auto">
            {items.length === 0 ? (
              <div className="px-4 py-10 text-center">
                <Bell size={22} className="mx-auto mb-2 text-crmText-tertiary" />
                <p className="text-sm font-semibold text-crmText">No notifications</p>
                <p className="mt-1 text-xs text-crmText-tertiary">New activity will show up here.</p>
              </div>
            ) : (
              items.map((item) => {
                const style = kindStyles[item.kind];
                return (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => markAsRead(item.id)}
                    className={`flex w-full items-start gap-3 border-b border-crmBorder px-4 py-3 text-left transition-colors last:border-b-0 hover:bg-major-tint ${
                      item.read ? 'bg-transparent' : 'bg-minor-subtle'
                    }`}
                  >
                    <span
                      className={`mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border ${style.className}`}
                    >
                      {style.icon}
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="flex items-center gap-2">
                        <span
                          className={`truncate text-[13px] ${
                            item.read ? 'font-medium text-crmText-secondary' : 'font-semibold text-crmText'
                          }`}
                        >
                          {item.title}
                        </span>
                        {!item.read && <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-minor" />}
                      </span>
                      <span className="mt-0.5 block line-clamp-2 text-xs text-crmText-secondary">
                        {item.description}
                      </span>
                      <span className="mt-1 block text-[11px] text-crmText-tertiary">{item.time}</span>
                    </span>
                  </button>
                );
              })
            )}
          </div>

          {/* Footer */}
          <div className="border-t border-crmBorder bg-major-tint px-4 py-2.5">
            <button
              type="button"
              onClick={close}
              className="w-full rounded-lg py-1.5 text-center text-xs font-semibold text-minor-contrast transition-colors hover:bg-minor-soft"
            >
              View all notifications
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default NotificationMenu;
