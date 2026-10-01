import React, { useState, useEffect } from 'react';
import { useLocation, useNavigate, Link } from 'react-router-dom';
import {
  ChevronDown,
  ChevronLeft,
  ChevronUp,
  LogOut,
  User as UserIcon,
  X,
} from 'lucide-react';
import { useAppDispatch } from '../../hooks/useAppDispatch';
import { useAppSelector } from '../../hooks/useRedux';
import { logoutDevice } from '../../store/slices/authSlice';
import { resolveMenuPath } from '../../store/slices/menuSlice';
import { getMenuIcon } from '../../utils/menuIcons';
import type { MenuItem } from '../../utils/types';

interface SidebarProps {
  activePage?: string;
  onSelectPage?: (page: string) => void;
  isCollapsed: boolean;
  onToggleCollapse: () => void;
  isMobileOpen?: boolean;
  onCloseMobile?: () => void;
}

export const Sidebar: React.FC<SidebarProps> = ({
  onSelectPage,
  isCollapsed,
  onToggleCollapse,
  isMobileOpen = false,
  onCloseMobile,
}) => {
  const dispatch = useAppDispatch();
  const navigate = useNavigate();
  const location = useLocation();

  const { user, access } = useAppSelector((state) => state.auth);
  const { data: menuItems, loading: menuLoading, error: menuError } = useAppSelector(
    (state) => state.menu
  );

  // Submenu accordion & user profile dropdown states (Instalearn pattern)
  const [openSubmenu, setOpenSubmenu] = useState<string | null>(null);
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);

  const fullNameFromParts = [user?.first_name, user?.last_name].filter(Boolean).join(' ');
  const displayName: string =
    user?.full_name ||
    user?.name ||
    fullNameFromParts ||
    user?.email ||
    'Super Admin';
  const displayRole: string =
    user?.role_name ||
    user?.role?.name ||
    (user?.is_superadmin || user?.is_admin ? 'Super Admin' : 'Staff');
  const userInitials =
    displayName
      .split(' ')
      .filter(Boolean)
      .map((n: string) => n[0])
      .join('')
      .substring(0, 2)
      .toUpperCase() || 'SA';

  const toggleSubmenu = (code: string) => {
    if (isCollapsed) {
      onToggleCollapse(); // expand sidebar if collapsed so user can see submenu
    }
    setOpenSubmenu(openSubmenu === code ? null : code);
  };

  const handleNavClick = (code: string, path?: string) => {
    if (onSelectPage) {
      onSelectPage(code);
    }
    navigate(path || `/${code}`);
    onCloseMobile?.();
  };

  const handleLogout = () => {
    dispatch(logoutDevice());
    navigate('/login');
    onCloseMobile?.();
  };

  // The menu API is the single source of truth; only view=true items render
  // (Super Admin sees everything the API returned). Items whose path is "/"
  // are permission flags without a screen (e.g. "Assign leads") — hide them.
  const filterVisible = (items: MenuItem[]): MenuItem[] =>
    (items || [])
      .filter((item) => access?.full_access || item.permissions?.view === true)
      .map((item) => ({
        ...item,
        children: item.children ? filterVisible(item.children) : [],
      }))
      .filter((item) => {
        if (item.children && item.children.length > 0) return true;
        const path = resolveMenuPath(item);
        return !!path && path !== '/';
      });

  // The menu API can return a module twice: nested under its parent AND as a
  // separate top-level row — sometimes with a different code but the same
  // path. Render each module exactly once, keyed on BOTH code and path.
  const normalizeTree = (items: MenuItem[]): MenuItem[] => {
    const childCodes = new Set<string>();
    const childPaths = new Set<string>();
    const collect = (list: MenuItem[]) =>
      list.forEach((item) => {
        (item.children || []).forEach((child) => {
          if (child.code) childCodes.add(child.code);
          const childPath = resolveMenuPath(child);
          if (childPath) childPaths.add(childPath);
        });
        collect(item.children || []);
      });
    collect(items || []);

    const dedupe = (list: MenuItem[]): MenuItem[] => {
      const seenCodes = new Set<string>();
      const seenPaths = new Set<string>();
      return list
        .filter((item) => {
          const code = item.code ?? item.name ?? '';
          const path = resolveMenuPath(item);
          if (seenCodes.has(code)) return false;
          if (path && seenPaths.has(path)) return false;
          seenCodes.add(code);
          if (path) seenPaths.add(path);
          return true;
        })
        .map((item) => ({ ...item, children: dedupe(item.children || []) }));
    };

    // Drop top-level rows that already appear as someone's child (same code
    // OR same destination path), then drop repeats at every level.
    return dedupe(
      (items || []).filter((item) => {
        if (item.code && childCodes.has(item.code)) return false;
        const path = resolveMenuPath(item);
        const hasChildren = !!item.children && item.children.length > 0;
        if (!hasChildren && path && childPaths.has(path)) return false;
        return true;
      })
    );
  };

  const navItems = filterVisible(normalizeTree(menuItems));

  const isPathActive = (item: MenuItem): boolean => {
    const path = resolveMenuPath(item);
    return !!path && (location.pathname === path || location.pathname.startsWith(`${path}/`));
  };

  const isTreeActive = (item: MenuItem): boolean =>
    isPathActive(item) || !!item.children?.some((child) => isTreeActive(child));

  // Auto-expand submenu if current path matches any of its children
  useEffect(() => {
    navItems.forEach((item) => {
      if (item.children && item.children.length > 0 && isTreeActive(item)) {
        setOpenSubmenu(item.code ?? null);
      }
    });
  }, [location.pathname, menuItems]);

  // Recursive renderer for nested children (accordion body)
  const renderChildren = (items: MenuItem[], depth = 0) => (
    <div
      className={`mt-1 mb-2 flex flex-col space-y-1 border-l-2 border-crmBorder pl-2.5 ${depth === 0 ? 'ml-6' : 'ml-3'}`}
    >
      {items.map((child) => {
        const childPath = resolveMenuPath(child);
        const isChildActive = isPathActive(child);
        return (
          <React.Fragment key={child.code ?? child.name}>
            <Link
              to={childPath || '#'}
              onClick={() => handleNavClick(child.code ?? '', childPath)}
              className={`flex items-center justify-between rounded-lg p-2 text-xs font-medium transition-colors ${isChildActive
                ? 'bg-minor text-white font-semibold shadow-sm'
                : 'text-crmText-secondary hover:bg-minor-soft hover:text-minor-contrast'
                }`}
            >
              <span className="truncate capitalize">{child.name}</span>
            </Link>
            {child.children && child.children.length > 0 && renderChildren(child.children, depth + 1)}
          </React.Fragment>
        );
      })}
    </div>
  );

  return (
    <>
      {/* Drawer backdrop (mobile / tablet) */}
      {isMobileOpen && (
        <div
          className="animate-fade-in fixed inset-0 z-40 bg-black/50 backdrop-blur-[2px] lg:hidden"
          onClick={onCloseMobile}
          aria-hidden="true"
        />
      )}

      <aside
        className={`fixed inset-y-0 left-0 z-50 flex shrink-0 flex-col justify-between border-r border-crmBorder bg-major transition-[transform,width] duration-300 lg:static lg:translate-x-0 ${isMobileOpen ? 'translate-x-0' : '-translate-x-full'
          } ${isCollapsed ? 'lg:w-[82px]' : 'lg:w-[270px]'} w-[270px]`}
      >
        {/* Brand Header */}
        <div
          className={`flex min-h-[64px] items-center justify-between gap-3 border-b border-crmBorder ${isCollapsed ? 'lg:flex-col lg:justify-center lg:p-4' : ''
            } px-5 py-3.5`}
        >
          <div
            className="flex cursor-pointer select-none items-center gap-3 overflow-hidden whitespace-nowrap border-none bg-transparent p-0 text-inherit no-underline outline-none transition-opacity hover:opacity-90"
            onClick={() => handleNavClick('dashboard', '/dashboard')}
            role="button"
            tabIndex={0}
            title="KC Globed CRM - Go to Dashboard"
          >
            <div className="flex h-[34px] w-[34px] min-w-[34px] shrink-0 items-center justify-center rounded-[10px] bg-gradient-to-br from-minor to-minor-hover text-sm font-extrabold text-white shadow-crm-accent">
              KC
            </div>
            <div className={`flex items-baseline gap-1.5 font-outfit leading-none ${isCollapsed ? 'lg:hidden' : ''}`}>
              <span className="text-[1.1rem] font-bold tracking-tight text-crmText">KC Globed</span>
              <span className="text-[1.1rem] font-extrabold tracking-tight text-secondary">CRM</span>
            </div>
          </div>

          {/* Desktop Collapse / Expand Toggle Button */}
          <button
            type="button"
            className="hidden h-[30px] w-[30px] min-w-[30px] shrink-0 cursor-pointer items-center justify-center rounded-lg border border-crmBorder bg-major-tint text-crmText-secondary transition-all hover:border-minor/30 hover:bg-minor-soft hover:text-minor-contrast lg:flex"
            onClick={onToggleCollapse}
            title={isCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}
            aria-label={isCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}
          >
            <ChevronLeft
              size={16}
              strokeWidth={2.5}
              className={`transition-transform duration-200 ${isCollapsed ? 'rotate-180' : 'rotate-0'}`}
            />
          </button>

          {/* Close (mobile) */}
          <button
            type="button"
            className="flex h-[30px] w-[30px] min-w-[30px] shrink-0 cursor-pointer items-center justify-center rounded-lg border border-crmBorder bg-major-tint text-crmText-secondary transition-all hover:border-crmDanger/30 hover:bg-crmDanger-bg hover:text-crmDanger lg:hidden"
            onClick={onCloseMobile}
            aria-label="Close navigation menu"
          >
            <X size={16} strokeWidth={2.5} />
          </button>
        </div>

        {/* Navigation Menu (Scrollable) */}
        <div className="flex flex-1 flex-col gap-1 overflow-y-auto p-3 sidebar-scroll">
          <div
            className={`whitespace-nowrap px-3 py-2 text-[0.7rem] font-bold uppercase tracking-wider text-crmText-tertiary ${isCollapsed ? 'lg:hidden' : ''
              }`}
          >
            Core Modules
          </div>

          <nav className="flex flex-col space-y-1">
            {menuLoading ? (
              // Skeleton rows while the menu loads
              [1, 2, 3, 4].map((i) => (
                <div key={i} className="flex items-center gap-3.5 rounded-xl px-3.5 py-2.5">
                  <div className="h-5 w-5 shrink-0 animate-pulse rounded-md bg-major-tint" />
                  <div className={`h-3.5 flex-1 animate-pulse rounded-md bg-major-tint ${isCollapsed ? 'lg:hidden' : ''}`} />
                </div>
              ))
            ) : navItems.length === 0 ? (
              // No hardcoded fallback menus — the API is the only source
              <div className={`px-3.5 py-2.5 text-xs text-crmText-tertiary italic ${isCollapsed ? 'lg:hidden' : ''}`}>
                {menuError ? 'Menu unavailable' : 'No modules assigned'}
              </div>
            ) : (
              navItems.map((item) => {
                const code = item.code ?? '';
                const itemPath = resolveMenuPath(item);
                const hasSubmenu = !!item.children && item.children.length > 0;
                const isActive = isTreeActive(item);
                const isSubOpen = openSubmenu === code;

                return (
                  <div key={code || item.name}>
                    {hasSubmenu ? (
                      <>
                        {/* Parent Item with Accordion Toggle */}
                        <button
                          type="button"
                          onClick={() => toggleSubmenu(code)}
                          className={`flex w-full cursor-pointer items-center justify-between rounded-xl px-3.5 py-2.5 text-left font-sans text-sm font-semibold transition-all ${isActive
                            ? 'bg-minor-soft text-minor-contrast'
                            : 'bg-transparent text-crmText-secondary hover:bg-minor-soft hover:text-minor-contrast'
                            } ${isCollapsed ? 'lg:justify-center lg:px-0' : ''}`}
                          title={isCollapsed ? item.name : undefined}
                        >
                          <div className="flex items-center gap-3.5 min-w-0">
                            <span className="flex h-5 w-5 shrink-0 items-center justify-center">
                              {getMenuIcon(item.icon)}
                            </span>
                            <span className={`truncate text-sm ${isCollapsed ? 'lg:hidden' : ''}`}>
                              {item.name}
                            </span>
                          </div>

                          {!isCollapsed && (
                            <div className="ml-auto flex items-center gap-1.5 pl-2 shrink-0">
                              {isSubOpen ? (
                                <ChevronUp size={14} className="text-crmText-tertiary" />
                              ) : (
                                <ChevronDown size={14} className="text-crmText-tertiary" />
                              )}
                            </div>
                          )}
                        </button>

                        {/* Accordion Submenu Items (recursive for nested children) */}
                        {!isCollapsed && isSubOpen && renderChildren(item.children ?? [])}
                      </>
                    ) : (
                      /* Regular Single Link Item */
                      <button
                        type="button"
                        className={`flex w-full cursor-pointer items-center justify-between rounded-xl px-3.5 py-2.5 text-left font-sans text-sm font-semibold transition-all ${isActive
                          ? 'bg-minor text-white shadow-crm-accent'
                          : 'bg-transparent text-crmText-secondary hover:bg-minor-soft hover:text-minor-contrast'
                          } ${isCollapsed ? 'lg:justify-center lg:px-0' : ''}`}
                        onClick={() => handleNavClick(code, itemPath)}
                        title={isCollapsed ? item.name : undefined}
                        aria-current={isActive ? 'page' : undefined}
                      >
                        <div className="flex items-center gap-3.5 min-w-0">
                          <span className="flex h-5 w-5 shrink-0 items-center justify-center">
                            {getMenuIcon(item.icon)}
                          </span>
                          <span className={`truncate text-sm ${isCollapsed ? 'lg:hidden' : ''}`}>
                            {item.name}
                          </span>
                        </div>
                      </button>
                    )}
                  </div>
                );
              })
            )}
          </nav>
        </div>

        {/* Authenticated User Footer with Instalearn-style Dropdown */}
        <div className="border-t border-crmBorder bg-major p-3.5 relative">
          <button
            type="button"
            onClick={() => setIsDropdownOpen(!isDropdownOpen)}
            className={`flex w-full cursor-pointer items-center justify-between rounded-xl border border-crmBorder bg-major-tint p-2 transition-all hover:border-minor/30 hover:bg-minor-soft ${isCollapsed ? 'lg:justify-center lg:p-2' : ''
              }`}
            title={`Logged in as ${displayName}`}
          >
            <div className="flex items-center gap-2.5 min-w-0">
              <div className="flex h-[34px] w-[34px] shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-minor to-minor-hover text-xs font-bold text-white shadow-crm-sm">
                {userInitials}
              </div>
              <div className={`min-w-0 text-left ${isCollapsed ? 'lg:hidden' : ''}`}>
                <div className="truncate text-xs font-bold text-crmText">{displayName}</div>
                <div className="truncate text-[10px] font-semibold text-secondary-contrast">
                  {displayRole}
                </div>
              </div>
            </div>

            {!isCollapsed && (
              <div className="ml-1 text-crmText-tertiary">
                {isDropdownOpen ? <ChevronUp size={15} /> : <ChevronDown size={15} />}
              </div>
            )}
          </button>

          {/* User Dropdown Menu */}
          {isDropdownOpen && (
            <div
              className={`absolute bottom-full mb-2 z-50 rounded-xl border border-crmBorder bg-major p-1.5 shadow-crm-lg animate-in fade-in slide-in-from-bottom-2 duration-150 ${isCollapsed ? 'left-2 w-44' : 'left-3.5 right-3.5'
                }`}
            >
              <button
                type="button"
                onClick={() => {
                  setIsDropdownOpen(false);
                  navigate('/profile');
                  onCloseMobile?.();
                }}
                className="flex w-full cursor-pointer items-center gap-2.5 rounded-lg px-3 py-2 text-xs font-semibold text-crmText transition-colors hover:bg-minor-soft hover:text-minor-contrast"
              >
                <UserIcon size={15} className="text-crmText-tertiary" />
                <span>Profile</span>
              </button>
              <button
                type="button"
                onClick={() => {
                  setIsDropdownOpen(false);
                  handleLogout();
                }}
                className="flex w-full cursor-pointer items-center gap-2.5 rounded-lg px-3 py-2 text-xs font-semibold text-crmDanger transition-colors hover:bg-crmDanger-bg"
              >
                <LogOut size={15} className="text-crmDanger" />
                <span>Logout</span>
              </button>
            </div>
          )}
        </div>
      </aside>
    </>
  );
};

export default Sidebar;
