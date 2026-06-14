import { Box, type SxProps, type Theme } from '@mui/material';

type StudySessionLogoProps = {
  size?: number;
  sx?: SxProps<Theme>;
};

export function StudySessionLogo({ size = 42, sx }: StudySessionLogoProps) {
  return (
    <Box
      component="svg"
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 64 64"
      fill="none"
      aria-hidden
      sx={{ width: size, height: size, flexShrink: 0, display: 'block', ...sx }}
    >
      <rect width="64" height="64" rx="14" fill="currentColor" />
      <path d="M18 22h28v6H18V22zm0 10h20v6H18v-6zm0 10h24v6H18v-6z" fill="#ffffff" />
      <circle cx="46" cy="46" r="8" fill="#3b82f6" />
    </Box>
  );
}
