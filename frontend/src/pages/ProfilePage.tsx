import InsightsRoundedIcon from '@mui/icons-material/InsightsRounded';
import TaskAltRoundedIcon from '@mui/icons-material/TaskAltRounded';
import VideoCameraFrontRoundedIcon from '@mui/icons-material/VideoCameraFrontRounded';
import { Alert, Paper, Stack, Typography } from '@mui/material';
import { useEffect, useState } from 'react';

import { api } from '../api/client';
import type { UserProgress } from '../types';

export function ProfilePage() {
  const [progress, setProgress] = useState<UserProgress | null>(null);
  const [error, setError] = useState('');

  useEffect(() => {
    api.get<UserProgress>('/users/me/progress')
      .then((response) => setProgress(response.data))
      .catch((err: unknown) => setError(err instanceof Error ? err.message : 'Не удалось загрузить профиль.'));
  }, []);

  return (
    <Stack spacing={2}>
      <Paper sx={{ p: 3, borderRadius: 5 }}>
        <Typography variant="h4" fontWeight={900}>Профиль пользователя</Typography>
        <Typography color="text.secondary" sx={{ mt: 0.75 }}>
          Личная статистика по учебным видеосессиям и задачам.
        </Typography>
      </Paper>

      {error ? <Alert severity="warning">{error}</Alert> : null}

      {progress ? (
        <>
          <Paper sx={{ p: 3, borderRadius: 5 }}>
            <Typography variant="h5" fontWeight={800}>{progress.full_name}</Typography>
            <Typography color="text.secondary">{progress.email}</Typography>
          </Paper>
          <Stack direction={{ xs: 'column', md: 'row' }} spacing={2}>
            <Paper sx={{ p: 2.5, flex: 1, borderRadius: 5 }}>
              <Stack direction="row" spacing={1} alignItems="center">
                <VideoCameraFrontRoundedIcon color="primary" />
                <Typography variant="h6" fontWeight={800}>Сессии</Typography>
              </Stack>
              <Typography variant="h3" fontWeight={900} sx={{ mt: 1.5 }}>{progress.sessions_attended}</Typography>
              <Typography color="text.secondary">Посещено учебных сессий</Typography>
            </Paper>
            <Paper sx={{ p: 2.5, flex: 1, borderRadius: 5 }}>
              <Stack direction="row" spacing={1} alignItems="center">
                <InsightsRoundedIcon color="primary" />
                <Typography variant="h6" fontWeight={800}>Создано задач</Typography>
              </Stack>
              <Typography variant="h3" fontWeight={900} sx={{ mt: 1.5 }}>{progress.tasks_created}</Typography>
              <Typography color="text.secondary">Сформулированных задач в системе</Typography>
            </Paper>
            <Paper sx={{ p: 2.5, flex: 1, borderRadius: 5 }}>
              <Stack direction="row" spacing={1} alignItems="center">
                <TaskAltRoundedIcon color="primary" />
                <Typography variant="h6" fontWeight={800}>Выполнено задач</Typography>
              </Stack>
              <Typography variant="h3" fontWeight={900} sx={{ mt: 1.5 }}>{progress.tasks_completed}</Typography>
              <Typography color="text.secondary">Завершённых задач с назначением на пользователя</Typography>
            </Paper>
          </Stack>
        </>
      ) : null}
    </Stack>
  );
}
