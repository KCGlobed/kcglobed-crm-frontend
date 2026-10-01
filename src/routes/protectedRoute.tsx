import React from 'react';
import { useAppSelector } from '../hooks/useRedux';
import { findMenuItemByPath } from '../store/slices/menuSlice';
import UnauthorizedPage from '../pages/unauthorized';

interface ProtectedRouteProps {
  // Menu path that grants access to this screen
  path: string;
  children: React.ReactNode;
}

// Blocks direct URL access to modules the user cannot view. Super Admin
// (access.full_access) always passes; everyone else needs a menu API item
// for this path with view=true, so access follows whatever modules the
// Super Admin assigns to the role — no module codes are hardcoded here.
export const ProtectedRoute: React.FC<ProtectedRouteProps> = ({ path, children }) => {
  const { access } = useAppSelector((state) => state.auth);
  const { data: menuItems, loading, loaded, error } = useAppSelector((state) => state.menu);

  if (access?.full_access) {
    return <>{children}</>;
  }

  if (loading || !loaded) {
    return (
      <div className="flex h-[60vh] w-full items-center justify-center">
        <span className="inline-block h-8 w-8 rounded-full border-[3px] border-minor/30 border-t-minor animate-spin" />
      </div>
    );
  }

  if (findMenuItemByPath(menuItems, path)?.permissions?.view === true) {
    return <>{children}</>;
  }

  // Menu fetch failed: don't lock users out; the backend still enforces access
  if (error && menuItems.length === 0) {
    return <>{children}</>;
  }

  return <UnauthorizedPage />;
};

export default ProtectedRoute;
