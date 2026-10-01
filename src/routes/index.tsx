import React from 'react';
import { Routes, Route } from 'react-router-dom';
import PrivateRoutes from './privateRoutes';
import PublicRoutes from './publicRoutes';
import ProtectedRoute from './protectedRoute';
import HomeRedirect from './homeRedirect';
// Application Page Views
import LoginPage from '../pages/login';
import AppLayout from '../components/common/AppLayout';
import RolesPage from '../pages/roles';
import ModulesPage from '../pages/module';
import UsersPage from '../pages/users';
import LeadsPage from '../pages/leads';
import StagesPage from '../pages/stage';
import DepartmentsPage from '../pages/department';
import TeamsPage from '../pages/team';
import AuditLogsPage from '../pages/auditLogs';
import ConfigurationsPage from '../pages/configuration';
import ReportingPage from '../pages/reporting';
import NotFoundPage from '../pages/notFound';
import DashboardPage from '../pages/dashboard';
import ProfilePage from '../pages/profile';
import ForgotPasswordPage from '../pages/forgotPassword';
import ResetPasswordPage from '../pages/resetPassword';
import FollowUpsPage from '../pages/followUps';
import InterviewsPage from '../pages/interviews';
import StudentsPage from '../pages/students';
import PaymentsPage from '../pages/payments';

export const AppRoutes: React.FC = () => {
  return (
    <Routes>
      {/* Public Routes */}
      <Route element={<PublicRoutes />}>
        <Route path="/login" element={<LoginPage />} />
      </Route>

      {/* Reachable both logged-in (from Profile > Settings) and logged-out (from Login / email link) */}
      <Route path="/forgot-password" element={<ForgotPasswordPage />} />
      {/* Must match the URL the backend puts in the reset email */}
      <Route path="/auth/reset-password" element={<ResetPasswordPage />} />

      {/* Protected Routes */}
      <Route element={<PrivateRoutes />}>
        <Route element={<AppLayout />}>
          <Route path="/" element={<HomeRedirect />} />
          <Route path="/dashboard" element={<DashboardPage />} />
          <Route path="/modules" element={<ProtectedRoute path="/modules"><ModulesPage /></ProtectedRoute>} />
          <Route path="/roles" element={<ProtectedRoute path="/roles"><RolesPage /></ProtectedRoute>} />
          <Route path="/users" element={<ProtectedRoute path="/users"><UsersPage /></ProtectedRoute>} />
          <Route path="/leads" element={<ProtectedRoute path="/leads"><LeadsPage /></ProtectedRoute>} />
          {/* Follow-ups has no backend Module record yet; it follows the Leads access */}
          <Route path="/follow-ups" element={<ProtectedRoute path="/leads"><FollowUpsPage /></ProtectedRoute>} />
          <Route path="/students" element={<ProtectedRoute path="/students"><StudentsPage /></ProtectedRoute>} />
          <Route path="/interviews" element={<ProtectedRoute path="/interviews"><InterviewsPage /></ProtectedRoute>} />
          <Route path="/payments" element={<ProtectedRoute path="/payments"><PaymentsPage /></ProtectedRoute>} />
          <Route path="/stages" element={<ProtectedRoute path="/stages"><StagesPage /></ProtectedRoute>} />
          <Route path="/departments" element={<ProtectedRoute path="/departments"><DepartmentsPage /></ProtectedRoute>} />
          <Route path="/teams" element={<ProtectedRoute path="/teams"><TeamsPage /></ProtectedRoute>} />
          <Route path="/audit-logs" element={<ProtectedRoute path="/audit-logs"><AuditLogsPage /></ProtectedRoute>} />
          <Route path="/configurations" element={<ProtectedRoute path="/configurations"><ConfigurationsPage /></ProtectedRoute>} />
          <Route path="/profile" element={<ProfilePage />} />
          {/* <Route path="/reporting" element={<ReportingPage />} /> */}
          <Route path="*" element={<NotFoundPage />} />
        </Route>
        <Route>
          <Route path="/reporting" element={<ProtectedRoute path="/reporting"><ReportingPage /></ProtectedRoute>} />
        </Route>
      </Route>
    </Routes>
  );
};

export default AppRoutes;
