import BuildRoundedIcon from '@mui/icons-material/BuildRounded';
import PlayArrowRoundedIcon from '@mui/icons-material/PlayArrowRounded';
import { Alert, Box, Button, Dialog, DialogActions, DialogContent, DialogTitle, Paper, Stack, TextField, Typography } from '@mui/material';
import { useEffect, useState } from 'react';

import type { PomodoroDurations, PomodoroStateSnapshot, WidgetsClientEvent } from '../../types/pomodoro';

function clampInt(value: number, min: number, max: number) {
  const next = Math.round(Number(value));
  if (Number.isNaN(next)) return min;
  return Math.max(min, Math.min(max, next));
}

export function PomodoroSettingsPanel({
  snapshot,
  localUserName,
  send,
}: {
  snapshot: PomodoroStateSnapshot | null;
  localUserName: string;
  send: (message: WidgetsClientEvent) => void;
}) {
  const [settingsOpen, setSettingsOpen] = useState(false);

  const durations = snapshot?.durations ?? {
    focus_duration_s: 25 * 60,
    short_break_duration_s: 5 * 60,
    long_break_duration_s: 15 * 60,
    cycles_before_long_break: 4,
  };

  const [focusMin, setFocusMin] = useState(Math.round(durations.focus_duration_s / 60));
  const [shortBreakMin, setShortBreakMin] = useState(Math.round(durations.short_break_duration_s / 60));
  const [longBreakMin, setLongBreakMin] = useState(Math.round(durations.long_break_duration_s / 60));
  const [cyclesBeforeLong, setCyclesBeforeLong] = useState(durations.cycles_before_long_break);

  useEffect(() => {
    setFocusMin(Math.round(durations.focus_duration_s / 60));
    setShortBreakMin(Math.round(durations.short_break_duration_s / 60));
    setLongBreakMin(Math.round(durations.long_break_duration_s / 60));
    setCyclesBeforeLong(durations.cycles_before_long_break);
  }, [durations.focus_duration_s, durations.short_break_duration_s, durations.long_break_duration_s, durations.cycles_before_long_break]);

  const controllerName = snapshot?.controller.name?.trim() ? snapshot.controller.name : '';
  const isController = Boolean(snapshot?.enabled) && controllerName === localUserName;

  const startClassic = () => {
    const classic: PomodoroDurations = {
      focus_duration_s: 25 * 60,
      short_break_duration_s: 5 * 60,
      long_break_duration_s: 15 * 60,
      cycles_before_long_break: 4,
    };
    send({ event: 'pomodoro_start', payload: { durations: classic } });
  };

  const startCustom = () => {
    const focus = clampInt(focusMin, 5, 180);
    const shortBreak = clampInt(shortBreakMin, 1, 60);
    const longBreak = clampInt(longBreakMin, 1, 90);
    const cycles = clampInt(cyclesBeforeLong, 2, 10);
    send({
      event: 'pomodoro_start',
      payload: {
        durations: {
          focus_duration_s: focus * 60,
          short_break_duration_s: shortBreak * 60,
          long_break_duration_s: longBreak * 60,
          cycles_before_long_break: cycles,
        },
      },
    });
    setSettingsOpen(false);
  };

  return (
    <Paper sx={{ p: 2.5, borderRadius: 3, bgcolor: '#f9fafb' }}>
      <Stack spacing={2}>
        <Box>
          <Typography variant="h6">Pomodoro</Typography>
          <Typography variant="body2" color="text.secondary" sx={{ mt: 0.75 }}>
            Таймер остается вторичным инструментом и не перегружает основную встречу.
          </Typography>
        </Box>

        {snapshot?.enabled ? (
          <Alert severity="info">
            Сейчас таймер включен. Управляет: <b>{snapshot.controller.name || '—'}</b>
          </Alert>
        ) : null}

        <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1}>
          <Button fullWidth variant="contained" startIcon={<PlayArrowRoundedIcon />} onClick={startClassic}>
            Быстрый 25/5
          </Button>
          <Button fullWidth variant="outlined" startIcon={<BuildRoundedIcon />} onClick={() => setSettingsOpen(true)}>
            Настроить
          </Button>
        </Stack>

        {snapshot?.enabled ? (
          <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1}>
            <Button fullWidth variant="outlined" disabled={!isController} onClick={() => send({ event: snapshot.running ? 'pomodoro_pause' : 'pomodoro_resume', payload: {} })}>
              {snapshot.running ? 'Пауза' : 'Продолжить'}
            </Button>
            <Button fullWidth variant="outlined" disabled={!isController} onClick={() => send({ event: 'pomodoro_skip_phase', payload: {} })}>
              Пропустить этап
            </Button>
            <Button fullWidth variant="outlined" disabled={!isController} onClick={() => send({ event: 'pomodoro_reset', payload: {} })}>
              Выключить
            </Button>
          </Stack>
        ) : null}
      </Stack>

      <Dialog open={settingsOpen} onClose={() => setSettingsOpen(false)} fullWidth maxWidth="sm">
        <DialogTitle>Настроить Pomodoro</DialogTitle>
        <DialogContent>
          <Stack spacing={2} sx={{ mt: 1 }}>
            <TextField label="Фокус (мин)" type="number" value={focusMin} onChange={(event) => setFocusMin(Number(event.target.value))} inputProps={{ min: 5, max: 180 }} fullWidth />
            <TextField label="Перерыв (мин)" type="number" value={shortBreakMin} onChange={(event) => setShortBreakMin(Number(event.target.value))} inputProps={{ min: 1, max: 60 }} fullWidth />
            <TextField label="Длинный перерыв (мин)" type="number" value={longBreakMin} onChange={(event) => setLongBreakMin(Number(event.target.value))} inputProps={{ min: 1, max: 90 }} fullWidth />
            <TextField label="Циклов до длинного перерыва" type="number" value={cyclesBeforeLong} onChange={(event) => setCyclesBeforeLong(Number(event.target.value))} inputProps={{ min: 2, max: 10 }} fullWidth />
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setSettingsOpen(false)}>Отмена</Button>
          <Button variant="contained" onClick={startCustom}>Запустить</Button>
        </DialogActions>
      </Dialog>
    </Paper>
  );
}
