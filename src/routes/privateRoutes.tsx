import React, { useEffect } from 'react';
import { Navigate, Outlet } from 'react-router-dom';
import { useAppSelector } from '../hooks/useRedux';
import { useAppDispatch } from '../hooks/useAppDispatch';
import { fetchMenu } from '../store/slices/menuSlice';

export const PrivateRoutes: React.FC = () => {
  const dispatch = useAppDispatch();
  const { isAuthenticated } = useAppSelector((state) => state.auth);
  const { loaded, loading } = useAppSelector((state) => state.menu);

  // Load the user's menu + permissions once per session (cleared on logout)
  useEffect(() => {
    if (isAuthenticated && !loaded && !loading) {
      dispatch(fetchMenu());
    }
  }, [dispatch, isAuthenticated, loaded, loading]);

  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }

  return <Outlet />;
};

export default PrivateRoutes;
