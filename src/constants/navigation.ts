import {
  CalendarClock,
  ClipboardList,
  Clock3,
  MessageSquareText,
  LayoutDashboard,
  Settings2,
  ShieldCheck,
  Shuffle,
  Target,
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
      { label: 'Target Manager', path: '/app/targets', module: 'targets', icon: Target },
    ],
  },
  {
    title: 'Administration',
    items: [
      { label: 'Users & Access', path: '/app/admin/users', module: 'users', icon: UserCog },
      { label: 'Teams', path: '/app/admin/teams', module: 'teams', icon: Users },
      { label: 'Communication', path: '/app/admin/messaging', module: 'communications', action: 'edit', icon: MessageSquareText },
      { label: 'Round Robin', path: '/app/admin/round-robin', module: 'round_robin', icon: Shuffle },
      { label: 'Masters', path: '/app/admin/masters', module: 'masters', icon: Settings2 },
      { label: 'Activity Log', path: '/app/admin/audit', module: 'audit', icon: ShieldCheck },
      { label: 'Attendance', path: '/app/admin/attendance', module: 'attendance', icon: Clock3 },
    ],
  },
]
