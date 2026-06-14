import { Box, Stack, Typography } from '@mui/material';
import { alpha, useTheme } from '@mui/material/styles';

type BarChartItem = {
  label: string;
  value: number;
  color?: string;
};

function formatLabel(label: string) {
  const labels: Record<string, string> = {
    student: 'Студенты',
    instructor: 'Преподаватели',
    admin: 'Администраторы',
    analyst: 'Аналитики',
  };
  return labels[label] ?? label;
}

export function HorizontalBarChart({ title, items }: { title: string; items: BarChartItem[] }) {
  const theme = useTheme();
  const max = Math.max(...items.map((item) => item.value), 1);

  return (
    <Box>
      <Typography variant="subtitle2" sx={{ mb: 1.5 }}>{title}</Typography>
      <Stack spacing={1.25}>
        {items.map((item) => (
          <Box key={item.label}>
            <Stack direction="row" justifyContent="space-between" sx={{ mb: 0.5 }}>
              <Typography variant="body2">{formatLabel(item.label)}</Typography>
              <Typography variant="body2" color="text.secondary">{item.value}</Typography>
            </Stack>
            <Box sx={{ height: 10, borderRadius: 999, bgcolor: alpha(theme.palette.text.primary, 0.06), overflow: 'hidden' }}>
              <Box
                sx={{
                  height: '100%',
                  width: `${(item.value / max) * 100}%`,
                  borderRadius: 999,
                  bgcolor: item.color ?? theme.palette.text.primary,
                  minWidth: item.value > 0 ? 8 : 0,
                  transition: 'width 0.4s ease',
                }}
              />
            </Box>
          </Box>
        ))}
      </Stack>
    </Box>
  );
}

export function DonutChart({ title, segments }: { title: string; segments: BarChartItem[] }) {
  const total = segments.reduce((sum, item) => sum + item.value, 0) || 1;
  const colors = ['#3b82f6', '#10b981', '#f59e0b', '#6366f1'];
  let offset = 0;
  const gradientStops = segments.map((segment, index) => {
    const percent = (segment.value / total) * 100;
    const start = offset;
    offset += percent;
    return `${colors[index % colors.length]} ${start}% ${offset}%`;
  }).join(', ');

  return (
    <Box>
      <Typography variant="subtitle2" sx={{ mb: 1.5 }}>{title}</Typography>
      <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2} alignItems="center">
        <Box
          sx={{
            width: 120,
            height: 120,
            borderRadius: '50%',
            background: `conic-gradient(${gradientStops})`,
            position: 'relative',
            flexShrink: 0,
            '&::after': {
              content: '""',
              position: 'absolute',
              inset: 22,
              borderRadius: '50%',
              bgcolor: 'background.paper',
            },
          }}
        />
        <Stack spacing={0.75} sx={{ flex: 1, width: '100%' }}>
          {segments.map((segment, index) => (
            <Stack key={segment.label} direction="row" spacing={1} alignItems="center">
              <Box sx={{ width: 10, height: 10, borderRadius: '50%', bgcolor: colors[index % colors.length], flexShrink: 0 }} />
              <Typography variant="body2" sx={{ flex: 1 }}>{segment.label}</Typography>
              <Typography variant="body2" color="text.secondary">{segment.value}</Typography>
            </Stack>
          ))}
          <Typography variant="caption" color="text.secondary" sx={{ pt: 0.5 }}>
            Всего: {total}
          </Typography>
        </Stack>
      </Stack>
    </Box>
  );
}

export function MetricTrend({ active, total }: { active: number; total: number }) {
  const theme = useTheme();
  const percent = total > 0 ? Math.round((active / total) * 100) : 0;

  return (
    <Box>
      <Stack direction="row" justifyContent="space-between" sx={{ mb: 1 }}>
        <Typography variant="subtitle2">Активность пользователей</Typography>
        <Typography variant="body2" color="text.secondary">{percent}%</Typography>
      </Stack>
      <Box sx={{ height: 12, borderRadius: 999, bgcolor: alpha(theme.palette.text.primary, 0.06), overflow: 'hidden' }}>
        <Box
          sx={{
            height: '100%',
            width: `${percent}%`,
            borderRadius: 999,
            bgcolor: '#3b82f6',
            minWidth: active > 0 ? 12 : 0,
          }}
        />
      </Box>
      <Typography variant="caption" color="text.secondary" sx={{ mt: 0.75, display: 'block' }}>
        {active} из {total} пользователей активны
      </Typography>
    </Box>
  );
}
