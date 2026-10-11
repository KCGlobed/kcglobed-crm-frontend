import { getApps, initializeApp } from 'firebase/app'
import { deleteToken, getMessaging, getToken, isSupported } from 'firebase/messaging'
import { toast } from 'sonner'
import { FIREBASE_CONFIG, FIREBASE_VAPID_KEY, PUSH_SW_PATH } from '../constants/firebase'

/**
 * Browser push (Firebase Cloud Messaging) for this device. The Firebase SDK is
 * used only to obtain the device token; messages themselves arrive through
 * the plain service worker in /public/firebase-messaging-sw.js, which forwards
 * them to the open tab (toast) or shows a system notification.
 */

const TOKEN_KEY = 'crm.push.token'
const PREF_KEY = 'crm.push.enabled'

export type PushState = 'unsupported' | 'default' | 'granted' | 'denied'

/** What the backend puts in a push (apps/notifications/push.py: payload_for). */
export interface PushMessage {
  notificationId?: string
  type?: string
  title?: string
  body?: string
  url?: string
  leadId?: string
  taskId?: string
}

export function pushPermission(): PushState {
  if (typeof window === 'undefined' || !('Notification' in window) || !('serviceWorker' in navigator) || !('PushManager' in window)) {
    return 'unsupported'
  }
  return window.Notification.permission
}

/** The user's choice for this browser: push + toasts + pop-ups on (default) or off. */
export function pushEnabledPreference(): boolean {
  try {
    return localStorage.getItem(PREF_KEY) !== '0'
  } catch {
    return true
  }
}

export function setPushEnabledPreference(on: boolean) {
  try {
    if (on) localStorage.removeItem(PREF_KEY)
    else localStorage.setItem(PREF_KEY, '0')
  } catch {
    // storage blocked — the choice just isn't remembered
  }
}

/** The token this browser registered with the backend, if any. */
export function storedPushToken(): string | null {
  try {
    return localStorage.getItem(TOKEN_KEY)
  } catch {
    return null
  }
}

function remember(token: string | null) {
  try {
    if (token) localStorage.setItem(TOKEN_KEY, token)
    else localStorage.removeItem(TOKEN_KEY)
  } catch {
    // storage blocked — the token is simply fetched again next time
  }
}

async function messagingFor() {
  if (!(await isSupported())) return null
  const app = getApps()[0] ?? initializeApp(FIREBASE_CONFIG)
  return getMessaging(app)
}

export async function requestPushPermission(): Promise<PushState> {
  const state = pushPermission()
  if (state !== 'default') return state
  return window.Notification.requestPermission()
}

/** This browser's device token (creating the push subscription); permission must be granted already. */
export async function currentPushToken(): Promise<string | null> {
  const messaging = await messagingFor()
  if (!messaging) return null
  const registration = await navigator.serviceWorker.register(PUSH_SW_PATH)
  await navigator.serviceWorker.ready
  const token = await getToken(messaging, { vapidKey: FIREBASE_VAPID_KEY, serviceWorkerRegistration: registration })
  remember(token || null)
  return token || null
}

/** Drops the device token locally (sign-out); returns the token so the backend can be told. */
export async function forgetPushToken(): Promise<string | null> {
  const token = storedPushToken()
  remember(null)
  try {
    const messaging = await messagingFor()
    if (messaging) await deleteToken(messaging)
  } catch {
    // nothing to delete, or the push service is unreachable — the backend row is deactivated anyway
  }
  return token
}

/** Messages from the service worker: a push while the tab is open, or a click on a system notification. */
export function onPushMessages(handlers: { message: (m: PushMessage) => void; open: (url: string) => void }): () => void {
  if (typeof navigator === 'undefined' || !('serviceWorker' in navigator)) return () => {}
  const listener = (event: MessageEvent) => {
    const d = event.data
    if (!d || typeof d !== 'object') return
    if (d.type === 'crm-push') handlers.message((d.data ?? {}) as PushMessage)
    else if (d.type === 'crm-push-open' && typeof d.url === 'string') handlers.open(d.url)
  }
  navigator.serviceWorker.addEventListener('message', listener)
  return () => navigator.serviceWorker.removeEventListener('message', listener)
}

/** Toast colour per event, styled in index.css (`.crm-toast-*`): assignment, untouched lead, follow-up, overdue. */
export function toastClassFor(type?: string): string {
  switch (type) {
    case 'lead_assigned':
    case 'lead_reassigned':
      return 'crm-toast crm-toast-assigned'
    case 'untouched':
      return 'crm-toast crm-toast-untouched'
    case 'task_due':
      return 'crm-toast crm-toast-followup'
    case 'task_overdue':
      return 'crm-toast crm-toast-overdue'
    default:
      return 'crm-toast'
  }
}

/**
 * The toast for a notification that reaches an open CRM: title, message and a
 * "View" action, coloured by event. With `persist` it stays until closed or
 * viewed — used when the tab is in the background at the time, so it is
 * waiting when the user returns.
 */
export function showPushToast(m: PushMessage, navigate: (url: string) => void, options: { persist?: boolean } = {}) {
  const url = m.url || '/app/dashboard'
  toast(m.title || 'KcGlobed CRM', {
    id: m.notificationId,
    description: m.body || undefined,
    duration: options.persist ? Infinity : 20_000,
    className: toastClassFor(m.type),
    action: { label: 'View', onClick: () => navigate(url) },
  })
}
