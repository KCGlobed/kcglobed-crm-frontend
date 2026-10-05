import { useEffect } from 'react'
import { BrowserRouter } from 'react-router-dom'
import { Toaster } from 'sonner'
import AppRoutes from './routes/AppRoutes'
import { useAppDispatch } from './app/hooks'
import { useRefreshSessionMutation } from './services/authApi'
import { sessionChecked, setCredentials } from './features/auth/authSlice'

/**
 * The access token lives only in memory; on load we silently exchange the
 * httpOnly refresh cookie for a new one so a page refresh keeps the session.
 */
let bootstrapped = false

function SessionBootstrap() {
  const dispatch = useAppDispatch()
  const [refresh] = useRefreshSessionMutation()

  useEffect(() => {
    // Refresh tokens rotate; a second concurrent call (StrictMode) would look
    // like token reuse and revoke the session.
    if (bootstrapped) return
    bootstrapped = true
    refresh()
      .unwrap()
      .then((res) => dispatch(setCredentials({ user: res.data.user, accessToken: res.data.access_token })))
      .catch(() => dispatch(sessionChecked()))
  }, [dispatch, refresh])

  return null
}

export default function App() {
  return (
    <BrowserRouter>
      <SessionBootstrap />
      <AppRoutes />
      <Toaster position="top-right" richColors closeButton />
    </BrowserRouter>
  )
}
