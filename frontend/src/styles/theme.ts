import { alpha, createTheme } from '@mui/material/styles';
import type { PaletteMode } from '@mui/material';

export function createAppTheme(mode: PaletteMode) {
  const isDark = mode === 'dark';

  return createTheme({
    palette: {
      mode,
      primary: {
        main: isDark ? '#f8fafc' : '#111827',
      },
      secondary: {
        main: isDark ? '#cbd5e1' : '#4b5563',
      },
      background: {
        default: isDark ? '#0b1220' : '#f3f4f6',
        paper: isDark ? '#111827' : '#ffffff',
      },
      text: {
        primary: isDark ? '#f8fafc' : '#111827',
        secondary: isDark ? '#94a3b8' : '#6b7280',
      },
      divider: isDark ? '#243041' : '#e5e7eb',
      success: {
        main: '#15803d',
      },
      warning: {
        main: '#b45309',
      },
      error: {
        main: '#b91c1c',
      },
    },
    shape: {
      borderRadius: 8,
    },
    typography: {
      fontFamily: '"Segoe UI", "Helvetica Neue", Arial, sans-serif',
      h1: { fontSize: '2.5rem', fontWeight: 700, letterSpacing: '-0.04em' },
      h2: { fontSize: '2rem', fontWeight: 700, letterSpacing: '-0.03em' },
      h3: { fontSize: '1.75rem', fontWeight: 700, letterSpacing: '-0.03em' },
      h4: { fontSize: '1.5rem', fontWeight: 700, letterSpacing: '-0.02em' },
      h5: { fontSize: '1.25rem', fontWeight: 700, letterSpacing: '-0.02em' },
      h6: { fontSize: '1rem', fontWeight: 700 },
      subtitle1: { fontSize: '1rem', fontWeight: 600 },
      subtitle2: { fontSize: '0.875rem', fontWeight: 600 },
      body1: { fontSize: '0.95rem', lineHeight: 1.6 },
      body2: { fontSize: '0.875rem', lineHeight: 1.55 },
      button: { fontSize: '0.9rem', fontWeight: 600, textTransform: 'none' },
    },
    components: {
      MuiCssBaseline: {
        styleOverrides: {
          '*, *::before, *::after': {
            boxSizing: 'border-box',
          },
          html: {
            width: '100%',
            height: '100%',
          },
          body: {
            width: '100%',
            height: '100%',
            backgroundColor: isDark ? '#0b1220' : '#f3f4f6',
            color: isDark ? '#f8fafc' : '#111827',
            margin: 0,
          },
          '#root': {
            minHeight: '100vh',
            width: '100%',
          },
        },
      },
      MuiAppBar: {
        styleOverrides: {
          root: {
            backgroundImage: 'none',
            boxShadow: 'none',
          },
        },
      },
      MuiPaper: {
        styleOverrides: {
          root: {
            backgroundImage: 'none',
            border: `1px solid ${isDark ? '#243041' : '#e5e7eb'}`,
            boxShadow: isDark ? '0 1px 2px rgba(2, 6, 23, 0.4)' : '0 1px 2px rgba(15, 23, 42, 0.04)',
          },
        },
      },
      MuiButton: {
        defaultProps: {
          disableElevation: true,
        },
        styleOverrides: {
          root: {
            minHeight: 44,
            borderRadius: 8,
            paddingInline: 16,
            paddingBlock: 0,
            boxSizing: 'border-box',
          },
          contained: {
            backgroundColor: isDark ? '#f8fafc' : '#111827',
            color: isDark ? '#0f172a' : '#ffffff',
            '&:hover': {
              backgroundColor: isDark ? '#e2e8f0' : '#1f2937',
            },
          },
          outlined: {
            borderColor: isDark ? '#334155' : '#d1d5db',
            color: isDark ? '#f8fafc' : '#111827',
            '&:hover': {
              borderColor: isDark ? '#475569' : '#9ca3af',
              backgroundColor: alpha(isDark ? '#f8fafc' : '#111827', 0.03),
            },
          },
          text: {
            '&:hover': {
              backgroundColor: alpha(isDark ? '#f8fafc' : '#111827', 0.04),
            },
          },
        },
      },
      MuiChip: {
        styleOverrides: {
          root: {
            borderRadius: 999,
            backgroundColor: isDark ? '#172033' : '#f3f4f6',
            color: isDark ? '#e2e8f0' : '#374151',
            border: `1px solid ${isDark ? '#243041' : '#e5e7eb'}`,
          },
        },
      },
      MuiOutlinedInput: {
        styleOverrides: {
          root: {
            borderRadius: 8,
            backgroundColor: isDark ? '#0f172a' : '#ffffff',
            '& fieldset': {
              borderColor: isDark ? '#334155' : '#d1d5db',
            },
            '&:hover fieldset': {
              borderColor: isDark ? '#475569' : '#9ca3af',
            },
            '&.Mui-focused fieldset': {
              borderColor: isDark ? '#f8fafc' : '#111827',
              borderWidth: 1,
            },
          },
          input: {
            paddingTop: 12,
            paddingBottom: 12,
          },
        },
      },
      MuiDialog: {
        styleOverrides: {
          paper: {
            borderRadius: 10,
            border: `1px solid ${isDark ? '#243041' : '#e5e7eb'}`,
            boxShadow: '0 20px 60px rgba(15, 23, 42, 0.18)',
          },
        },
      },
      MuiTabs: {
        styleOverrides: {
          indicator: {
            height: 2,
            borderRadius: 999,
            backgroundColor: isDark ? '#f8fafc' : '#111827',
          },
        },
      },
      MuiTab: {
        styleOverrides: {
          root: {
            textTransform: 'none',
            minHeight: 44,
            paddingInline: 16,
            paddingBlock: 0,
            boxSizing: 'border-box',
          },
        },
      },
      MuiAlert: {
        styleOverrides: {
          root: {
            borderRadius: 8,
          },
        },
      },
    },
  });
}
