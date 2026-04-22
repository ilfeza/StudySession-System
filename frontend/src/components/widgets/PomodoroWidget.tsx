import AccessTimeRoundedIcon from '@mui/icons-material/AccessTimeRounded';
import BuildRoundedIcon from '@mui/icons-material/BuildRounded';
import PauseRoundedIcon from '@mui/icons-material/PauseRounded';
import PlayArrowRoundedIcon from '@mui/icons-material/PlayArrowRounded';
import ReplayRoundedIcon from '@mui/icons-material/ReplayRounded';
import SkipNextRoundedIcon from '@mui/icons-material/SkipNextRounded';
import {
  Box,
  Button,
  Chip,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Divider,
  Paper,
  Stack,
  TextField,
  Typography,
} from '@mui/material';
import { alpha } from '@mui/material/styles';
import { useEffect, useMemo, useState } from 'react';

import type { PomodoroDurations, PomodoroStateSnapshot } from '../../types/pomodoro';
import { computeRemainingSeconds, formatMMSS, phaseLabel } from './pomodoroTime';

function clampInt(value: number, min: number, max: number) {
  const next = Math.round(Number(value));
  if (Number.isNaN(next)) return min;
  return Math.max(min, Math.min(max, next));
}

function phaseColor(phase: PomodoroStateSnapshot['phase']) {
  if (phase === 'focus') return { bg: alpha('#3384ff', 0.22), border: alpha('#3384ff', 0.35), text: '#9ec3ff' };
  if (phase === 'short_break') return { bg: alpha('#22c55e', 0.18), border: alpha('#22c55e', 0.32), text: '#92f2ba' };
  return { bg: alpha('#f59e0b', 0.16), border: alpha('#f59e0b', 0.32), text: '#ffd38a' };
}

// computeRemainingSeconds/formatMMSS/phaseLabel moved to pomodoroTime.ts

