import React from 'react';
import { useAppSelector } from '../hooks/useRedux';
import { flattenMenu } from '../store/slices/menuSlice';
import UnauthorizedPage from '../pages/unauthorized';

interface ProtectedRouteProps {
  // One code, or several where any one granting view is enough
  code: string | string[];
  children: React.ReactNode;
}

// Blocks direct URL access to modules the user cannot view. Super Admin
// (access.full_access) always passes; everyone else needs view=true from the
// menu API, with the login response's permissions as fallback if the menu
// fetch failed.
export const ProtectedRoute: React.FC<ProtectedRouteProps> = ({ code, children }) => {
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

  const codes = Array.isArray(code) ? code : [code];
  const canView = flattenMenu(menuItems).some(
    (item) => codes.includes(item.code ?? '') && item.permissions?.view === true
  );
  if (canView) {
    return <>{children}</>;
  }

  // Menu fetch failed: don't lock out users the login response already permits
  if (error && menuItems.length === 0 && codes.some((c) => access?.permissions?.[c]?.view === true)) {
    return <>{children}</>;
  }

  return <UnauthorizedPage />;
};

export default ProtectedRoute;
