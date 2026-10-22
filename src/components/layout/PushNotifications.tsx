import { useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAppDispatch, useCurrentUser } from '../../app/hooks'
import { api } from '../../services/api'
import { useSubscribePushMutation } from '../../services/miscApi'
import { currentPushToken, onPushMessages, pushEnabledPreference, pushPermission, showPushToast, type PushMessage } from '../../lib/push'

/**
 * Keeps this browser registered for push while someone is signed in (once
 * they granted permission from the bell), and turns pushes that arrive while
 * the CRM tab is open into a toast with a "View" action. A click on a system
 * notification (tab in the background) lands here too and opens its link.
 */
export function PushNotifications() {
  const user = useCurrentUser()
  const userId = user?._id
  const navigate = useNavigate()
  const dispatch = useAppDispatch()
  const [subscribe] = useSubscribePushMutation()

  useEffect(() => {
    if (!userId) return
    let cancelled = false
    const arrived = (m: PushMessage) => {
      if (m.type === 'incoming_call') {
        // the dialer popover shows who is calling; the push only makes the live feed refresh at once
        dispatch(api.util.invalidateTags(['LiveCalls', 'Notifications']))
        return
      }
      showPushToast(m, navigate)
      dispatch(api.util.invalidateTags(['Notifications'])) // the bell count catches up at once
    }
    if (pushPermission() === 'granted' && pushEnabledPreference()) {
      currentPushToken()
        .then((token) => {
          if (token && !cancelled) subscribe({ token, platform: 'web' })
        })
        .catch((err) => console.warn('[push] device registration failed', err))
    }
    const stop = onPushMessages({ message: arrived, open: (url) => navigate(url) })
    const testable = window as Window & { __crmPush?: (m: PushMessage) => void }
    if (import.meta.env.DEV) testable.__crmPush = arrived // dev only: lets a test simulate an incoming push
    return () => {
      cancelled = true
      stop()
      delete testable.__crmPush
    }
  }, [userId, navigate, dispatch, subscribe])

  return null
}
