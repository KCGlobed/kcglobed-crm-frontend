import React from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import PrivateRoutes from './privateRoutes';
import PublicRoutes from './publicRoutes';
// Application Page Views
import LoginPage from '../pages/login';
import AppLayout from '../components/common/AppLayout';
import RolesPage from '../pages/roles';
import RolesListPage from '../pages/roles/RolesListPage';
import UsersPage from '../pages/users';
import NotFoundPage from '../pages/notFound';
import DashboardPage from '../pages/dashboard';

export const AppRoutes: React.FC = () => {
  return (
    <Routes>
      {/* Public Routes */}
      <Route element={<PublicRoutes />}>
        <Route path="/login" element={<LoginPage />} />
      </Route>

      {/* Protected Routes */}
      <Route element={<PrivateRoutes />}>
        <Route element={<AppLayout />}>
          <Route path="/" element={<Navigate to="/roles" replace />} />
          <Route path="/dashboard" element={<DashboardPage />} />
          <Route path="/roles" element={<RolesListPage />} />
          <Route path="/roles-old" element={<RolesPage />} />
          <Route path="/users" element={<UsersPage />} />
          <Route path="*" element={<NotFoundPage />} />
        </Route>
      </Route>
    </Routes>
  );
};

export default AppRoutes;
