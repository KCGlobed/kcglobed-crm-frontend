import React, { useEffect, useState } from 'react';
import { Outlet, useLocation } from 'react-router-dom';
import Sidebar from './Sidebar';
import Header from './Header';
import type { Breadcrumb } from './Header';

interface AppLayoutProps {
  activePage?: string;
  onSelectPage?: (page: string) => void;
  children?: React.ReactNode;
}

/** Breadcrumb labels keyed by the first URL segment. Labels match the sidebar names. */
const PAGE_TITLES: Record<string, { label: string; parent?: string }> = {
  dashboard: { label: 'Dashboard' },
  users: { label: 'Users & Staff' },
  reporting: { label: 'Reporting Graph' },
  modules: { label: 'Module', parent: 'Settings' },
  roles: { label: 'Roles & Permissions', parent: 'Settings' },
  profile: { label: 'My Profile' },
  'change-password': { label: 'Change Password' },
};

/** "follow-ups" -> "Follow Ups" for routes not listed above. */
const titleFromSlug = (slug: string) =>
  slug
    .split(/[-_]+/)
    .filter(Boolean)
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');

export const AppLayout: React.FC<AppLayoutProps> = ({
  activePage,
  onSelectPage,
  children,
}) => {
  const [isCollapsed, setIsCollapsed] = useState(false);
  const [isMobileOpen, setIsMobileOpen] = useState(false);
  const location = useLocation();

  const currentPath = location?.pathname ? location.pathname.replace(/^\//, '').split('/')[0] : '';
  const currentPage = activePage || currentPath || 'dashboard';
  const page = PAGE_TITLES[currentPage] || { label: titleFromSlug(currentPage) || 'Page Not Found' };

  const breadcrumbs: Breadcrumb[] =
    currentPage === 'dashboard'
      ? [{ label: 'Dashboard' }]
      : [
          { label: 'Dashboard', to: '/dashboard' },
          ...(page.parent ? [{ label: page.parent }] : []),
          { label: page.label },
        ];

  // The drawer should never stay open across a navigation.
  useEffect(() => {
    setIsMobileOpen(false);
  }, [location.pathname]);

  // Lock body scroll while the mobile drawer is open.
  useEffect(() => {
    document.body.style.overflow = isMobileOpen ? 'hidden' : '';
    return () => {
      document.body.style.overflow = '';
    };
  }, [isMobileOpen]);

  return (
    <div className="flex h-screen w-full overflow-hidden bg-major-tint">
      {/* Left Sidebar */}
      <Sidebar
        activePage={currentPage}
        onSelectPage={onSelectPage}
        isCollapsed={isCollapsed}
        onToggleCollapse={() => setIsCollapsed(!isCollapsed)}
        isMobileOpen={isMobileOpen}
        onCloseMobile={() => setIsMobileOpen(false)}
      />

      {/* Main Viewport */}
      <div className="flex h-screen min-w-0 flex-1 flex-col overflow-hidden">
        {/* Top Navbar */}
        <Header breadcrumbs={breadcrumbs} onOpenSidebar={() => setIsMobileOpen(true)} />

        {/* Dynamic Content Viewport */}
        <main className="min-w-0 flex-1 overflow-y-auto p-4 sm:p-6 lg:p-8">
          {children || <Outlet />}
        </main>
      </div>
    </div>
  );
};

export default AppLayout;
