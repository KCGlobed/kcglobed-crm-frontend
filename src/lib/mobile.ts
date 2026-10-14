import type { ChangeEvent } from 'react'
import type { UseFormRegisterReturn } from 'react-hook-form'

/**
 * What a mobile input keeps as the user types or pastes: digits only, a pasted
 * +91 / 91 / leading-0 prefix dropped, and nothing past the tenth digit.
 */
export function mobileDigits(value: string): string {
  let d = value.replace(/\D/g, '')
  if (d.length === 12 && d.startsWith('91')) d = d.slice(2)
  else if (d.length === 11 && d.startsWith('0')) d = d.slice(1)
  return d.slice(0, 10)
}

/**
 * Props for a react-hook-form registered mobile input: the numeric keypad on phones,
 * and the value tidied by `mobileDigits` in the box before the form reads it, so an
 * eleventh digit or a letter never appears. Spread it last so nothing overrides onChange.
 */
export function mobileField<N extends string>(field: UseFormRegisterReturn<N>) {
  return {
    ...field,
    inputMode: 'numeric' as const,
    onChange: (e: ChangeEvent<HTMLInputElement>) => {
      e.target.value = mobileDigits(e.target.value)
      return field.onChange(e)
    },
  }
}
