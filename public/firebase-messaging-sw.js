/*
 * KcGlobed CRM push service worker.
 *
 * The backend sends data-only messages through Firebase Cloud Messaging, so
 * this worker decides how each one is shown: while a CRM tab is visible the
 * message is handed to that tab (a toast with a "View" action); otherwise a
 * system notification is shown, and a click on it focuses or opens the CRM at
 * the notification's link. Registered by src/lib/push.ts.
 */
const DEFAULT_URL = '/app/dashboard'

self.addEventListener('install', () => self.skipWaiting())
self.addEventListener('activate', (event) => event.waitUntil(self.clients.claim()))

function messageData(event) {
  if (!event.data) return {}
  try {
    const payload = event.data.json() || {}
    const data = payload.data || {}
    const notification = payload.notification || {}
    return { ...data, title: data.title || notification.title, body: data.body || notification.body }
  } catch {
    return { title: 'KcGlobed CRM', body: event.data.text() }
  }
}

self.addEventListener('push', (event) => {
  const data = messageData(event)
  event.waitUntil(
    (async () => {
      const windows = await self.clients.matchAll({ type: 'window', includeUncontrolled: true })
      const visible = windows.find((client) => client.visibilityState === 'visible')
      if (visible) {
        visible.postMessage({ type: 'crm-push', data })
        return
      }
      await self.registration.showNotification(data.title || 'KcGlobed CRM', {
        body: data.body || '',
        icon: '/favicon.png',
        badge: '/favicon.png',
        tag: data.notificationId || undefined,
        data,
      })
    })()
  )
})

self.addEventListener('notificationclick', (event) => {
  event.notification.close()
  const url = (event.notification.data && event.notification.data.url) || DEFAULT_URL
  event.waitUntil(
    (async () => {
      const windows = await self.clients.matchAll({ type: 'window', includeUncontrolled: true })
      const client = windows[0]
      if (client) {
        client.postMessage({ type: 'crm-push-open', url })
        if ('focus' in client) await client.focus()
        return
      }
      await self.clients.openWindow(url)
    })()
  )
})
