import type { PaletteMode } from '@mui/material';
import { CssBaseline, ThemeProvider } from '@mui/material';
import { createContext, useContext, useEffect, useMemo, useState } from 'react';

import { createAppTheme } from '../styles/theme';

interface ThemeModeContextShape {
  mode: PaletteMode;
  setMode: (mode: PaletteMode) => void;
}

const ThemeModeContext = createContext<ThemeModeContextShape | null>(null);

export function ThemeModeProvider({ children }: { children: React.ReactNode }) {
  const [mode, setMode] = useState<PaletteMode>(() => {
    if (typeof window === 'undefined') {
      return 'light';
    }
    const saved = window.localStorage.getItem('color_mode');
    return saved === 'dark' ? 'dark' : 'light';
  });

  useEffect(() => {
    window.localStorage.setItem('color_mode', mode);
  }, [mode]);

  const theme = useMemo(() => createAppTheme(mode), [mode]);
  const value = useMemo(() => ({ mode, setMode }), [mode]);

  return (
    <ThemeModeContext.Provider value={value}>
      <ThemeProvider theme={theme}>
        <CssBaseline />
        {children}
      </ThemeProvider>
    </ThemeModeContext.Provider>
  );
}

export function useThemeMode() {
  const context = useContext(ThemeModeContext);
  if (!context) {
    throw new Error('Контекст цветовой темы недоступен.');
  }
  return context;
}
