import { LinearProgress, Paper, Stack, Typography } from '@mui/material';

import type { SessionTasksController } from '../../../components/tasks/useSessionTasks';

export function SessionAnalyticsPanel({ controller }: { controller: SessionTasksController }) {
  const metrics = controller.dashboard?.metrics;

  return (
    <Paper sx={{ p: { xs: 2, md: 2.5 }, borderRadius: 4, backgroundColor: '#ffffff' }}>
      <Stack spacing={2}>
        <Stack spacing={0.5}>
          <Typography variant="h5">Аналитика</Typography>
          <Typography variant="body2" color="text.secondary">
            Сводка по задачам, прогрессу и командной загрузке в реальном времени.
          </Typography>
        </Stack>

        <Stack direction={{ xs: 'column', md: 'row' }} spacing={1.5}>
          <Paper sx={{ p: 2, borderRadius: 3, flex: 1, bgcolor: '#f9fafb' }}>
            <Typography variant="caption" color="text.secondary">Всего задач</Typography>
            <Typography variant="h4" sx={{ mt: 0.5 }}>{metrics?.total_tasks ?? controller.tasks.length}</Typography>
          </Paper>
          <Paper sx={{ p: 2, borderRadius: 3, flex: 1, bgcolor: '#f9fafb' }}>
            <Typography variant="caption" color="text.secondary">Завершено</Typography>
            <Typography variant="h4" sx={{ mt: 0.5 }}>{metrics?.completed_tasks ?? 0}</Typography>
          </Paper>
          <Paper sx={{ p: 2, borderRadius: 3, flex: 1, bgcolor: '#f9fafb' }}>
            <Typography variant="caption" color="text.secondary">В процессе</Typography>
            <Typography variant="h4" sx={{ mt: 0.5 }}>{metrics?.in_progress_tasks ?? 0}</Typography>
          </Paper>
          <Paper sx={{ p: 2, borderRadius: 3, flex: 1, bgcolor: '#f9fafb' }}>
            <Typography variant="caption" color="text.secondary">Заблокировано</Typography>
            <Typography variant="h4" sx={{ mt: 0.5 }}>{metrics?.blocked_tasks ?? 0}</Typography>
          </Paper>
        </Stack>

        <Paper sx={{ p: 2, borderRadius: 3, bgcolor: '#f9fafb' }}>
          <Stack spacing={1}>
            <Stack direction="row" justifyContent="space-between" alignItems="center">
              <Typography variant="subtitle2">Completion Rate</Typography>
              <Typography variant="subtitle2">{metrics?.completion_rate ?? 0}%</Typography>
            </Stack>
            <LinearProgress variant="determinate" value={metrics?.completion_rate ?? 0} sx={{ height: 8, borderRadius: 999 }} />
          </Stack>
        </Paper>

        <Stack direction={{ xs: 'column', md: 'row' }} spacing={1.5}>
          <Paper sx={{ p: 2, borderRadius: 3, flex: 1, bgcolor: '#f9fafb' }}>
            <Typography variant="caption" color="text.secondary">Средняя загрузка команды</Typography>
            <Typography variant="h4" sx={{ mt: 0.5 }}>{metrics ? `${metrics.average_load_percent}%` : '0%'}</Typography>
          </Paper>
          <Paper sx={{ p: 2, borderRadius: 3, flex: 1, bgcolor: '#f9fafb' }}>
            <Typography variant="caption" color="text.secondary">Самый загруженный</Typography>
            <Typography variant="h6" sx={{ mt: 0.5 }}>
              {metrics?.most_loaded_participant?.full_name ?? 'Нет данных'}
            </Typography>
          </Paper>
          <Paper sx={{ p: 2, borderRadius: 3, flex: 1, bgcolor: '#f9fafb' }}>
            <Typography variant="caption" color="text.secondary">Самый свободный</Typography>
            <Typography variant="h6" sx={{ mt: 0.5 }}>
              {metrics?.least_loaded_participant?.full_name ?? 'Нет данных'}
            </Typography>
          </Paper>
        </Stack>
      </Stack>
    </Paper>
  );
}
