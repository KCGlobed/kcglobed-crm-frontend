import { clsx, type ClassValue } from 'clsx'
import dayjs from 'dayjs'
import relativeTime from 'dayjs/plugin/relativeTime'

dayjs.extend(relativeTime)

export function cn(...inputs: ClassValue[]) {
  return clsx(inputs)
}

export function formatDate(value?: string | Date | null): string {
  return value ? dayjs(value).format('DD MMM YYYY') : '—'
}

export function formatDateTime(value?: string | Date | null): string {
  return value ? dayjs(value).format('DD MMM YYYY, h:mm A') : '—'
}

export function timeAgo(value?: string | Date | null): string {
  return value ? dayjs(value).fromNow() : '—'
}

export function fullName(lead: { firstName?: string; lastName?: string }): string {
  return [lead.firstName, lead.lastName].filter(Boolean).join(' ') || '—'
}

export function initials(name?: string): string {
  if (!name) return '?'
  return name
    .split(/\s+/)
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase())
    .join('')
}

/** Extracts a friendly message + field errors from an RTK Query error. */
export function parseApiError(err: unknown): { message: string; errors: Record<string, string> } {
  const fallback = { message: 'Something went wrong. Please try again.', errors: {} }
  if (!err || typeof err !== 'object') return fallback
  const e = err as { data?: { message?: string; errors?: Record<string, string> }; error?: string; status?: unknown }
  if (e.data?.message) return { message: e.data.message, errors: e.data.errors ?? {} }
  if (e.status === 'FETCH_ERROR') return { message: 'Cannot reach the server. Check that the backend is running.', errors: {} }
  if (typeof e.error === 'string') return { message: e.error, errors: {} }
  return fallback
}

export function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  a.remove()
  URL.revokeObjectURL(url)
}
