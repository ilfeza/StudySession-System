import { createTheme } from '@mui/material';

export const appTheme = createTheme({
  palette: {
    mode: 'light',
    primary: {
      main: '#165DFF',
    },
    secondary: {
      main: '#FF8F1F',
    },
    background: {
      default: '#f8fbff',
      paper: '#ffffff',
    },
  },
  typography: {
    fontFamily: 'Manrope, "Segoe UI", sans-serif',
    h4: {
      letterSpacing: '-0.02em',
    },
  },
  shape: {
    borderRadius: 12,
  },
});
