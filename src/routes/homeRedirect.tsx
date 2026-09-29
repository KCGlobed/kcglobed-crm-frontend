import React from 'react';
import { Navigate } from 'react-router-dom';
import { useAppSelector } from '../hooks/useRedux';
import { firstMenuPath } from '../store/slices/menuSlice';

// Lands "/" (and the post-login redirect) on the first module the user is
// allowed to view, once the menu has loaded.
export const HomeRedirect: React.FC = () => {
  const { access } = useAppSelector((state) => state.auth);
  const { data: menuItems, loading, loaded } = useAppSelector((state) => state.menu);

  if (loading || !loaded) {
    return (
      <div className="flex h-[60vh] w-full items-center justify-center">
        <span className="inline-block h-8 w-8 rounded-full border-[3px] border-minor/30 border-t-minor animate-spin" />
      </div>
    );
  }

  const target = access?.full_access && menuItems.length === 0 ? '/dashboard' : firstMenuPath(menuItems);
  return <Navigate to={target} replace />;
};

export default HomeRedirect;
