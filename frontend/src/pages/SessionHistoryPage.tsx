import GroupsRoundedIcon from '@mui/icons-material/GroupsRounded';
import HistoryEduRoundedIcon from '@mui/icons-material/HistoryEduRounded';
import PlaylistAddCheckRoundedIcon from '@mui/icons-material/PlaylistAddCheckRounded';
import { Alert, Chip, Paper, Stack, Typography } from '@mui/material';
import { useEffect, useState } from 'react';

import { api } from '../api/client';
import type { UserSessionHistoryItem } from '../types';

const templateLabels: Record<string, string> = {
  exam_prep: 'Подготовка к экзамену',
  team_project: 'Командный проект',
  topic_review: 'Разбор темы',
};

export function SessionHistoryPage() {
  const [history, setHistory] = useState<UserSessionHistoryItem[]>([]);
  const [error, setError] = useState('');

  useEffect(() => {
    api.get<UserSessionHistoryItem[]>('/users/me/history')
      .then((response) => setHistory(response.data))
      .catch((err: unknown) => setError(err instanceof Error ? err.message : 'Не удалось загрузить историю.'));
  }, []);

  return (
    <Stack spacing={3}>
      <Paper sx={{ p: { xs: 3, md: 4 }, borderRadius: 3 }}>
        <Typography variant="h3">История сессий</Typography>
        <Typography variant="body1" color="text.secondary" sx={{ mt: 1 }}>
          Прошедшие встречи, команда и короткий итог по каждой сессии.
        </Typography>
      </Paper>

      {error ? <Alert severity="warning">{error}</Alert> : null}

      <Stack spacing={1.5}>
        {history.map((item) => (
          <Paper key={item.session_id} sx={{ p: 3, borderRadius: 3 }}>
            <Stack spacing={1.5}>
              <Stack direction={{ xs: 'column', md: 'row' }} justifyContent="space-between" spacing={1.5}>
                <Stack spacing={0.5}>
                  <Typography variant="h6">{item.session_title}</Typography>
                  <Typography variant="body2" color="text.secondary">
                    {new Date(item.session_date).toLocaleString('ru-RU')}
                  </Typography>
                </Stack>
                <Stack direction="row" spacing={1} useFlexGap flexWrap="wrap">
                  <Chip icon={<HistoryEduRoundedIcon />} label={templateLabels[item.template_key] ?? 'Свободная сессия'} />
                  <Chip icon={<GroupsRoundedIcon />} label={item.group_name} />
                </Stack>
              </Stack>
              <Typography variant="body2" color="text.secondary">
                Участники: {item.participants.join(', ') || 'нет данных'}
              </Typography>
              <Typography variant="body2">
                {item.short_description || 'Краткое описание итогов не заполнено.'}
              </Typography>
              <Chip
                icon={<PlaylistAddCheckRoundedIcon />}
                label={`Задачи: ${item.tasks_completed}/${item.tasks_total} завершено`}
                sx={{ alignSelf: 'flex-start' }}
              />
            </Stack>
          </Paper>
        ))}
        {!error && history.length === 0 ? <Alert severity="info">История пока пуста.</Alert> : null}
      </Stack>
    </Stack>
  );
}
