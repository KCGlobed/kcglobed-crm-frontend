import { useEffect, useRef } from 'react'

const EVENTS = ['mousemove', 'mousedown', 'keydown', 'scroll', 'touchstart', 'visibilitychange'] as const

/**
 * GL-05: idle logout after 30 minutes. The server enforces it too (background
 * polls don't count as activity); this signs the tab out at the same moment
 * instead of on the next click. Activity in any tab of the CRM keeps it alive.
 */
export function useIdleLogout(onIdle: () => void, minutes = 30) {
  const callback = useRef(onIdle)
  useEffect(() => {
    callback.current = onIdle
  }, [onIdle])

  useEffect(() => {
    const key = 'crm.lastActivity'
    const limit = minutes * 60_000
    const touch = () => {
      try {
        localStorage.setItem(key, String(Date.now()))
      } catch {
        // storage blocked — the in-memory timestamp below still works for this tab
      }
      last = Date.now()
    }
    let last = Date.now()
    touch()
    EVENTS.forEach((e) => window.addEventListener(e, touch, { passive: true }))
    const timer = window.setInterval(() => {
      let shared = last
      try {
        shared = Math.max(last, Number(localStorage.getItem(key)) || 0)
      } catch {
        // ignore
      }
      if (Date.now() - shared > limit) callback.current()
    }, 30_000)
    return () => {
      EVENTS.forEach((e) => window.removeEventListener(e, touch))
      window.clearInterval(timer)
    }
  }, [minutes])
}
