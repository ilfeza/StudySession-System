import {
  Alert,
  Box,
  ListItemButton,
  ListItemText,
  Paper,
  Stack,
  Typography,
} from '@mui/material';
import { useMemo } from 'react';
import { Navigate, NavLink, Outlet, useLocation } from 'react-router-dom';

import { useAuth } from '../../context/AuthContext';

const adminNavItems: Array<{ to: string; label: string; adminOnly?: boolean }> = [
  { to: '/admin/overview', label: 'Обзор' },
  { to: '/admin/users', label: 'Пользователи', adminOnly: true },
  { to: '/admin/groups', label: 'Группы' },
];

export function AdminLayout() {
  const { user } = useAuth();
  const location = useLocation();
  const isReadOnly = user?.role === 'analyst';

  const navItems = useMemo(
    () => adminNavItems.filter((item) => !item.adminOnly || !isReadOnly),
    [isReadOnly],
  );

  if (!user || (user.role !== 'admin' && user.role !== 'analyst')) {
    return <Alert severity="warning">Доступ к админ-панели закрыт.</Alert>;
  }

  if (location.pathname === '/admin') {
    return <Navigate to="/admin/overview" replace />;
  }

  if (isReadOnly && location.pathname.startsWith('/admin/users')) {
    return <Navigate to="/admin/overview" replace />;
  }

  return (
    <Stack spacing={2.5}>
      <Box>
        <Typography variant="h4">{isReadOnly ? 'Аналитика платформы' : 'Панель администратора'}</Typography>
        <Typography variant="body2" color="text.secondary" sx={{ mt: 0.75 }}>
          {isReadOnly ? 'Статистика и структура групп платформы.' : 'Управление пользователями, группами и метриками сайта.'}
        </Typography>
      </Box>

      <Box sx={{ display: 'grid', gap: 2, gridTemplateColumns: { xs: '1fr', lg: '220px minmax(0, 1fr)' }, alignItems: 'start' }}>
        <Paper sx={{ p: 1, borderRadius: 2.5 }}>
          <Stack spacing={0.5}>
            {navItems.map((item) => (
              <ListItemButton
                key={item.to}
                component={NavLink}
                to={item.to}
                selected={location.pathname === item.to}
                sx={{ borderRadius: 1.5 }}
              >
                <ListItemText primary={item.label} />
              </ListItemButton>
            ))}
          </Stack>
        </Paper>

        <Box>
          <Outlet />
        </Box>
      </Box>
    </Stack>
  );
}
