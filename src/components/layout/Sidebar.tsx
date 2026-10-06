import { NavLink } from 'react-router-dom'
import { ChevronsLeft, ChevronsRight, X } from 'lucide-react'
import logo from '../../assets/logo-kcglobed.svg'
import logoMark from '../../assets/logo-kcglobed-mark.svg'
import { useCurrentUser } from '../../app/hooks'
import { NAV_SECTIONS } from '../../constants/navigation'
import { can } from '../../constants/permissions'
import { cn } from '../../lib/utils'

/**
 * Permission-aware navigation. Desktop: full width or collapsed to icons
 * (remembered per browser). Phone/tablet: slide-in drawer.
 */
export function Sidebar({
  mobileOpen,
  onMobileClose,
  collapsed,
  onToggleCollapsed,
}: {
  mobileOpen: boolean
  onMobileClose: () => void
  collapsed: boolean
  onToggleCollapsed: () => void
}) {
  const user = useCurrentUser()
  // the drawer on small screens is always full width
  const mini = collapsed && !mobileOpen

  return (
    <>
      {mobileOpen && <div className="fixed inset-0 z-30 bg-slate-900/50 lg:hidden" onClick={onMobileClose} />}
      <aside
        className={cn(
          'fixed inset-y-0 left-0 z-40 flex flex-col border-r border-slate-200 bg-white transition-[transform,width] duration-200 lg:static lg:translate-x-0',
          mobileOpen ? 'w-64 translate-x-0' : '-translate-x-full',
          mini ? 'lg:w-16' : 'lg:w-60'
        )}
      >
        <div className={cn('flex h-14 shrink-0 items-center gap-2.5 border-b border-slate-200', mini ? 'justify-center px-2' : 'px-4')}>
          {mini ? (
            <img src={logoMark} alt="KcGlobed CRM" className="h-8 w-8 shrink-0" />
          ) : (
            <>
              <img src={logo} alt="KcGlobed" className="h-9 w-auto shrink-0" />
              <span className="rounded-md bg-brand-600 px-1.5 py-0.5 text-[10px] font-bold tracking-wider text-gold-400">CRM</span>
            </>
          )}
          <button
            type="button"
            className="ml-auto rounded-md p-1 text-slate-400 hover:bg-slate-100 lg:hidden"
            onClick={onMobileClose}
            aria-label="Close menu"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <nav className={cn('flex-1 space-y-5 overflow-y-auto py-4', mini ? 'px-2' : 'px-3')} aria-label="Main">
          {NAV_SECTIONS.map((section, i) => {
            const items = section.items.filter(
              (item) => can(user, item.module, item.action) && (!item.superAdminOnly || user?.isSuperAdmin)
            )
            if (!items.length) return null
            return (
              <div key={i}>
                {section.title &&
                  (mini ? (
                    <div className="mx-2 mb-2 border-t border-slate-200" />
                  ) : (
                    <p className="px-2.5 pb-1.5 text-[10px] font-semibold uppercase tracking-wider text-slate-400">{section.title}</p>
                  ))}
                <div className="space-y-0.5">
                  {items.map((item) => (
                    <NavLink
                      key={item.path}
                      to={item.path}
                      onClick={onMobileClose}
                      title={mini ? item.label : undefined}
                      className={({ isActive }) =>
                        cn(
                          'group relative flex items-center gap-2.5 rounded-lg py-2 text-[13px] font-medium transition-colors',
                          mini ? 'justify-center px-0' : 'px-2.5',
                          isActive
                            ? 'bg-brand-600 text-white shadow-sm before:absolute before:inset-y-1.5 before:-left-3 before:w-[3px] before:rounded-r before:bg-gold-400'
                            : 'text-slate-600 hover:bg-brand-50 hover:text-brand-700'
                        )
                      }
                    >
                      {({ isActive }) => (
                        <>
                          <item.icon className={cn('h-[18px] w-[18px] shrink-0', isActive ? 'text-gold-400' : 'text-slate-400 group-hover:text-brand-600')} />
                          {!mini && <span className="truncate">{item.label}</span>}
                        </>
                      )}
                    </NavLink>
                  ))}
                </div>
              </div>
            )
          })}
        </nav>

        <div className="hidden shrink-0 border-t border-slate-200 p-2 lg:block">
          <button
            type="button"
            onClick={onToggleCollapsed}
            aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
            title={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
            className={cn(
              'flex w-full items-center gap-2 rounded-lg px-2.5 py-2 text-xs font-medium text-slate-500 transition-colors hover:bg-brand-50 hover:text-brand-700',
              collapsed && 'justify-center px-0'
            )}
          >
            {collapsed ? <ChevronsRight className="h-4 w-4" /> : <ChevronsLeft className="h-4 w-4" />}
            {!collapsed && 'Collapse'}
          </button>
        </div>
      </aside>
    </>
  )
}
