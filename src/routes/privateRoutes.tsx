import React from 'react';
import { Navigate, Outlet } from 'react-router-dom';
import { useAppSelector } from '../hooks/useRedux';

export const PrivateRoutes: React.FC = () => {
  const { isAuthenticated } = useAppSelector((state) => state.auth);

  // if (!isAuthenticated) {
  //   return <Navigate to="/login" replace />;
  // }

  return <Outlet />;
};

export default PrivateRoutes;
