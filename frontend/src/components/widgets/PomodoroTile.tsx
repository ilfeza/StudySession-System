import PauseRoundedIcon from '@mui/icons-material/PauseRounded';
import PlayArrowRoundedIcon from '@mui/icons-material/PlayArrowRounded';
import SkipNextRoundedIcon from '@mui/icons-material/SkipNextRounded';
import { Box, IconButton, Stack, Typography } from '@mui/material';
import { alpha } from '@mui/material/styles';
import { useEffect, useMemo, useState } from 'react';

import type { PomodoroStateSnapshot } from '../../types/pomodoro';
import { computeRemainingSeconds, formatMMSS, phaseLabel } from './pomodoroTime';

function phaseAccent(phase: PomodoroStateSnapshot['phase']) {
  if (phase === 'focus') return { base: '#3384ff', soft: alpha('#3384ff', 0.22) };
  if (phase === 'short_break') return { base: '#22c55e', soft: alpha('#22c55e', 0.18) };
  return { base: '#f59e0b', soft: alpha('#f59e0b', 0.16) };
}

export function PomodoroTile({
  snapshot,
  localUserName,
  onPause,
  onResume,
  onSkip,
}: {
  snapshot: PomodoroStateSnapshot;
  localUserName: string;
  onPause: () => void;
  onResume: () => void;
  onSkip: () => void;
}) {
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    const id = window.setInterval(() => setNow(Date.now()), 250);
    return () => window.clearInterval(id);
  }, []);

  const remaining = useMemo(() => computeRemainingSeconds(snapshot, now), [snapshot, now]);
  const accent = phaseAccent(snapshot.phase);
  const controllerName = snapshot.controller.name?.trim() ? snapshot.controller.name : '—';
  const isController = snapshot.controller.name?.trim() && snapshot.controller.name === localUserName;

  const iconButtonSx = {
    width: 42,
    height: 42,
    borderRadius: 3,
    color: '#ffffff',
    backgroundColor: alpha('#ffffff', 0.06),
    border: `1px solid ${alpha('#ffffff', 0.08)}`,
    '&:hover': { backgroundColor: alpha('#ffffff', 0.1) },
    '&:disabled': { color: alpha('#ffffff', 0.35) },
  };

  return (
    <Box
      sx={{
        height: '100%',
        p: 2,
        display: 'grid',
        gridTemplateRows: 'auto 1fr auto',
        gap: 1.25,
        borderRadius: 5,
        background: 'linear-gradient(180deg, #162237 0%, #08111f 55%, #050913 100%)',
        border: `1px solid ${alpha('#ffffff', 0.08)}`,
      }}
    >
      <Stack direction="row" spacing={1} alignItems="center" justifyContent="space-between">
        <Stack spacing={0.2}>
          <Typography fontWeight={950} sx={{ color: '#ffffff', lineHeight: 1.05 }}>
            Pomodoro
          </Typography>
          <Typography variant="caption" sx={{ color: alpha('#ffffff', 0.7) }}>
            {phaseLabel(snapshot.phase)}
          </Typography>
        </Stack>

        <Box
          sx={{
            px: 1.2,
            py: 0.55,
            borderRadius: 999,
            fontSize: '0.75rem',
            fontWeight: 900,
            color: '#ffffff',
            background: accent.soft,
            border: `1px solid ${alpha(accent.base, 0.35)}`,
          }}
        >
          {formatMMSS(remaining)}
        </Box>
      </Stack>

      <Box sx={{ alignSelf: 'center' }}>
        <Typography
          sx={{
            fontSize: { xs: '2.6rem', md: '3rem' },
            fontWeight: 950,
            letterSpacing: '-0.05em',
            color: '#ffffff',
            textAlign: 'center',
          }}
        >
          {formatMMSS(remaining)}
        </Typography>
        <Typography variant="body2" sx={{ textAlign: 'center', color: alpha('#ffffff', 0.72) }}>
          Управляет: <Box component="span" sx={{ color: '#ffffff', fontWeight: 900 }}>{controllerName}</Box>
        </Typography>
      </Box>

      <Stack direction="row" spacing={1} justifyContent="center">
        {snapshot.running ? (
          <IconButton onClick={onPause} disabled={!isController} sx={iconButtonSx} title="Пауза">
            <PauseRoundedIcon />
          </IconButton>
        ) : (
          <IconButton onClick={onResume} disabled={!isController} sx={iconButtonSx} title="Продолжить">
            <PlayArrowRoundedIcon />
          </IconButton>
        )}
        <IconButton onClick={onSkip} disabled={!isController} sx={iconButtonSx} title="Пропустить этап">
          <SkipNextRoundedIcon />
        </IconButton>
      </Stack>
    </Box>
  );
}

