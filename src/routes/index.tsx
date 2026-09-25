import React from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import PrivateRoutes from './privateRoutes';
import PublicRoutes from './publicRoutes';
// Application Page Views
import LoginPage from '../pages/login';
import AppLayout from '../components/common/AppLayout';
import RolesPage from '../pages/roles';
import ModulesPage from '../pages/module';
import UsersPage from '../pages/users';
import ReportingPage from '../pages/reporting';
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
          <Route path="/modules" element={<ModulesPage />} />
          <Route path="/roles" element={<RolesPage />} />
          <Route path="/users" element={<UsersPage />} />
          {/* <Route path="/reporting" element={<ReportingPage />} /> */}
          <Route path="*" element={<NotFoundPage />} />
        </Route>
        <Route>
          <Route path="/reporting" element={<ReportingPage />} />
        </Route>
      </Route>
    </Routes>
  );
};

export default AppRoutes;
