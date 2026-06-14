import MenuRoundedIcon from '@mui/icons-material/MenuRounded';
import {
  AppBar,
  Box,
  Button,
  Container,
  Drawer,
  IconButton,
  Stack,
  Toolbar,
  Typography,
  useMediaQuery,
} from '@mui/material';
import { alpha, useTheme } from '@mui/material/styles';
import { useEffect, useMemo, useState } from 'react';
import { Link as RouterLink, Outlet, useLocation } from 'react-router-dom';

import { useAuth } from '../context/AuthContext';
import { StudySessionLogo } from './StudySessionLogo';

function getNavigationItems(role?: string) {
  if (role === 'analyst') {
    return [{ to: '/admin/overview', label: 'Аналитика' }];
  }

  const items = [
    { to: '/dashboard', label: 'Обзор' },
    { to: '/groups', label: 'Группы' },
    { to: '/profile', label: 'Профиль' },
  ];

  if (role === 'admin') {
    items.push({ to: '/admin/overview', label: 'Админ-панель' });
  }

  return items;
}

export function AppLayout() {
  const { user } = useAuth();
  const [open, setOpen] = useState(false);
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('md'));
  const location = useLocation();
  const isSessionRoute = location.pathname.startsWith('/sessions/');
  const navigationItems = useMemo(() => getNavigationItems(user?.role), [user?.role]);

  useEffect(() => {
    document.title = 'StudySession';
  }, []);

  const nav = useMemo(
    () => (
      <Stack direction={isMobile ? 'column' : 'row'} spacing={1} alignItems={isMobile ? 'stretch' : 'center'}>
        {navigationItems.map((item) => {
          const active = location.pathname === item.to || location.pathname.startsWith(`${item.to}/`) || (item.to === '/admin/overview' && location.pathname.startsWith('/admin'));
          return (
            <Button
              key={item.to}
              component={RouterLink}
              to={item.to}
              onClick={() => setOpen(false)}
              variant={active ? 'contained' : 'outlined'}
              sx={{ justifyContent: isMobile ? 'flex-start' : 'center' }}
            >
              {item.label}
            </Button>
          );
        })}
      </Stack>
    ),
    [isMobile, location.pathname, navigationItems],
  );

  if (isSessionRoute) {
    return (
      <Box sx={{ height: '100vh', width: '100vw', overflow: 'hidden', backgroundColor: 'background.default' }}>
        <Outlet />
      </Box>
    );
  }

  return (
    <Box sx={{ minHeight: '100vh', bgcolor: 'background.default' }}>
      <AppBar
        position="sticky"
        color="transparent"
        elevation={0}
        sx={{
          borderBottom: '1px solid',
          borderColor: 'divider',
          backdropFilter: 'blur(14px)',
          backgroundColor: alpha(theme.palette.background.paper, 0.9),
        }}
      >
        <Toolbar sx={{ minHeight: 72 }}>
          <Stack
            component={RouterLink}
            to={user ? '/dashboard' : '/auth'}
            direction="row"
            spacing={1.5}
            alignItems="center"
            sx={{ flexGrow: 1, textDecoration: 'none', color: 'inherit' }}
          >
            <StudySessionLogo size={36} sx={{ color: 'text.primary' }} />
            <Typography variant="h4">StudySession</Typography>
          </Stack>
          {user && !isMobile && nav}
          {user && isMobile ? (
            <IconButton onClick={() => setOpen(true)} color="inherit">
              <MenuRoundedIcon />
            </IconButton>
          ) : null}
        </Toolbar>
      </AppBar>

      <Drawer anchor="right" open={open} onClose={() => setOpen(false)} PaperProps={{ sx: { width: 280, p: 2 } }}>
        {nav}
      </Drawer>

      <Container maxWidth="xl" sx={{ py: { xs: 2, md: 4 }, px: { xs: 2, md: 3 } }}>
        <Outlet />
      </Container>
    </Box>
  );
}
