import AnalyticsRoundedIcon from '@mui/icons-material/AnalyticsRounded';
import GroupWorkRoundedIcon from '@mui/icons-material/GroupWorkRounded';
import PeopleRoundedIcon from '@mui/icons-material/PeopleRounded';
import VideocamRoundedIcon from '@mui/icons-material/VideocamRounded';
import { Alert, Box, Chip, Paper, Stack, Typography } from '@mui/material';
import { alpha, useTheme } from '@mui/material/styles';
import { useEffect, useState } from 'react';

import { api } from '../../api/client';
import { DonutChart, HorizontalBarChart, MetricTrend } from '../../components/admin/AdminCharts';
import type { AdminAnalyticsOverview } from '../../types';

function MetricCard({ title, value, icon, accent }: { title: string; value: string | number; icon: React.ReactNode; accent?: string }) {
  const theme = useTheme();

  return (
    <Paper sx={{ p: 2.5, borderRadius: 2.5, height: '100%' }}>
      <Stack direction="row" justifyContent="space-between" alignItems="flex-start" spacing={2}>
        <Box>
          <Typography variant="body2" color="text.secondary">{title}</Typography>
          <Typography variant="h4" sx={{ mt: 0.75 }}>{value}</Typography>
        </Box>
        <Box
          sx={{
            width: 44,
            height: 44,
            borderRadius: 2,
            display: 'grid',
            placeItems: 'center',
            bgcolor: alpha(accent ?? theme.palette.text.primary, 0.08),
            color: accent ?? 'text.secondary',
          }}
        >
          {icon}
        </Box>
      </Stack>
    </Paper>
  );
}

export function AdminOverviewPage() {
  const [overview, setOverview] = useState<AdminAnalyticsOverview | null>(null);
  const [error, setError] = useState('');

  useEffect(() => {
    api.get<AdminAnalyticsOverview>('/admin/analytics')
      .then((response) => setOverview(response.data))
      .catch((err: Error) => setError(err.message || 'Не удалось загрузить аналитику.'));
  }, []);

  if (error) {
    return <Alert severity="warning">{error}</Alert>;
  }

  if (!overview) {
    return (
      <Paper sx={{ p: 3, borderRadius: 2.5 }}>
        <Typography variant="body2" color="text.secondary">Загрузка данных...</Typography>
      </Paper>
    );
  }

  const roleItems = Object.entries(overview.role_distribution).map(([label, value]) => ({ label, value }));
  const taskItems = [
    { label: 'Выполнено', value: overview.completed_tasks, color: '#10b981' },
    { label: 'В работе', value: overview.pending_tasks, color: '#f59e0b' },
  ];
  const topGroupItems = overview.top_groups.map((group) => ({
    label: group.name,
    value: group.member_count,
  }));

  return (
    <Stack spacing={2.5}>
      <Box sx={{ display: 'grid', gap: 2, gridTemplateColumns: { xs: '1fr', sm: 'repeat(2, 1fr)', lg: 'repeat(4, 1fr)' } }}>
        <MetricCard title="Пользователи" value={overview.total_users} icon={<PeopleRoundedIcon />} accent="#3b82f6" />
        <MetricCard title="Активные" value={overview.active_users} icon={<AnalyticsRoundedIcon />} accent="#10b981" />
        <MetricCard title="Группы" value={overview.total_groups} icon={<GroupWorkRoundedIcon />} accent="#6366f1" />
        <MetricCard title="Сессии" value={overview.active_sessions} icon={<VideocamRoundedIcon />} accent="#f59e0b" />
      </Box>

      <Box sx={{ display: 'grid', gap: 2, gridTemplateColumns: { xs: '1fr', lg: '1fr 1fr' } }}>
        <Paper sx={{ p: 2.5, borderRadius: 2.5 }}>
          <MetricTrend active={overview.active_users} total={overview.total_users} />
        </Paper>
        <Paper sx={{ p: 2.5, borderRadius: 2.5 }}>
          <Stack direction="row" spacing={1} useFlexGap flexWrap="wrap">
            <Chip label={`Приватных групп: ${overview.private_groups}`} />
            <Chip label={`Дружб: ${overview.total_friendships}`} />
            <Chip label={`Задач выполнено: ${overview.completed_tasks}`} />
            <Chip label={`Задач открыто: ${overview.pending_tasks}`} />
          </Stack>
        </Paper>
      </Box>

      <Box sx={{ display: 'grid', gap: 2, gridTemplateColumns: { xs: '1fr', md: '1fr 1fr' } }}>
        <Paper sx={{ p: 2.5, borderRadius: 2.5 }}>
          <HorizontalBarChart title="Распределение ролей" items={roleItems} />
        </Paper>
        <Paper sx={{ p: 2.5, borderRadius: 2.5 }}>
          <DonutChart title="Задачи" segments={taskItems.map((item) => ({ label: item.label, value: item.value }))} />
        </Paper>
      </Box>

      <Box sx={{ display: 'grid', gap: 2, gridTemplateColumns: { xs: '1fr', lg: '1.2fr 0.8fr' } }}>
        <Paper sx={{ p: 2.5, borderRadius: 2.5 }}>
          {topGroupItems.length ? (
            <HorizontalBarChart title="Крупнейшие группы" items={topGroupItems} />
          ) : (
            <Typography variant="body2" color="text.secondary">Групп пока нет.</Typography>
          )}
        </Paper>
        <Paper sx={{ p: 2.5, borderRadius: 2.5 }}>
          <Typography variant="subtitle1" sx={{ mb: 1.5 }}>Новые пользователи</Typography>
          <Stack spacing={1}>
            {overview.recent_users.length ? overview.recent_users.map((item) => (
              <Box key={item.id} sx={{ py: 0.75, borderBottom: '1px solid', borderColor: 'divider' }}>
                <Typography variant="body2" sx={{ fontWeight: 600 }}>{item.full_name}</Typography>
                <Typography variant="caption" color="text.secondary">{item.email}</Typography>
              </Box>
            )) : (
              <Typography variant="body2" color="text.secondary">Новых пользователей нет.</Typography>
            )}
          </Stack>
        </Paper>
      </Box>
    </Stack>
  );
}
