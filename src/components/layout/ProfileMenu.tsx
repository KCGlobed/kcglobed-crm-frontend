import { useCallback, useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { ChevronDown, KeyRound, LogOut } from 'lucide-react'
import { toast } from 'sonner'
import { useAppDispatch, useCurrentUser } from '../../app/hooks'
import { setUser, signedOut } from '../../features/auth/authSlice'
import { useLogoutMutation, useSetMyAlertsMutation } from '../../services/authApi'
import { useUnsubscribePushMutation } from '../../services/miscApi'
import { forgetPushToken } from '../../lib/push'
import { api } from '../../services/api'
import { useIdleLogout } from '../../hooks/useIdleLogout'
import { cn, initials, parseApiError } from '../../lib/utils'
import { ALERT_CHANNELS } from '../../constants/alertChannels'
import { AlertSwitches } from '../ui/AlertSwitches'
import type { MyAlerts } from '../../types/models'
import { PunchBreakPanel } from './PunchBreak'

function useSignOut() {
  const dispatch = useAppDispatch()
  const navigate = useNavigate()
  const [logout] = useLogoutMutation()
  const [unsubscribePush] = useUnsubscribePushMutation()
  return useCallback(
    async (message: string, kind: 'success' | 'info' = 'success') => {
      try {
        // this browser stops receiving the signed-out user's pushes
        const token = await forgetPushToken()
        if (token) await unsubscribePush({ token }).unwrap()
      } catch {
        // best effort — the backend drops unregistered tokens on the next failed send
      }
      try {
        await logout().unwrap()
      } catch {
        // Already signed out server-side — proceed regardless.
      }
      dispatch(signedOut())
      dispatch(api.util.resetApiState())
      toast[kind](message)
      navigate('/login')
    },
    [dispatch, logout, navigate, unsubscribePush]
  )
}

/** A Super Admin's own alert channels: off = none of that channel's alerts reach them; the bell still lists them. */
function MyAlertsPanel({ alerts }: { alerts: MyAlerts }) {
  const dispatch = useAppDispatch()
  const [save] = useSetMyAlertsMutation()
  const [pending, setPending] = useState<keyof MyAlerts | null>(null)

  const onToggle = async (key: keyof MyAlerts, label: string, on: boolean) => {
    setPending(key)
    try {
      const res = await save({ [key]: on }).unwrap()
      dispatch(setUser(res.data.user))
      toast.success(`${label} alerts ${on ? 'on' : 'off'}`)
    } catch (err) {
      toast.error(parseApiError(err).message)
    } finally {
      setPending(null)
    }
  }

  const off = ALERT_CHANNELS.filter((c) => !alerts[c.key]).length

  return (
    <div className="border-b border-slate-100 px-3 py-3" data-testid="my-alerts">
      <div className="mb-2 flex items-center justify-between px-1">
        <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-400">My alerts</p>
        <span
          className={cn(
            'rounded-full px-1.5 py-0.5 text-[10px] font-semibold ring-1 ring-inset',
            off ? 'bg-amber-50 text-amber-700 ring-amber-200' : 'bg-emerald-50 text-emerald-700 ring-emerald-200'
          )}
        >
          {off ? `${off} off` : 'All on'}
        </span>
      </div>
      <AlertSwitches value={alerts} onToggle={onToggle} pending={pending} />
    </div>
  )
}

export function ProfileMenu() {
  const [open, setOpen] = useState(false)
  const user = useCurrentUser()
  const navigate = useNavigate()
  const signOut = useSignOut()
  // GL-05: 30 minutes without activity signs the user out
  const onIdle = useCallback(() => signOut('Signed out after 30 minutes of inactivity', 'info'), [signOut])
  useIdleLogout(onIdle)

  const role = user?.isSuperAdmin ? 'Super Admin' : user?.roleLabel && user.role !== 'other' ? user.roleLabel : user?.designation || 'User'

  // Close on a click anywhere outside the button and its menu, or on Escape — as the bell does. (A full-screen
  // backdrop element would not work here: the blurred top bar becomes the frame of anything `fixed` inside it, so
  // such a backdrop covers only the bar and clicks on the page never reach it.)
  const ref = useRef<HTMLDivElement>(null)
  useEffect(() => {
    if (!open) return
    const onClick = (e: MouseEvent) => !ref.current?.contains(e.target as Node) && setOpen(false)
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setOpen(false)
    document.addEventListener('mousedown', onClick)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('mousedown', onClick)
      document.removeEventListener('keydown', onKey)
    }
  }, [open])

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-haspopup="menu"
        aria-expanded={open}
        className="flex items-center gap-2 rounded-lg py-1 pl-1 pr-2 transition-colors hover:bg-slate-100"
      >
        <span className="flex h-8 w-8 items-center justify-center rounded-full bg-linear-to-br from-brand-500 to-brand-700 text-[11px] font-semibold text-white ring-2 ring-gold-300">
          {initials(user?.name)}
        </span>
        <span className="hidden text-left md:block">
          <span className="block max-w-36 truncate text-xs font-semibold text-slate-700">{user?.name}</span>
          <span className="block max-w-36 truncate text-[10px] text-slate-500">{role}</span>
        </span>
        <ChevronDown className="hidden h-3.5 w-3.5 text-slate-400 md:block" />
      </button>
      {open && (
        <>
          <div
            role="menu"
            className={cn(
              'absolute right-0 z-40 mt-1.5 origin-top-right animate-pop-in overflow-hidden rounded-xl border border-slate-200 bg-white shadow-[var(--shadow-md)]',
              user?.isSuperAdmin ? 'w-60' : 'w-72'
            )}
          >
            <div className="border-b border-slate-100 px-4 py-3">
              <p className="truncate text-sm font-semibold text-slate-800">{user?.name}</p>
              <p className="truncate text-xs text-slate-500">{user?.email}</p>
              <span className="mt-1.5 inline-block rounded-md bg-brand-50 px-1.5 py-0.5 text-[10px] font-medium text-brand-700">{role}</span>
            </div>
            {user?.isSuperAdmin && user.alerts && <MyAlertsPanel alerts={user.alerts} />}
            {/* Super Admin is not part of attendance */}
            {!user?.isSuperAdmin && (
              <div className="border-b border-slate-100">
                <PunchBreakPanel onDone={() => setOpen(false)} />
              </div>
            )}
            <div className="py-1">
              <button
                type="button"
                role="menuitem"
                onClick={() => {
                  navigate('/app/profile')
                  setOpen(false)
                }}
                className="flex w-full items-center gap-2 px-4 py-2 text-xs font-medium text-slate-700 hover:bg-slate-50"
              >
                <KeyRound className="h-3.5 w-3.5 text-slate-400" /> Change Password
              </button>
              <button
                type="button"
                role="menuitem"
                onClick={() => signOut('Signed out')}
                className="flex w-full items-center gap-2 px-4 py-2 text-xs font-medium text-red-600 hover:bg-red-50"
              >
                <LogOut className="h-3.5 w-3.5" /> Sign Out
              </button>
            </div>
          </div>
        </>
      )}
    </div>
  )
}
