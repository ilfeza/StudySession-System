import { ReactElement } from 'react';
import { Navigate, Route, Routes, useLocation } from 'react-router-dom';

import { AppLayout } from './components/AppLayout';
import { useAuth } from './context/AuthContext';
import { AdminLayout } from './pages/admin/AdminLayout';
import { AdminGroupsPage } from './pages/admin/AdminGroupsPage';
import { AdminOverviewPage } from './pages/admin/AdminOverviewPage';
import { AdminUsersPage } from './pages/admin/AdminUsersPage';
import { AuthPage } from './pages/AuthPage';
import { DashboardPage } from './pages/DashboardPage';
import { GroupsPage } from './pages/GroupsPage';
import { ProfilePage } from './pages/ProfilePage';
import { SessionHistoryPage } from './pages/SessionHistoryPage';
import { VideoSessionPage } from './pages/VideoSessionPage';

function ProtectedRoute({ children }: { children: ReactElement }) {
  const { user, loading } = useAuth();

  if (loading) {
    return <div>Проверяем авторизацию...</div>;
  }

  if (!user) {
    return <Navigate to="/auth" replace />;
  }

  return children;
}

function RestrictedForAnalyst({ children }: { children: ReactElement }) {
  const { user } = useAuth();
  const location = useLocation();

  if (user?.role === 'analyst' && location.pathname !== '/admin') {
    return <Navigate to="/admin" replace />;
  }

  return children;
}

function HomeRedirect() {
  const { user } = useAuth();
  return <Navigate to={user?.role === 'analyst' ? '/admin' : '/dashboard'} replace />;
}

export default function App() {
  return (
    <Routes>
      <Route path="/auth" element={<AuthPage />} />
      <Route
        element={(
          <ProtectedRoute>
            <AppLayout />
          </ProtectedRoute>
        )}
      >
        <Route path="/" element={<HomeRedirect />} />
        <Route path="/admin" element={<AdminLayout />}>
          <Route index element={<Navigate to="overview" replace />} />
          <Route path="overview" element={<AdminOverviewPage />} />
          <Route path="users" element={<AdminUsersPage />} />
          <Route path="groups" element={<AdminGroupsPage />} />
        </Route>
        <Route
          path="/dashboard"
          element={(
            <RestrictedForAnalyst>
              <DashboardPage />
            </RestrictedForAnalyst>
          )}
        />
        <Route
          path="/groups"
          element={(
            <RestrictedForAnalyst>
              <GroupsPage />
            </RestrictedForAnalyst>
          )}
        />
        <Route
          path="/history"
          element={(
            <RestrictedForAnalyst>
              <SessionHistoryPage />
            </RestrictedForAnalyst>
          )}
        />
        <Route
          path="/profile/*"
          element={(
            <RestrictedForAnalyst>
              <ProfilePage />
            </RestrictedForAnalyst>
          )}
        />
        <Route
          path="/sessions/:sessionId"
          element={(
            <RestrictedForAnalyst>
              <VideoSessionPage />
            </RestrictedForAnalyst>
          )}
        />
        <Route path="*" element={<HomeRedirect />} />
      </Route>
    </Routes>
  );
}
