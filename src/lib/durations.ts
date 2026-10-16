import { useEffect, useState } from 'react'

/** Seconds as HH:MM:SS ("07:32:15", "00:00:45"): every duration on screen, so no seconds go missing. */
export function formatHms(seconds?: number | null): string {
  const total = Math.max(0, Math.floor(seconds ?? 0))
  const hh = String(Math.floor(total / 3600)).padStart(2, '0')
  const mm = String(Math.floor((total % 3600) / 60)).padStart(2, '0')
  const ss = String(total % 60).padStart(2, '0')
  return `${hh}:${mm}:${ss}`
}

/** Seconds from an ISO time until `now` (ms). */
export const secondsSince = (iso: string, now: number) => Math.max(0, Math.floor((now - Date.parse(iso)) / 1000))

/** The current time, re-read every `everyMs` while `enabled`: drives live timers. */
export function useNow(everyMs: number, enabled = true): number {
  const [now, setNow] = useState(() => Date.now())
  useEffect(() => {
    if (!enabled) return
    const id = window.setInterval(() => setNow(Date.now()), everyMs)
    return () => window.clearInterval(id)
  }, [everyMs, enabled])
  return now
}