export function PomodoroWidget({
  snapshot,
  localUserName,
  onStart,
  onPause,
  onResume,
  onSkip,
  onReset,
  onClaimControl,
}: {
  snapshot: PomodoroStateSnapshot;
  localUserName: string;
  onStart: (durations: PomodoroDurations) => void;
  onPause: () => void;
  onResume: () => void;
  onSkip: () => void;
  onReset: () => void;
  onClaimControl: () => void;
}) {
  const [now, setNow] = useState(() => Date.now());
  const [settingsOpen, setSettingsOpen] = useState(false);

  useEffect(() => {
    const id = window.setInterval(() => setNow(Date.now()), 250);
    return () => window.clearInterval(id);
  }, []);

  const remaining = useMemo(() => computeRemainingSeconds(snapshot, now), [snapshot, now]);
  const phaseUi = phaseColor(snapshot.phase);
  const controllerName = snapshot.controller.name?.trim() ? snapshot.controller.name : '—';
  const isController = snapshot.controller.name?.trim() && snapshot.controller.name === localUserName;

  const canControl = Boolean(snapshot.enabled) && isController;
  const showClaimControl = Boolean(snapshot.enabled) && !isController;

  const initial = snapshot.durations;
  const [focusMin, setFocusMin] = useState(Math.round(initial.focus_duration_s / 60));
  const [shortBreakMin, setShortBreakMin] = useState(Math.round(initial.short_break_duration_s / 60));
  const [longBreakMin, setLongBreakMin] = useState(Math.round(initial.long_break_duration_s / 60));
  const [cyclesBeforeLong, setCyclesBeforeLong] = useState(initial.cycles_before_long_break);

  useEffect(() => {
    setFocusMin(Math.round(snapshot.durations.focus_duration_s / 60));
    setShortBreakMin(Math.round(snapshot.durations.short_break_duration_s / 60));
    setLongBreakMin(Math.round(snapshot.durations.long_break_duration_s / 60));
    setCyclesBeforeLong(snapshot.durations.cycles_before_long_break);
  }, [
    snapshot.durations.focus_duration_s,
    snapshot.durations.short_break_duration_s,
    snapshot.durations.long_break_duration_s,
    snapshot.durations.cycles_before_long_break,
  ]);

  const startClassic = () => {
    onStart({
      focus_duration_s: 25 * 60,
      short_break_duration_s: 5 * 60,
      long_break_duration_s: 15 * 60,
      cycles_before_long_break: 4,
    });
  };

  const startCustom = () => {
    const focus = clampInt(focusMin, 5, 180);
    const shortBreak = clampInt(shortBreakMin, 1, 60);
    const longBreak = clampInt(longBreakMin, 1, 90);
    const cycles = clampInt(cyclesBeforeLong, 2, 10);
    onStart({
      focus_duration_s: focus * 60,
      short_break_duration_s: shortBreak * 60,
      long_break_duration_s: longBreak * 60,
      cycles_before_long_break: cycles,
    });
    setSettingsOpen(false);
  };

  return (
    <Paper
      sx={{
        p: 2,
        borderRadius: 4,
        background: alpha('#08111f', 0.9),
        border: `1px solid ${alpha('#ffffff', 0.08)}`,
      }}
    >
      <Stack spacing={1.5}>
        <Stack direction="row" spacing={1.25} alignItems="center" justifyContent="space-between">
          <Stack direction="row" spacing={1.1} alignItems="center">
            <Box
              sx={{
                width: 42,
                height: 42,
                borderRadius: 3,
                display: 'grid',
                placeItems: 'center',
                color: '#ffffff',
                background: alpha('#3384ff', 0.22),
                border: `1px solid ${alpha('#3384ff', 0.25)}`,
              }}
            >
              <AccessTimeRoundedIcon />
            </Box>
            <Box>
              <Typography fontWeight={900} color="#ffffff">
                Pomodoro
              </Typography>
              <Typography variant="caption" sx={{ color: alpha('#ffffff', 0.62) }}>
                Общий таймер для всей комнаты
              </Typography>
            </Box>
          </Stack>

          <Chip
            label={snapshot.enabled ? phaseLabel(snapshot.phase) : 'Выключен'}
            size="small"
            sx={{
              borderRadius: 999,
              color: snapshot.enabled ? phaseUi.text : alpha('#ffffff', 0.65),
              backgroundColor: snapshot.enabled ? phaseUi.bg : alpha('#ffffff', 0.06),
              border: `1px solid ${snapshot.enabled ? phaseUi.border : alpha('#ffffff', 0.1)}`,
            }}
          />
        </Stack>

        <Box
          sx={{
            p: 1.75,
            borderRadius: 4,
            background: alpha('#ffffff', 0.03),
            border: `1px solid ${alpha('#ffffff', 0.06)}`,
            display: 'grid',
            gap: 0.5,
          }}
        >
          <Typography variant="caption" sx={{ color: alpha('#ffffff', 0.62) }}>
            Осталось
          </Typography>
          <Typography
            sx={{
              fontSize: { xs: '2.4rem', md: '2.8rem' },
              fontWeight: 950,
              letterSpacing: '-0.04em',
              color: '#ffffff',
            }}
          >
            {formatMMSS(remaining)}
          </Typography>
          {snapshot.enabled ? (
            <Typography variant="body2" sx={{ color: alpha('#ffffff', 0.72) }}>
              Управляет: <Box component="span" sx={{ color: '#ffffff', fontWeight: 800 }}>{controllerName}</Box>
            </Typography>
          ) : (
            <Typography variant="body2" sx={{ color: alpha('#ffffff', 0.72) }}>
              Нажмите «Быстрый старт», чтобы включить таймер всем.
            </Typography>
          )}
        </Box>

        <Divider sx={{ borderColor: alpha('#ffffff', 0.08) }} />

        {!snapshot.enabled ? (
          <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1}>
            <Button
              fullWidth
              variant="contained"
              startIcon={<PlayArrowRoundedIcon />}
              onClick={startClassic}
              sx={{
                borderRadius: 3,
                fontWeight: 900,
                background: 'linear-gradient(135deg, #3384ff 0%, #1d6eff 100%)',
              }}
            >
              Быстрый 25/5
            </Button>
            <Button
              fullWidth
              variant="outlined"
              startIcon={<BuildRoundedIcon />}
              onClick={() => setSettingsOpen(true)}
              sx={{
                borderRadius: 3,
                fontWeight: 800,
                color: '#ffffff',
                borderColor: alpha('#ffffff', 0.18),
                background: alpha('#ffffff', 0.03),
              }}
            >
              Настроить…
            </Button>
          </Stack>
        ) : (
          <Stack spacing={1.1}>
            <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1}>
              {snapshot.running ? (
                <Button
                  fullWidth
                  variant="outlined"
                  startIcon={<PauseRoundedIcon />}
                  disabled={!canControl}
                  onClick={onPause}
                  sx={{
                    borderRadius: 3,
                    fontWeight: 800,
                    color: '#ffffff',
                    borderColor: alpha('#ffffff', 0.18),
                    background: alpha('#ffffff', 0.03),
                  }}
                >
                  Пауза
                </Button>
              ) : (
                <Button
                  fullWidth
                  variant="contained"
                  startIcon={<PlayArrowRoundedIcon />}
                  disabled={!canControl}
                  onClick={onResume}
                  sx={{
                    borderRadius: 3,
                    fontWeight: 900,
                    background: 'linear-gradient(135deg, #22c55e 0%, #16a34a 100%)',
                  }}
                >
                  Продолжить
                </Button>
              )}

              <Button
                fullWidth
                variant="outlined"
                startIcon={<SkipNextRoundedIcon />}
                disabled={!canControl}
                onClick={onSkip}
                sx={{
                  borderRadius: 3,
                  fontWeight: 800,
                  color: '#ffffff',
                  borderColor: alpha('#ffffff', 0.18),
                  background: alpha('#ffffff', 0.03),
                }}
              >
                Пропустить этап
              </Button>
            </Stack>

            <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1}>
              <Button
                fullWidth
                variant="outlined"
                startIcon={<ReplayRoundedIcon />}
                disabled={!canControl}
                onClick={onReset}
                sx={{
                  borderRadius: 3,
                  fontWeight: 800,
                  color: alpha('#ffffff', 0.9),
                  borderColor: alpha('#ffffff', 0.16),
                  background: alpha('#ffffff', 0.02),
                }}
              >
                Выключить у всех
              </Button>
              {showClaimControl ? (
                <Button
                  fullWidth
                  variant="contained"
                  onClick={onClaimControl}
                  sx={{
                    borderRadius: 3,
                    fontWeight: 900,
                    background: 'linear-gradient(135deg, #3384ff 0%, #1d6eff 100%)',
                  }}
                >
                  Взять управление
                </Button>
              ) : null}
            </Stack>

            {!canControl ? (
              <Typography variant="caption" sx={{ color: alpha('#ffffff', 0.6) }}>
                Управление доступно только пользователю, который включил таймер.
              </Typography>
            ) : null}
          </Stack>
        )}
      </Stack>

      <Dialog open={settingsOpen} onClose={() => setSettingsOpen(false)} fullWidth maxWidth="sm">
        <DialogTitle>Настроить Pomodoro</DialogTitle>
        <DialogContent>
          <Stack spacing={2} sx={{ mt: 1 }}>
            <TextField
              label="Фокус (мин)"
              type="number"
              value={focusMin}
              onChange={(event) => setFocusMin(Number(event.target.value))}
              inputProps={{ min: 5, max: 180 }}
              fullWidth
            />
            <TextField
              label="Перерыв (мин)"
              type="number"
              value={shortBreakMin}
              onChange={(event) => setShortBreakMin(Number(event.target.value))}
              inputProps={{ min: 1, max: 60 }}
              fullWidth
            />
            <TextField
              label="Длинный перерыв (мин)"
              type="number"
              value={longBreakMin}
              onChange={(event) => setLongBreakMin(Number(event.target.value))}
              inputProps={{ min: 1, max: 90 }}
              fullWidth
            />
            <TextField
              label="Длинный перерыв после (циклов)"
              type="number"
              value={cyclesBeforeLong}
              onChange={(event) => setCyclesBeforeLong(Number(event.target.value))}
              inputProps={{ min: 2, max: 10 }}
              fullWidth
            />
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setSettingsOpen(false)}>Отмена</Button>
          <Button variant="contained" onClick={startCustom}>
            Запустить всем
          </Button>
        </DialogActions>
      </Dialog>
    </Paper>
  );
}

