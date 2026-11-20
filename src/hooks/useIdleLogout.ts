import { useEffect, useRef } from 'react'

const EVENTS = ['mousemove', 'mousedown', 'keydown', 'scroll', 'touchstart', 'visibilitychange'] as const
const KEY = 'crm.lastActivity'

// this tab's last activity (storage blocked: the only one), and the calls / dialer lines on in it (useKeepActive)
let lastActivity = Date.now()
let keepers = 0

function touch() {
  lastActivity = Date.now()
  try {
    localStorage.setItem(KEY, String(lastActivity))
  } catch {
    // storage blocked — the in-memory timestamp still works for this tab
  }
}

/**
 * GL-05: idle logout after 30 minutes. The server enforces it too (background
 * polls don't count as activity); this signs the tab out at the same moment
 * instead of on the next click. Activity in any tab of the CRM keeps it alive,
 * and so does a call on (useKeepActive).
 */
export function useIdleLogout(onIdle: () => void, minutes = 30) {
  const callback = useRef(onIdle)
  useEffect(() => {
    callback.current = onIdle
  }, [onIdle])

  useEffect(() => {
    const limit = minutes * 60_000
    touch()
    EVENTS.forEach((e) => window.addEventListener(e, touch, { passive: true }))
    const timer = window.setInterval(() => {
      // a call on is not idle time; the touch also keeps the CRM's other tabs alive
      if (keepers > 0) return touch()
      let shared = lastActivity
      try {
        shared = Math.max(lastActivity, Number(localStorage.getItem(KEY)) || 0)
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

/**
 * Activity while `active` holds (a call ringing or on, the dialer's line open), though nobody touches the mouse
 * or the keys: the idle minutes do not run during it and start over when it ends.
 */
export function useKeepActive(active: boolean) {
  useEffect(() => {
    if (!active) return
    keepers += 1
    touch()
    return () => {
      keepers -= 1
      touch() // it ended: the 30 minutes count from now
    }
  }, [active])
}
