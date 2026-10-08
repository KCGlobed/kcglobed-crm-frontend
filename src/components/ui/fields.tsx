import { forwardRef, type InputHTMLAttributes, type ReactNode, type SelectHTMLAttributes, type TextareaHTMLAttributes } from 'react'
import { cn } from '../../lib/utils'

/** Shared field look: 36px high, 10px radius, brand focus ring, red when aria-invalid. */
const baseField =
  'w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-800 shadow-sm placeholder:text-slate-400 ' +
  'transition-colors hover:border-slate-400 focus:border-brand-500 focus:outline-none focus:ring-3 focus:ring-brand-100 ' +
  'disabled:cursor-not-allowed disabled:bg-slate-50 disabled:text-slate-500 disabled:hover:border-slate-300 ' +
  'aria-[invalid=true]:border-red-400 aria-[invalid=true]:focus:ring-red-100'

export const Input = forwardRef<HTMLInputElement, InputHTMLAttributes<HTMLInputElement>>(
  ({ className, ...props }, ref) => (
    <input ref={ref} className={cn(baseField, 'h-9', className)} {...props} />
  )
)
Input.displayName = 'Input'

export const Textarea = forwardRef<HTMLTextAreaElement, TextareaHTMLAttributes<HTMLTextAreaElement>>(
  ({ className, ...props }, ref) => (
    <textarea ref={ref} className={cn(baseField, 'min-h-20 leading-relaxed', className)} {...props} />
  )
)
Textarea.displayName = 'Textarea'

export const Select = forwardRef<HTMLSelectElement, SelectHTMLAttributes<HTMLSelectElement>>(
  ({ className, children, ...props }, ref) => (
    <select
      ref={ref}
      className={cn(
        baseField,
        'h-9 cursor-pointer appearance-none bg-[length:16px] bg-[right_0.5rem_center] bg-no-repeat pr-8',
        "bg-[url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='none' stroke='%236b6580' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpath d='m6 9 6 6 6-6'/%3E%3C/svg%3E\")]",
        className
      )}
      {...props}
    >
      {children}
    </select>
  )
)
Select.displayName = 'Select'

export const Checkbox = forwardRef<HTMLInputElement, InputHTMLAttributes<HTMLInputElement>>(
  ({ className, ...props }, ref) => (
    <input
      ref={ref}
      type="checkbox"
      className={cn('h-4 w-4 cursor-pointer rounded border-slate-300 accent-brand-600 focus:ring-brand-500', className)}
      {...props}
    />
  )
)
Checkbox.displayName = 'Checkbox'

/** On/off toggle for a setting that takes effect on save or at once (pass `loading` while it saves). */
export function Switch({
  checked,
  onChange,
  disabled,
  loading,
  label,
  className,
}: {
  checked: boolean
  onChange: (checked: boolean) => void
  disabled?: boolean
  loading?: boolean
  /** accessible name; shown as text when `label` is given */
  label: string
  className?: string
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      aria-busy={loading || undefined}
      disabled={disabled || loading}
      onClick={() => onChange(!checked)}
      className={cn(
        'relative inline-flex h-5 w-9 shrink-0 cursor-pointer items-center rounded-full transition-colors duration-150',
        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500 focus-visible:ring-offset-1',
        'disabled:cursor-not-allowed disabled:opacity-50',
        checked ? 'bg-brand-600' : 'bg-slate-300',
        className
      )}
    >
      <span
        aria-hidden
        className={cn(
          'inline-block h-4 w-4 rounded-full bg-white shadow-sm transition-transform duration-150',
          checked ? 'translate-x-[18px]' : 'translate-x-0.5'
        )}
      />
    </button>
  )
}

interface FormFieldProps {
  label: string
  error?: string
  required?: boolean
  hint?: string
  children: ReactNode
  className?: string
}

export function FormField({ label, error, required, hint, children, className }: FormFieldProps) {
  return (
    <div className={cn('space-y-1.5', className)}>
      <label className="block text-xs font-medium text-slate-700">
        {label}
        {required && <span className="ml-0.5 text-red-500" aria-hidden>*</span>}
      </label>
      {children}
      {hint && !error && <p className="text-[11px] leading-4 text-slate-500">{hint}</p>}
      {error && (
        <p role="alert" className="text-[11px] font-medium leading-4 text-red-600">
          {error}
        </p>
      )}
    </div>
  )
}

/** A titled group of fields inside a form (e.g. "Personal information"). */
export function FieldGroup({ title, description, children, className }: { title: string; description?: string; children: ReactNode; className?: string }) {
  return (
    <fieldset className={cn('min-w-0 space-y-3', className)}>
      <legend className="mb-1 w-full border-b border-slate-200 pb-1.5">
        <span className="text-xs font-semibold uppercase tracking-wide text-slate-500">{title}</span>
        {description && <span className="mt-0.5 block text-[11px] font-normal normal-case tracking-normal text-slate-400">{description}</span>}
      </legend>
      {children}
    </fieldset>
  )
}
