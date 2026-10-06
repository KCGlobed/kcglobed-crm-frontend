import { useEffect } from 'react'
import { useAppDispatch, useCurrentUser } from '../../app/hooks'
import { useMeQuery } from '../../services/authApi'
import { setUser } from './authSlice'

/**
 * Keeps the signed-in user's permissions current while the app is open, so a
 * role/template change by the Super Admin shows up in the menu and buttons
 * within a minute (or as soon as the tab is focused) without signing out.
 * The backend already enforces the new permissions on every request.
 */
export function useSessionSync() {
  const dispatch = useAppDispatch()
  const current = useCurrentUser()
  const { data, refetch } = useMeQuery(undefined, { skip: !current, pollingInterval: 60_000 })

  useEffect(() => {
    if (!current) return
    const onVisible = () => {
      if (document.visibilityState === 'visible') refetch()
    }
    window.addEventListener('focus', onVisible)
    document.addEventListener('visibilitychange', onVisible)
    return () => {
      window.removeEventListener('focus', onVisible)
      document.removeEventListener('visibilitychange', onVisible)
    }
  }, [current, refetch])

  const fresh = data?.data.user
  useEffect(() => {
    if (fresh && current && fresh._id === current._id && JSON.stringify(fresh) !== JSON.stringify(current)) {
      dispatch(setUser(fresh))
    }
  }, [fresh, current, dispatch])
}
