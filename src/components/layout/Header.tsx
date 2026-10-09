import { useLocation } from 'react-router-dom'
import { Menu } from 'lucide-react'
import { useCurrentUser } from '../../app/hooks'
import { NAV_SECTIONS } from '../../constants/navigation'
import { can } from '../../constants/permissions'
import { GlobalSearch } from '../GlobalSearch'
import { NotificationsBell } from './NotificationsBell'
import { ProfileMenu } from './ProfileMenu'
import logoMark from '../../assets/logo-gcc-mark.png'

/** The section the current page belongs to (longest matching nav path). */
function useCurrentSection() {
  const { pathname } = useLocation()
  const items = NAV_SECTIONS.flatMap((s) => s.items.map((i) => ({ ...i, section: s.title })))
  return items
    .filter((i) => pathname === i.path || pathname.startsWith(`${i.path}/`))
    .sort((a, b) => b.path.length - a.path.length)[0]
}

export function Header({ onOpenMenu }: { onOpenMenu: () => void }) {
  const user = useCurrentUser()
  const current = useCurrentSection()

  return (
    <header className="sticky top-0 z-20 flex h-14 shrink-0 items-center gap-3 border-b border-slate-200 bg-white/85 px-3 backdrop-blur-md sm:px-4">
      <button
        type="button"
        className="inline-flex h-9 w-9 items-center justify-center rounded-lg text-slate-500 hover:bg-slate-100 lg:hidden"
        onClick={onOpenMenu}
        aria-label="Open menu"
      >
        <Menu className="h-[18px] w-[18px]" />
      </button>
      {/* the sidebar carries the full logo on desktop; phones get the mark here */}
      <img src={logoMark} alt="GCC School CRM" className="h-7 w-7 shrink-0 lg:hidden" />
      {current && (
        <div className="hidden min-w-0 items-center gap-2 xl:flex xl:w-56">
          <current.icon className="h-4 w-4 shrink-0 text-brand-500" />
          <span className="truncate text-sm font-medium text-slate-700">
            {current.section && <span className="text-slate-400">{current.section} / </span>}
            {current.label}
          </span>
        </div>
      )}
      <div className="flex min-w-0 flex-1 justify-center">{can(user, 'leads') && <GlobalSearch />}</div>
      <div className="flex items-center gap-1">
        <NotificationsBell />
        <div className="mx-1 hidden h-6 w-px bg-slate-200 sm:block" />
        <ProfileMenu />
      </div>
    </header>
  )
}
