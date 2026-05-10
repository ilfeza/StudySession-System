import { LinearProgress, Paper, Stack, Typography } from '@mui/material';
import { useMemo } from 'react';

import type { SessionTasksController } from '../../../components/tasks/useSessionTasks';

function averageCompletionTimeHours(createdAt: string[]) {
  if (!createdAt.length) {
    return 0;
  }
  const total = createdAt.reduce((sum, value) => sum + (Date.now() - new Date(value).getTime()), 0);
  return total / createdAt.length / 3_600_000;
}

export function SessionAnalyticsPanel({
  controller,
}: {
  controller: SessionTasksController;
}) {
  const { tasks, participants } = controller;

  const metrics = useMemo(() => {
    const completed = tasks.filter((task) => task.status === 'done');
    const completion = tasks.length ? Math.round((completed.length / tasks.length) * 100) : 0;
    return {
      totalTasks: tasks.length,
      completedTasks: completed.length,
      activeParticipants: participants.filter((participant) => participant.is_online).length,
      completion,
      averageHours: averageCompletionTimeHours(completed.map((task) => task.created_at)),
    };
  }, [participants, tasks]);

  return (
    <Paper sx={{ p: { xs: 2, md: 2.5 }, borderRadius: 4, backgroundColor: '#ffffff' }}>
      <Stack spacing={2}>
        <Stack spacing={0.5}>
          <Typography variant="h5">Аналитика</Typography>
          <Typography variant="body2" color="text.secondary">
            Компактная сводка по прогрессу сессии и текущей командной нагрузке.
          </Typography>
        </Stack>

        <Stack direction={{ xs: 'column', md: 'row' }} spacing={1.5}>
          <Paper sx={{ p: 2, borderRadius: 3, flex: 1, bgcolor: '#f9fafb' }}>
            <Typography variant="caption" color="text.secondary">Всего задач</Typography>
            <Typography variant="h4" sx={{ mt: 0.5 }}>{metrics.totalTasks}</Typography>
          </Paper>
          <Paper sx={{ p: 2, borderRadius: 3, flex: 1, bgcolor: '#f9fafb' }}>
            <Typography variant="caption" color="text.secondary">Выполнено задач</Typography>
            <Typography variant="h4" sx={{ mt: 0.5 }}>{metrics.completedTasks}</Typography>
          </Paper>
          <Paper sx={{ p: 2, borderRadius: 3, flex: 1, bgcolor: '#f9fafb' }}>
            <Typography variant="caption" color="text.secondary">Активных участников</Typography>
            <Typography variant="h4" sx={{ mt: 0.5 }}>{metrics.activeParticipants}</Typography>
          </Paper>
        </Stack>

        <Paper sx={{ p: 2, borderRadius: 3, bgcolor: '#f9fafb' }}>
          <Stack spacing={1}>
            <Stack direction="row" justifyContent="space-between" alignItems="center">
              <Typography variant="subtitle2">Процент выполнения</Typography>
              <Typography variant="subtitle2">{metrics.completion}%</Typography>
            </Stack>
            <LinearProgress variant="determinate" value={metrics.completion} sx={{ height: 8, borderRadius: 999 }} />
          </Stack>
        </Paper>

        <Paper sx={{ p: 2, borderRadius: 3, bgcolor: '#f9fafb' }}>
          <Typography variant="caption" color="text.secondary">Среднее время выполнения</Typography>
          <Typography variant="h4" sx={{ mt: 0.5 }}>
            {metrics.averageHours.toFixed(1)}h
          </Typography>
          <Typography variant="body2" color="text.secondary">
            Рассчитано по завершённым задачам текущей сессии.
          </Typography>
        </Paper>
      </Stack>
    </Paper>
  );
}
