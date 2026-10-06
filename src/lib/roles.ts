import type { User } from '../types/models'

type Who = Pick<User, 'isSuperAdmin' | 'role' | 'dataScope'> | null | undefined

/** Super Admin or Admin — sees all leads, the Unassigned pool, bulk actions (Go-live §3). */
export function isAdminLike(user: Who): boolean {
  return !!user && (user.isSuperAdmin || user.role === 'admin' || user.dataScope === 'all')
}

export function isCounsellor(user: Who): boolean {
  return !!user && !user.isSuperAdmin && user.role === 'counsellor'
}

export const ROLE_OPTIONS = [
  { value: 'admin', label: 'Admin' },
  { value: 'counsellor', label: 'Admission Counsellor' },
] as const
