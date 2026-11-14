import type { ActionKey, ModuleKey, ModulePermission, User } from '../types/models'

export const MODULES: { key: ModuleKey; label: string; slice1: boolean; children?: { key: ModuleKey; label: string }[] }[] = [
  { key: 'dashboard', label: 'Dashboard', slice1: true },
  { key: 'leads', label: 'Leads', slice1: true },
  { key: 'tasks', label: 'Tasks & Follow-ups', slice1: false },
  {
    key: 'round_robin',
    label: 'Round Robin',
    slice1: true,
    children: [
      { key: 'round_robin.inside_sales', label: 'Inside Sales' },
      { key: 'round_robin.partners', label: 'Partners' },
    ],
  },
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
  { key: 'attendance', label: 'Attendance', slice1: true },
  { key: 'targets', label: 'Target Manager', slice1: true },
  { key: 'analytics', label: 'Analytics', slice1: false },
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

/**
 * The scopes an admin can pick. The backend also knows 'all' (seeded Admin
 * templates and the Super Admin use it); the dropdown keeps such a value on an
 * existing user or template but never offers it.
 */
export const DATA_SCOPES: { key: string; label: string; hint: string }[] = [
  { key: 'own', label: 'Own records', hint: 'Only records this user owns' },
  { key: 'team', label: 'Team', hint: 'Their team, managed teams and direct reports' },
  { key: 'team_unassigned', label: 'Team + Unassigned', hint: "Their team's leads and every lead with no owner" },
]

/** A module's parts by their key ('round_robin.partners' → 'round_robin'), from MODULES. */
export const PARENT_MODULE: Partial<Record<ModuleKey, ModuleKey>> = Object.fromEntries(
  MODULES.flatMap((m) => (m.children ?? []).map((c) => [c.key, m.key]))
)

export const childModules = (module: ModuleKey): ModuleKey[] => MODULES.find((m) => m.key === module)?.children?.map((c) => c.key) ?? []

/** "Round Robin", or "Round Robin › Partners" for a part. */
export const moduleLabel = (key: string): string => {
  for (const m of MODULES) {
    if (m.key === key) return m.label
    const child = m.children?.find((c) => c.key === key)
    if (child) return `${m.label} › ${child.label}`
  }
  return key
}

const holds = (permissions: ModulePermission[], module: ModuleKey, action: ActionKey) =>
  !!permissions.find((p) => p.module === module)?.actions.includes(action)

/**
 * The backend's has_action (common/permissions_catalog.py): a part needs View on its module, and while none of a
 * module's parts is ticked the module's own actions cover every part.
 */
export function can(
  user: Pick<User, 'isSuperAdmin' | 'permissions'> | null | undefined,
  module: ModuleKey,
  action: ActionKey = 'view'
): boolean {
  if (!user) return false
  if (user.isSuperAdmin) return true
  const permissions = (user.permissions as ModulePermission[] | undefined) ?? []
  const parent = PARENT_MODULE[module]
  if (parent) {
    if (!holds(permissions, parent, 'view')) return false
    const parts = childModules(parent)
    if (!permissions.some((p) => parts.includes(p.module))) return holds(permissions, parent, action)
  }
  return holds(permissions, module, action)
}
