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
import ProfilePage from '../pages/profile';
import ForgotPasswordPage from '../pages/forgotPassword';
import ResetPasswordPage from '../pages/resetPassword';

export const AppRoutes: React.FC = () => {
  return (
    <Routes>
      {/* Public Routes */}
      <Route element={<PublicRoutes />}>
        <Route path="/login" element={<LoginPage />} />
      </Route>

      {/* Reachable both logged-in (from Profile > Settings) and logged-out (from Login / email link) */}
      <Route path="/forgot-password" element={<ForgotPasswordPage />} />
      <Route path="/reset-password" element={<ResetPasswordPage />} />

      {/* Protected Routes */}
      <Route element={<PrivateRoutes />}>
        <Route element={<AppLayout />}>
          <Route path="/" element={<Navigate to="/roles" replace />} />
          <Route path="/dashboard" element={<DashboardPage />} />
          <Route path="/modules" element={<ModulesPage />} />
          <Route path="/roles" element={<RolesPage />} />
          <Route path="/users" element={<UsersPage />} />
          <Route path="/profile" element={<ProfilePage />} />
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
