import { ReactElement } from 'react';
import { Navigate, Route, Routes } from 'react-router-dom';

import { AppLayout } from './components/AppLayout';
import { useAuth } from './context/AuthContext';
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
        <Route path="/" element={<Navigate to="/dashboard" replace />} />
        <Route path="/dashboard" element={<DashboardPage />} />
        <Route path="/groups" element={<GroupsPage />} />
        <Route path="/history" element={<SessionHistoryPage />} />
        <Route path="/profile" element={<ProfilePage />} />
        <Route path="/sessions/:sessionId" element={<VideoSessionPage />} />
        <Route path="*" element={<Navigate to="/dashboard" replace />} />
      </Route>
    </Routes>
  );
}
