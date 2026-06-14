import { alpha, createTheme } from '@mui/material/styles';
import type { PaletteMode } from '@mui/material';

export function createAppTheme(mode: PaletteMode) {
  const isDark = mode === 'dark';

  return createTheme({
    palette: {
      mode,
      primary: {
        main: isDark ? '#93c5fd' : '#2563eb',
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
      h1: { fontSize: '2.25rem', fontWeight: 700, letterSpacing: '-0.03em', lineHeight: 1.2 },
      h2: { fontSize: '1.875rem', fontWeight: 700, letterSpacing: '-0.03em', lineHeight: 1.25 },
      h3: { fontSize: '1.625rem', fontWeight: 700, letterSpacing: '-0.02em', lineHeight: 1.3 },
      h4: { fontSize: '1.375rem', fontWeight: 700, letterSpacing: '-0.02em', lineHeight: 1.35 },
      h5: { fontSize: '1.125rem', fontWeight: 700, letterSpacing: '-0.01em', lineHeight: 1.4 },
      h6: { fontSize: '1rem', fontWeight: 600, lineHeight: 1.45 },
      subtitle1: { fontSize: '0.9375rem', fontWeight: 600, lineHeight: 1.5 },
      subtitle2: { fontSize: '0.875rem', fontWeight: 600, lineHeight: 1.5 },
      body1: { fontSize: '0.9375rem', lineHeight: 1.6 },
      body2: { fontSize: '0.875rem', lineHeight: 1.55 },
      caption: { fontSize: '0.8125rem', lineHeight: 1.45 },
      button: { fontSize: '0.9375rem', fontWeight: 600, textTransform: 'none', lineHeight: 1.2 },
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
          size: 'medium',
        },
        styleOverrides: {
          root: {
            minHeight: 44,
            minWidth: 44,
            borderRadius: 8,
            paddingInline: 16,
            paddingBlock: 0,
            boxSizing: 'border-box',
            fontSize: '0.9375rem',
            fontWeight: 600,
          },
          contained: {
            backgroundColor: isDark ? '#2563eb' : '#2563eb',
            color: '#ffffff',
            border: '1px solid transparent',
            '&:hover': {
              backgroundColor: isDark ? '#1d4ed8' : '#1d4ed8',
            },
          },
          outlined: {
            borderWidth: 1,
            borderColor: 'transparent',
            color: isDark ? '#e2e8f0' : '#374151',
            backgroundColor: isDark ? alpha('#ffffff', 0.04) : alpha('#2563eb', 0.04),
            '&:hover': {
              borderColor: isDark ? alpha('#93c5fd', 0.45) : alpha('#2563eb', 0.35),
              backgroundColor: isDark ? alpha('#ffffff', 0.08) : alpha('#2563eb', 0.08),
            },
          },
          outlinedError: {
            borderColor: 'transparent',
            '&:hover': {
              borderColor: alpha('#ef4444', 0.45),
            },
          },
          text: {
            '&:hover': {
              backgroundColor: alpha(isDark ? '#f8fafc' : '#111827', 0.04),
            },
          },
          sizeSmall: {
            minHeight: 44,
            paddingInline: 16,
            fontSize: '0.9375rem',
          },
          sizeLarge: {
            minHeight: 44,
            paddingInline: 16,
            fontSize: '0.9375rem',
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
            fontSize: '0.8125rem',
          },
        },
      },
      MuiOutlinedInput: {
        styleOverrides: {
          root: {
            borderRadius: 8,
            backgroundColor: isDark ? '#0f172a' : '#ffffff',
            minHeight: 44,
            '& fieldset': {
              borderColor: isDark ? '#334155' : '#d1d5db',
            },
            '&:hover fieldset': {
              borderColor: isDark ? '#475569' : '#9ca3af',
            },
            '&.Mui-focused fieldset': {
              borderColor: isDark ? '#f8fafc' : '#2563eb',
              borderWidth: 1,
            },
          },
          input: {
            padding: '11px 14px',
            boxSizing: 'border-box',
            height: '44px',
            display: 'flex',
            alignItems: 'center',
            fontSize: '0.9375rem',
          },
          inputMultiline: {
            height: 'auto',
            minHeight: '88px',
            alignItems: 'flex-start',
            paddingTop: 12,
            paddingBottom: 12,
          },
        },
      },
      MuiInputLabel: {
        styleOverrides: {
          root: {
            fontSize: '0.9375rem',
            transform: 'translate(14px, 12px) scale(1)',
            '&.MuiInputLabel-shrink': {
              transform: 'translate(14px, -9px) scale(0.75)',
            },
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
            backgroundColor: isDark ? '#f8fafc' : '#2563eb',
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
            fontSize: '0.9375rem',
            fontWeight: 600,
          },
        },
      },
      MuiAlert: {
        styleOverrides: {
          root: {
            borderRadius: 8,
            fontSize: '0.9375rem',
          },
          standardInfo: {
            backgroundColor: isDark ? '#172033' : undefined,
          },
        },
      },
      MuiDrawer: {
        styleOverrides: {
          paper: {
            backgroundColor: isDark ? '#111827' : '#ffffff',
          },
        },
      },
      MuiToggleButtonGroup: {
        styleOverrides: {
          root: {
            backgroundColor: isDark ? '#0f172a' : '#f9fafb',
          },
        },
      },
      MuiToggleButton: {
        styleOverrides: {
          root: {
            color: isDark ? '#94a3b8' : '#6b7280',
            minHeight: 44,
            fontSize: '0.9375rem',
            '&.Mui-selected': {
              backgroundColor: isDark ? '#1e293b' : '#ffffff',
              color: isDark ? '#f8fafc' : '#111827',
            },
          },
        },
      },
      MuiListItemButton: {
        styleOverrides: {
          root: {
            minHeight: 44,
            borderRadius: 8,
            '&.Mui-selected': {
              backgroundColor: isDark ? alpha('#2563eb', 0.22) : alpha('#2563eb', 0.1),
            },
          },
        },
      },
      MuiListItemText: {
        styleOverrides: {
          primary: {
            fontSize: '0.9375rem',
            fontWeight: 600,
          },
          secondary: {
            fontSize: '0.8125rem',
          },
        },
      },
    },
  });
}
