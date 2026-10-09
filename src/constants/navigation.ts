import {
  CalendarClock,
  ClipboardList,
  MessageSquareText,
  PlugZap,
  LayoutDashboard,
  Settings2,
  ShieldCheck,
  Shuffle,
  UserCog,
  Users,
} from 'lucide-react'
import type { ActionKey, ModuleKey } from '../types/models'

export interface NavItem {
  label: string
  path: string
  module: ModuleKey
  /** permission action needed to see the item (default view) */
  action?: ActionKey
  superAdminOnly?: boolean
  icon: typeof LayoutDashboard
}

export const NAV_SECTIONS: { title?: string; items: NavItem[] }[] = [
  {
    items: [
      { label: 'Dashboard', path: '/app/dashboard', module: 'dashboard', icon: LayoutDashboard },
      { label: 'Leads', path: '/app/leads', module: 'leads', icon: ClipboardList },
      { label: 'Follow-ups', path: '/app/tasks', module: 'tasks', icon: CalendarClock },
    ],
  },
  {
    title: 'Administration',
    items: [
      { label: 'Users & Access', path: '/app/admin/users', module: 'users', icon: UserCog },
      { label: 'Teams', path: '/app/admin/teams', module: 'teams', icon: Users },
      { label: 'SMS & Email', path: '/app/admin/messaging', module: 'communications', action: 'edit', icon: MessageSquareText },
      { label: 'Meta Lead Ads', path: '/app/admin/integrations', module: 'leads', superAdminOnly: true, icon: PlugZap },
      { label: 'Round Robin', path: '/app/admin/round-robin', module: 'round_robin', icon: Shuffle },
      { label: 'Masters', path: '/app/admin/masters', module: 'masters', icon: Settings2 },
      { label: 'Activity Log', path: '/app/admin/audit', module: 'audit', icon: ShieldCheck },
    ],
  },
]
