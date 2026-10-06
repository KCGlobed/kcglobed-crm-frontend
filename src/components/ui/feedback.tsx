import { useEffect, type ReactNode } from 'react'
import { AlertTriangle, Inbox, Loader2, RefreshCw, type LucideIcon } from 'lucide-react'
import { Button } from './Button'
import { Modal } from './Modal'
import { cn } from '../../lib/utils'

export function Spinner({ className }: { className?: string }) {
  return <Loader2 className={cn('h-5 w-5 animate-spin text-brand-600', className)} aria-label="Loading" />
}

export function Skeleton({ className }: { className?: string }) {
  return <div className={cn('animate-pulse rounded-md bg-slate-200/80', className)} />
}

/** Full-area loading placeholder (a page or panel waiting for its first data). */
export function LoadingState({ label = 'Loading…', className }: { label?: string; className?: string }) {
  return (
    <div className={cn('flex flex-col items-center justify-center gap-2 py-16 text-xs text-slate-500', className)}>
      <Spinner className="h-6 w-6" />
      {label}
    </div>
  )
}

export function EmptyState({
  title = 'Nothing here yet',
  description,
  action,
  icon: Icon = Inbox,
  className,
}: {
  title?: string
  description?: string
  action?: ReactNode
  icon?: LucideIcon
  className?: string
}) {
  return (
    <div className={cn('flex flex-col items-center justify-center gap-2 px-6 py-14 text-center', className)}>
      <div className="mb-1 rounded-full bg-slate-100 p-3 ring-8 ring-slate-50">
        <Icon className="h-6 w-6 text-slate-400" />
      </div>
      <p className="text-sm font-semibold text-slate-700">{title}</p>
      {description && <p className="max-w-sm text-xs leading-5 text-slate-500">{description}</p>}
      {action && <div className="mt-2">{action}</div>}
    </div>
  )
}

/**
 * Friendly error with retry. The server's message is shown when it is a
 * readable sentence (e.g. "This lead is no longer assigned to you"); the raw
 * error always goes to the console for developers.
 */
export function ErrorState({
  title = 'Something went wrong',
  message = "We couldn't load the data. Please try again.",
  onRetry,
  error,
}: {
  title?: string
  message?: string
  onRetry?: () => void
  error?: unknown
}) {
  useEffect(() => {
    if (error) console.error('[CRM] load failed', error)
  }, [error])
  return (
    <div role="alert" className="flex flex-col items-center justify-center gap-2 px-6 py-14 text-center">
      <div className="mb-1 rounded-full bg-red-50 p-3 ring-8 ring-red-50/50">
        <AlertTriangle className="h-6 w-6 text-red-500" />
      </div>
      <p className="text-sm font-semibold text-slate-700">{title}</p>
      <p className="max-w-md text-xs leading-5 text-slate-500">{message}</p>
      {onRetry && (
        <Button variant="outline" size="sm" onClick={onRetry} className="mt-2">
          <RefreshCw className="h-3.5 w-3.5" /> Try again
        </Button>
      )}
    </div>
  )
}

interface ConfirmDialogProps {
  open: boolean
  onClose: () => void
  onConfirm: () => void
  title: string
  message: string
  confirmLabel?: string
  danger?: boolean
  loading?: boolean
}

export function ConfirmDialog({
  open,
  onClose,
  onConfirm,
  title,
  message,
  confirmLabel = 'Confirm',
  danger,
  loading,
}: ConfirmDialogProps) {
  return (
    <Modal
      open={open}
      onClose={onClose}
      title={title}
      size="sm"
      footer={
        <>
          <Button variant="outline" onClick={onClose} disabled={loading}>
            Cancel
          </Button>
          <Button variant={danger ? 'danger' : 'primary'} onClick={onConfirm} loading={loading}>
            {confirmLabel}
          </Button>
        </>
      }
    >
      <div className="flex gap-3">
        {danger && (
          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-red-50">
            <AlertTriangle className="h-4 w-4 text-red-500" />
          </span>
        )}
        <p className="text-sm leading-6 text-slate-600">{message}</p>
      </div>
    </Modal>
  )
}
