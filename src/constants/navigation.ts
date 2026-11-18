import {
  BarChart3,
  ChartPie,
  CalendarCheck,
  CalendarClock,
  ClipboardList,
  Clock3,
  Handshake,
  Layers,
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
      { label: 'Reports', path: '/app/reports', module: 'reports', icon: BarChart3 },
    ],
  },
  {
    // its own section: consultant leads, apart from the student modules above (only Channel Partners users see it)
    title: 'Channel Partners',
    items: [
      { label: 'Partner Leads', path: '/app/consultants/leads', module: 'consultants.leads', icon: Handshake },
      { label: 'Partner Follow-ups', path: '/app/consultants/follow-ups', module: 'consultants.follow_ups', icon: CalendarCheck },
      { label: 'Lead Stages', path: '/app/consultants/stages', module: 'consultants.stages', icon: Layers },
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
  {
    title: 'Analytics',
    items: [{ label: 'Sales & Counsellor', path: '/app/analytics', module: 'analytics', icon: ChartPie }],
  },
]
