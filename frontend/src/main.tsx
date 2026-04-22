import { CssBaseline, ThemeProvider } from '@mui/material';
import { createRoot } from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';

import App from './App';
import { AuthProvider } from './context/AuthContext';
import { appTheme } from './styles/theme';

if (typeof window !== 'undefined' && window.location.hostname === '0.0.0.0') {
  const normalizedUrl = new URL(window.location.href);
  normalizedUrl.hostname = 'localhost';
  window.location.replace(normalizedUrl.toString());
}

createRoot(document.getElementById('root')!).render(
  <ThemeProvider theme={appTheme}>
    <CssBaseline />
    <BrowserRouter>
      <AuthProvider>
        <App />
      </AuthProvider>
    </BrowserRouter>
  </ThemeProvider>,
);
