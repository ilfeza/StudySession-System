import { createRoot } from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';

import App from './App';
import { AuthProvider } from './context/AuthContext';
import { ThemeModeProvider } from './context/ThemeModeContext';

if (typeof window !== 'undefined' && window.location.hostname === '0.0.0.0') {
  const normalizedUrl = new URL(window.location.href);
  normalizedUrl.hostname = 'localhost';
  window.location.replace(normalizedUrl.toString());
}

createRoot(document.getElementById('root')!).render(
  <ThemeModeProvider>
    <BrowserRouter>
      <AuthProvider>
        <App />
      </AuthProvider>
    </BrowserRouter>
  </ThemeModeProvider>,
);
