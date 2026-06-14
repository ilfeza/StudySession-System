import { Box, Paper, Stack, Typography } from '@mui/material';
import { alpha } from '@mui/material/styles';
import type { ReactNode, Ref } from 'react';

export function SessionSidePanel({
  title,
  subtitle,
  children,
  footer,
  contentRef,
}: {
  title: string;
  subtitle?: string;
  children: ReactNode;
  footer?: ReactNode;
  contentRef?: Ref<HTMLDivElement>;
}) {
  return (
    <Paper
      sx={{
        p: 2,
        height: '100%',
        minHeight: 0,
        display: 'flex',
        flexDirection: 'column',
        gap: 1.5,
        borderRadius: 0,
        border: 'none',
        boxShadow: 'none',
        backgroundColor: 'transparent',
      }}
    >
      <Stack spacing={0.25} sx={{ flexShrink: 0 }}>
        <Typography variant="subtitle1" sx={{ fontWeight: 700, color: '#f8fafc' }}>
          {title}
        </Typography>
        {subtitle ? (
          <Typography variant="caption" sx={{ color: alpha('#f8fafc', 0.62) }}>
            {subtitle}
          </Typography>
        ) : null}
      </Stack>

      <Box
        ref={contentRef}
        sx={{
          flex: 1,
          minHeight: 0,
          overflowY: 'auto',
          borderRadius: 2,
          px: 1.5,
          py: 1.5,
          backgroundColor: alpha('#020617', 0.42),
          border: '1px solid',
          borderColor: alpha('#ffffff', 0.1),
          boxShadow: 'inset 0 1px 2px rgba(0, 0, 0, 0.2)',
        }}
      >
        {children}
      </Box>

      {footer ? <Box sx={{ flexShrink: 0, pt: 0.5 }}>{footer}</Box> : null}
    </Paper>
  );
}

export const sessionPanelFieldSx = {
  '& .MuiOutlinedInput-root': {
    borderRadius: 2,
    backgroundColor: alpha('#020617', 0.5),
    color: '#f8fafc',
    '& fieldset': { borderColor: alpha('#ffffff', 0.14) },
    '&:hover fieldset': { borderColor: alpha('#ffffff', 0.22) },
    '&.Mui-focused fieldset': { borderColor: alpha('#60a5fa', 0.6) },
  },
  '& .MuiInputLabel-root': { color: alpha('#f8fafc', 0.62) },
  '& .MuiInputLabel-root.Mui-focused': { color: alpha('#60a5fa', 0.88) },
  '& .MuiSelect-icon': { color: alpha('#f8fafc', 0.62) },
  '& .MuiInputBase-input::placeholder': { color: alpha('#f8fafc', 0.45), opacity: 1 },
} as const;

export function SessionPanelCard({
  children,
  onClick,
}: {
  children: ReactNode;
  onClick?: () => void;
}) {
  return (
    <Box
      onClick={onClick}
      sx={{
        p: 1.25,
        borderRadius: 2,
        backgroundColor: alpha('#ffffff', 0.08),
        border: '1px solid',
        borderColor: alpha('#ffffff', 0.12),
        cursor: onClick ? 'pointer' : 'default',
        transition: 'background-color 160ms ease, border-color 160ms ease',
        '&:hover': onClick
          ? { backgroundColor: alpha('#ffffff', 0.12), borderColor: alpha('#ffffff', 0.2) }
          : undefined,
      }}
    >
      {children}
    </Box>
  );
}
