import React, { useState, useEffect } from 'react';
import { useLocation, useNavigate, Link } from 'react-router-dom';
import {
  ChevronDown,
  ChevronLeft,
  ChevronUp,
  LayoutDashboard,
  LogOut,
  User as UserIcon,
  Users,
  X,
  SettingsIcon,
} from 'lucide-react';
import { useAppDispatch } from '../../hooks/useAppDispatch';
import { useAppSelector } from '../../hooks/useRedux';
import { logout } from '../../store/slices/authSlice';

interface SidebarProps {
  activePage?: string;
  onSelectPage?: (page: string) => void;
  isCollapsed: boolean;
  onToggleCollapse: () => void;
  isMobileOpen?: boolean;
  onCloseMobile?: () => void;
}

interface SubMenuItem {
  id: string;
  name: string;
  path: string;
  badge?: string;
}

interface NavItem {
  id: string;
  label: string;
  icon: React.ReactNode;
  path?: string;
  badge?: string;
  submenu?: SubMenuItem[];
}

export const Sidebar: React.FC<SidebarProps> = ({
  activePage,
  onSelectPage,
  isCollapsed,
  onToggleCollapse,
  isMobileOpen = false,
  onCloseMobile,
}) => {
  const dispatch = useAppDispatch();
  const navigate = useNavigate();
  const location = useLocation();

  const { user } = useAppSelector((state) => state.auth);
  // const { data: roles } = useAppSelector((state) => state.roles);
  const { data: users } = useAppSelector((state) => state.users);

  // Submenu accordion & user profile dropdown states (Instalearn pattern)
  const [openSubmenu, setOpenSubmenu] = useState<string | null>(null);
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);

  // Derive current page either from prop or URL pathname
  const currentPath = location?.pathname ? location.pathname.replace(/^\//, '') : '';
  const currentPage = activePage || currentPath || 'dashboard';

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

  const toggleSubmenu = (id: string) => {
    if (isCollapsed) {
      onToggleCollapse(); // expand sidebar if collapsed so user can see submenu
    }
    setOpenSubmenu(openSubmenu === id ? null : id);
  };

  const handleNavClick = (id: string, path?: string) => {
    if (onSelectPage) {
      onSelectPage(id);
    }
    navigate(path || `/${id}`);
    onCloseMobile?.();
  };

  const handleLogout = () => {
    dispatch(logout());
    navigate('/login');
    onCloseMobile?.();
  };

  // CRM Navigation items structured with Instalearn's accordion submenu pattern
  const navItems: NavItem[] = [
    {
      id: 'dashboard',
      label: 'Dashboard',
      path: '/dashboard',
      icon: <LayoutDashboard size={19} />,
    },
    {
      id: 'users',
      label: 'Users & Staff',
      path: '/users',
      badge: users && users.length > 0 ? `${users.length}` : undefined,
      icon: <Users size={19} />,
    },

    {
      id: 'reporting',
      label: 'Reporting Graph',
      path: '/reporting',
      icon: <Users size={19} />, // Using Users icon as a placeholder
    },
    {
      id: 'settings',
      label: 'Settings',
      icon: <SettingsIcon size={19} />,
      submenu: [
        { id: 'module', name: 'Module', path: '/modules' },
        { id: 'roles', name: 'Roles & Permissions', path: '/roles' },
      ],
    },
    // {
    //   id: 'leads',
    //   label: 'Leads & Pipeline',
    //   icon: <BarChart3 size={19} />,
    //   submenu: [
    //     { id: 'leads', name: 'All Leads', path: '/leads' },
    //     { id: 'pipeline', name: 'Pipeline View', path: '/leads/pipeline' },
    //   ],
    // },
    // {
    //   id: 'admissions',
    //   label: 'Admissions',
    //   icon: <GraduationCap size={19} />,
    //   submenu: [
    //     { id: 'admissions', name: 'All Admissions', path: '/admissions' },
    //     { id: 'applications', name: 'Applications', path: '/admissions/applications' },
    //   ],
    // },
    // {
    //   id: 'followups',
    //   label: 'Follow-ups & Notes',
    //   path: '/followups',
    //   icon: <MessageSquare size={19} />,
    // },
    // {
    //   id: 'reports',
    //   label: 'Reports & Export',
    //   icon: <PieChart size={19} />,
    //   submenu: [
    //     { id: 'reports', name: 'Reports Overview', path: '/reports' },
    //     { id: 'reports-export', name: 'Export Data', path: '/reports/export' },
    //   ],
    // },
  ];

  // Auto-expand submenu if current path matches any of its children
  useEffect(() => {
    navItems.forEach((item) => {
      if (
        item.submenu?.some(
          (sub) =>
            location.pathname === sub.path ||
            currentPath === sub.id ||
            currentPage === sub.id
        )
      ) {
        setOpenSubmenu(item.id);
      }
    });
  }, [location.pathname, currentPath, currentPage]);

  const isSubmenuActive = (item: NavItem) => {
    return !!item.submenu?.some(
      (sub) =>
        location.pathname === sub.path ||
        currentPath === sub.id ||
        currentPage === sub.id
    );
  };

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
            {navItems.map((item) => {
              const hasSubmenu = !!item.submenu && item.submenu.length > 0;
              const isSubActive = isSubmenuActive(item);
              const isActive =
                currentPage === item.id ||
                currentPath === item.id ||
                location.pathname === item.path ||
                isSubActive;
              const isSubOpen = openSubmenu === item.id;

              return (
                <div key={item.id}>
                  {hasSubmenu ? (
                    <>
                      {/* Parent Item with Accordion Toggle */}
                      <button
                        type="button"
                        onClick={() => toggleSubmenu(item.id)}
                        className={`flex w-full cursor-pointer items-center justify-between rounded-xl px-3.5 py-2.5 text-left font-sans text-sm font-semibold transition-all ${isActive
                          ? 'bg-minor-soft text-minor-contrast'
                          : 'bg-transparent text-crmText-secondary hover:bg-minor-soft hover:text-minor-contrast'
                          } ${isCollapsed ? 'lg:justify-center lg:px-0' : ''}`}
                        title={isCollapsed ? item.label : undefined}
                      >
                        <div className="flex items-center gap-3.5 min-w-0">
                          <span className="flex h-5 w-5 shrink-0 items-center justify-center">
                            {item.icon}
                          </span>
                          <span className={`truncate text-sm ${isCollapsed ? 'lg:hidden' : ''}`}>
                            {item.label}
                          </span>
                        </div>

                        {!isCollapsed && (
                          <div className="ml-auto flex items-center gap-1.5 pl-2 shrink-0">
                            {item.badge && (
                              <span className="rounded-full bg-secondary-soft px-2 py-0.5 text-[0.72rem] font-bold text-secondary-contrast border border-secondary/25">
                                {item.badge}
                              </span>
                            )}
                            {isSubOpen ? (
                              <ChevronUp size={14} className="text-crmText-tertiary" />
                            ) : (
                              <ChevronDown size={14} className="text-crmText-tertiary" />
                            )}
                          </div>
                        )}
                      </button>

                      {/* Accordion Submenu Items */}
                      {!isCollapsed && isSubOpen && (
                        <div className="ml-6 mt-1 mb-2 flex flex-col space-y-1 border-l-2 border-crmBorder pl-2.5">
                          {item.submenu?.map((subItem) => {
                            const isChildActive =
                              location.pathname === subItem.path ||
                              currentPath === subItem.id ||
                              currentPage === subItem.id;

                            return (
                              <Link
                                key={subItem.id}
                                to={subItem.path}
                                onClick={() => handleNavClick(subItem.id, subItem.path)}
                                className={`flex items-center justify-between rounded-lg p-2 text-xs font-medium transition-colors ${isChildActive
                                  ? 'bg-minor text-white font-semibold shadow-sm'
                                  : 'text-crmText-secondary hover:bg-minor-soft hover:text-minor-contrast'
                                  }`}
                              >
                                <span className="truncate">{subItem.name}</span>
                                {subItem.badge && (
                                  <span
                                    className={`ml-1.5 rounded-full px-1.5 py-0.2 text-[9px] font-bold ${isChildActive
                                      ? 'bg-white/20 text-white'
                                      : 'bg-crmBorder text-crmText-secondary'
                                      }`}
                                  >
                                    {subItem.badge}
                                  </span>
                                )}
                              </Link>
                            );
                          })}
                        </div>
                      )}
                    </>
                  ) : (
                    /* Regular Single Link Item */
                    <button
                      type="button"
                      className={`flex w-full cursor-pointer items-center justify-between rounded-xl px-3.5 py-2.5 text-left font-sans text-sm font-semibold transition-all ${isActive
                        ? 'bg-minor text-white shadow-crm-accent'
                        : 'bg-transparent text-crmText-secondary hover:bg-minor-soft hover:text-minor-contrast'
                        } ${isCollapsed ? 'lg:justify-center lg:px-0' : ''}`}
                      onClick={() => handleNavClick(item.id, item.path)}
                      title={isCollapsed ? item.label : undefined}
                      aria-current={isActive ? 'page' : undefined}
                    >
                      <div className="flex items-center gap-3.5 min-w-0">
                        <span className="flex h-5 w-5 shrink-0 items-center justify-center">
                          {item.icon}
                        </span>
                        <span className={`truncate text-sm ${isCollapsed ? 'lg:hidden' : ''}`}>
                          {item.label}
                        </span>
                      </div>
                      {!isCollapsed && item.badge && (
                        <span
                          className={`ml-auto rounded-full px-2 py-0.5 text-[0.72rem] font-bold ${isActive ? 'bg-white/25 text-white' : 'bg-secondary-soft text-secondary-contrast border border-secondary/25'
                            }`}
                        >
                          {item.badge}
                        </span>
                      )}
                    </button>
                  )}
                </div>
              );
            })}
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
                  navigate('/users');
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
