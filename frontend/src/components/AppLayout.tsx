import MenuRoundedIcon from '@mui/icons-material/MenuRounded';
import VideocamRoundedIcon from '@mui/icons-material/VideocamRounded';
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
  useTheme,
} from '@mui/material';
import { useMemo, useState } from 'react';
import { Link as RouterLink, Outlet, useLocation } from 'react-router-dom';

import { useAuth } from '../context/AuthContext';

const navigationItems = [
  { to: '/dashboard', label: 'Дашборд' },
  { to: '/groups', label: 'Группы' },
  { to: '/history', label: 'История' },
  { to: '/profile', label: 'Профиль' },
];

function getShortDisplayName(fullName?: string | null) {
  if (!fullName) {
    return '';
  }
  const parts = fullName.trim().split(/\s+/).filter(Boolean);
  if (parts.length >= 2) {
    return `${parts[0]} ${parts[1]}`;
  }
  return parts[0] ?? '';
}

export function AppLayout() {
  const { user, logout } = useAuth();
  const [open, setOpen] = useState(false);
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('md'));
  const location = useLocation();
  const isSessionRoute = location.pathname.startsWith('/sessions/');

  const nav = useMemo(
    () => (
      <Stack direction={isMobile ? 'column' : 'row'} spacing={1} alignItems={isMobile ? 'stretch' : 'center'}>
        {navigationItems.map((item) => {
          const active = location.pathname === item.to;
          return (
            <Button
              key={item.to}
              component={RouterLink}
              to={item.to}
              onClick={() => setOpen(false)}
              variant={active ? 'contained' : 'text'}
              color="primary"
              sx={{
                justifyContent: isMobile ? 'flex-start' : 'center',
                px: 1.5,
              }}
            >
              {item.label}
            </Button>
          );
        })}
        <Typography variant="body2" color="text.secondary" sx={{ px: isMobile ? 1 : 0, ml: isMobile ? 0 : 1 }}>
          {getShortDisplayName(user?.full_name)}
        </Typography>
        <Button
          color="inherit"
          variant="outlined"
          onClick={() => {
            setOpen(false);
            logout();
          }}
        >
          Выйти
        </Button>
      </Stack>
    ),
    [isMobile, location.pathname, logout, user?.full_name],
  );

  if (isSessionRoute) {
    return (
      <Box sx={{ height: '100vh', width: '100vw', overflow: 'hidden', backgroundColor: 'background.default' }}>
        <Outlet />
      </Box>
    );
  }

  return (
    <Box sx={{ minHeight: '100vh', backgroundColor: 'background.default' }}>
      <AppBar
        position="sticky"
        color="transparent"
        sx={{
          borderBottom: '1px solid',
          borderColor: 'divider',
          backdropFilter: 'blur(14px)',
          backgroundColor: 'rgba(243, 244, 246, 0.88)',
        }}
      >
        <Toolbar sx={{ minHeight: 72 }}>
          <Stack direction="row" spacing={1.5} alignItems="center" sx={{ flexGrow: 1 }}>
            <Box
              sx={{
                width: 40,
                height: 40,
                borderRadius: 1.5,
                display: 'grid',
                placeItems: 'center',
                backgroundColor: '#111827',
                color: '#ffffff',
              }}
            >
              <VideocamRoundedIcon fontSize="small" />
            </Box>
            <Box>
              <Typography variant="subtitle1">StudySession</Typography>
              <Typography variant="caption" color="text.secondary">
                Совместная работа и видеосессии
              </Typography>
            </Box>
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
