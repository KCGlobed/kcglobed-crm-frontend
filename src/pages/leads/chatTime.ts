/** "Today" / "Yesterday" / a short date: the day separators of the message threads on the lead page. */
export function dayLabel(iso: string): string {
  const d = new Date(iso)
  const today = new Date()
  const yesterday = new Date()
  yesterday.setDate(today.getDate() - 1)
  const same = (a: Date, b: Date) => a.toDateString() === b.toDateString()
  if (same(d, today)) return 'Today'
  if (same(d, yesterday)) return 'Yesterday'
  return d.toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' })
}

/** A chat list's time: the clock today, "Yesterday", the weekday within a week, else a short date (as WhatsApp). */
export function listTimeLabel(iso: string): string {
  const d = new Date(iso)
  const label = dayLabel(iso)
  if (label === 'Today') return timeOf(iso)
  if (label === 'Yesterday') return label
  const days = (Date.now() - d.getTime()) / 86_400_000
  if (days < 7) return d.toLocaleDateString(undefined, { weekday: 'short' })
  return d.toLocaleDateString(undefined, { day: 'numeric', month: 'short' })
}

export const timeOf = (iso: string) => new Date(iso).toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' })
