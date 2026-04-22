import MenuBookRoundedIcon from '@mui/icons-material/MenuBookRounded';
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
import { useState } from 'react';
import { Link as RouterLink, Outlet, useLocation } from 'react-router-dom';

import { useAuth } from '../context/AuthContext';

export function AppLayout() {
  const { user, logout } = useAuth();
  const [open, setOpen] = useState(false);
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('md'));
  const location = useLocation();
  const isSessionRoute = location.pathname.startsWith('/sessions/');

  const nav = (
    <Stack direction={isMobile ? 'column' : 'row'} spacing={2} alignItems={isMobile ? 'stretch' : 'center'}>
      <Button component={RouterLink} to="/dashboard" onClick={() => setOpen(false)}>Дашборд</Button>
      <Button component={RouterLink} to="/groups" startIcon={<MenuBookRoundedIcon />} onClick={() => setOpen(false)}>Группы</Button>
      <Typography variant="body2" sx={{ px: isMobile ? 1 : 0 }}>{user?.full_name}</Typography>
      <Button color="error" variant="outlined" onClick={() => { setOpen(false); logout(); }}>Выйти</Button>
    </Stack>
  );

  if (isSessionRoute) {
    return (
      <Box sx={{ minHeight: '100vh', backgroundColor: '#050913' }}>
        <Outlet />
      </Box>
    );
  }

  return (
    <Box sx={{ minHeight: '100vh', background: 'linear-gradient(180deg, #f2f7ff 0%, #fff8ef 100%)' }}>
      <AppBar position="sticky" color="transparent" elevation={0} sx={{ backdropFilter: 'blur(8px)', borderBottom: '1px solid #d9e3f2' }}>
        <Toolbar>
          <Stack direction="row" spacing={1} alignItems="center" sx={{ flexGrow: 1 }}>
            <VideocamRoundedIcon color="primary" />
            <Typography variant="h6" fontWeight={700}>СтудКоманда</Typography>
          </Stack>
          {user && !isMobile && nav}
          {user && isMobile && (
            <IconButton onClick={() => setOpen(true)}>
              <MenuRoundedIcon />
            </IconButton>
          )}
        </Toolbar>
      </AppBar>

      <Drawer anchor="right" open={open} onClose={() => setOpen(false)}>
        <Box sx={{ width: 280, p: 2 }}>{nav}</Box>
      </Drawer>

      <Container sx={{ py: { xs: 2, md: 3 }, px: { xs: 1.5, md: 3 } }}>
        <Outlet />
      </Container>
    </Box>
  );
}
