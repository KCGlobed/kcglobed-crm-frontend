import type { ActionKey, ModuleKey, ModulePermission, User } from '../types/models'

export const MODULES: { key: ModuleKey; label: string; slice1: boolean }[] = [
  { key: 'dashboard', label: 'Dashboard', slice1: true },
  { key: 'leads', label: 'Leads', slice1: true },
  { key: 'tasks', label: 'Tasks & Follow-ups', slice1: false },
  { key: 'applications', label: 'Applications', slice1: false },
  { key: 'documents', label: 'Documents', slice1: false },
  { key: 'exams', label: 'Exams (NFET)', slice1: false },
  { key: 'interviews', label: 'Interviews', slice1: false },
  { key: 'offers', label: 'Offers & Admission', slice1: false },
  { key: 'payments', label: 'Payments', slice1: false },
  { key: 'loans', label: 'Education Loans', slice1: false },
  { key: 'communications', label: 'Communication', slice1: false },
  { key: 'automation', label: 'Automation', slice1: false },
  { key: 'reports', label: 'Reports', slice1: false },
  { key: 'users', label: 'Users & Access', slice1: true },
  { key: 'teams', label: 'Teams', slice1: true },
  { key: 'masters', label: 'Masters', slice1: true },
  { key: 'audit', label: 'Audit Log', slice1: true },
]

export const ACTIONS: { key: ActionKey; label: string }[] = [
  { key: 'view', label: 'View' },
  { key: 'create', label: 'Create' },
  { key: 'edit', label: 'Edit' },
  { key: 'delete', label: 'Delete' },
  { key: 'export', label: 'Export' },
  { key: 'import', label: 'Import' },
  { key: 'reassign', label: 'Reassign' },
  { key: 'approve', label: 'Approve' },
]

export const DATA_SCOPES: { key: string; label: string; hint: string }[] = [
  { key: 'own', label: 'Own records', hint: 'Only records this user owns' },
  { key: 'team', label: 'Team', hint: 'Their team, managed teams and direct reports' },
  { key: 'location', label: 'Location', hint: 'Resolved as Team until location data lands' },
  { key: 'program', label: 'Program', hint: 'Resolved as Team until program scoping lands' },
  { key: 'cohort', label: 'Cohort', hint: 'Resolved as Team until cohort scoping lands' },
  { key: 'all', label: 'All records', hint: 'No data restriction' },
]

export function can(
  user: Pick<User, 'isSuperAdmin' | 'permissions'> | null | undefined,
  module: ModuleKey,
  action: ActionKey = 'view'
): boolean {
  if (!user) return false
  if (user.isSuperAdmin) return true
  const entry = (user.permissions as ModulePermission[] | undefined)?.find((p) => p.module === module)
  return !!entry && entry.actions.includes(action)
}
