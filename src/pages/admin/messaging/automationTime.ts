/** A wait or a window typed as amount + unit, stored in minutes (the Automation form and the counsellor alerts). */
export const DELAY_UNITS = [
  { value: 1, label: 'minutes' },
  { value: 60, label: 'hours' },
  { value: 1440, label: 'days' },
]

export function splitDelay(minutes: number): { amount: number; unit: number } {
  if (minutes > 0 && minutes % 1440 === 0) return { amount: minutes / 1440, unit: 1440 }
  if (minutes > 0 && minutes % 60 === 0) return { amount: minutes / 60, unit: 60 }
  return { amount: minutes, unit: 1 }
}

export const joinDelay = (amount: number, unit: number) => Math.max(0, Math.round(Number(amount) || 0)) * unit
