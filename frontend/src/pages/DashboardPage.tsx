import AutoAwesomeRoundedIcon from '@mui/icons-material/AutoAwesomeRounded';
import CampaignRoundedIcon from '@mui/icons-material/CampaignRounded';
import Groups2RoundedIcon from '@mui/icons-material/Groups2Rounded';
import SendRoundedIcon from '@mui/icons-material/SendRounded';
import TaskAltRoundedIcon from '@mui/icons-material/TaskAltRounded';
import {
  Alert,
  Box,
  Button,
  FormControl,
  MenuItem,
  Paper,
  Select,
  Stack,
  TextField,
  Typography,
} from '@mui/material';
import dayjs from 'dayjs';
import relativeTime from 'dayjs/plugin/relativeTime';
import 'dayjs/locale/ru';
import { useCallback, useEffect, useMemo, useState } from 'react';

import { api } from '../api/client';
import { AnnouncementFeedItem, Group, Task } from '../types';

dayjs.extend(relativeTime);
dayjs.locale('ru');

function MetricCard({ title, value, subtitle, icon }: { title: string; value: string | number; subtitle: string; icon: React.ReactNode }) {
  return (
    <Paper sx={{ p: 3, borderRadius: 3 }}>
      <Stack spacing={2}>
        <Stack direction="row" justifyContent="space-between" alignItems="center">
          <Typography variant="subtitle2" color="text.secondary">{title}</Typography>
          <Box sx={{ color: 'text.secondary' }}>{icon}</Box>
        </Stack>
        <Typography variant="h3">{value}</Typography>
        <Typography variant="body2" color="text.secondary">{subtitle}</Typography>
      </Stack>
    </Paper>
  );
}

export function DashboardPage() {
  const [groups, setGroups] = useState<Group[]>([]);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [announcements, setAnnouncements] = useState<AnnouncementFeedItem[]>([]);
  const [input, setInput] = useState('');
  const [summary, setSummary] = useState('');
  const [loadError, setLoadError] = useState('');
  const [postGroupId, setPostGroupId] = useState<number | ''>('');
  const [postBody, setPostBody] = useState('');
  const [posting, setPosting] = useState(false);
  const [postError, setPostError] = useState('');

  const loadDashboard = useCallback(async () => {
    setLoadError('');
    try {
      const [groupsResponse, feedResponse] = await Promise.all([
        api.get<Group[]>('/groups'),
        api.get<AnnouncementFeedItem[]>('/dashboard/announcements'),
      ]);
      const loadedGroups = groupsResponse.data;
      setGroups(loadedGroups);
      setAnnouncements(feedResponse.data);
      const ids = loadedGroups.map((g) => g.id);
      setPostGroupId((prev) => {
        if (ids.length === 0) {
          return '';
        }
        if (typeof prev === 'number' && ids.includes(prev)) {
          return prev;
        }
        return ids[0];
      });
      const firstGroup = loadedGroups[0];
      if (firstGroup) {
        const tasksResponse = await api.get<Task[]>(`/tasks/group/${firstGroup.id}`);
        setTasks(tasksResponse.data);
      } else {
        setTasks([]);
      }
    } catch (err: unknown) {
      setLoadError(err instanceof Error ? err.message : 'Не удалось загрузить данные дашборда.');
      setGroups([]);
      setTasks([]);
      setAnnouncements([]);
    }
  }, []);

  useEffect(() => {
    void loadDashboard();
  }, [loadDashboard]);

  const activeTasksCount = useMemo(() => tasks.filter((task) => !task.is_completed).length, [tasks]);

  async function summarize() {
    const response = await api.post<{ summary: string }>('/ml/summarize', { text: input });
    setSummary(response.data.summary);
  }

  async function submitAnnouncement() {
    if (postGroupId === '') {
      setPostError('Выберите группу.');
      return;
    }
    setPostError('');
    setPosting(true);
    try {
      const { data } = await api.post<AnnouncementFeedItem>('/dashboard/announcements', {
        group_id: postGroupId,
        body: postBody,
      });
      setAnnouncements((prev) => [data, ...prev.filter((a) => a.id !== data.id)]);
      setPostBody('');
    } catch (err: unknown) {
      setPostError(err instanceof Error ? err.message : 'Не удалось опубликовать.');
    } finally {
      setPosting(false);
    }
  }

  return (
    <Stack spacing={3}>
      <Paper sx={{ p: { xs: 3, md: 4 }, borderRadius: 3 }}>
        <Typography variant="h3">Дашборд</Typography>
        <Typography variant="body1" color="text.secondary" sx={{ mt: 1 }}>
          Обзор групп, задач и командных обновлений в спокойной, рабочей структуре.
        </Typography>
      </Paper>

      {loadError ? <Alert severity="error">{loadError}</Alert> : null}

      <Box
        sx={{
          display: 'grid',
          gap: 2,
          gridTemplateColumns: { xs: '1fr', md: 'repeat(3, minmax(0, 1fr))' },
        }}
      >
        <MetricCard title="Группы" value={groups.length} subtitle="Активные пространства для совместной работы" icon={<Groups2RoundedIcon fontSize="small" />} />
        <MetricCard title="Задачи в работе" value={activeTasksCount} subtitle="Открытые задачи в первой доступной группе" icon={<TaskAltRoundedIcon fontSize="small" />} />
        <MetricCard title="AI-суммаризация" value="ML" subtitle="Краткое резюме больших текстовых материалов" icon={<AutoAwesomeRoundedIcon fontSize="small" />} />
      </Box>

      <Box
        sx={{
          display: 'grid',
          gap: 2,
          gridTemplateColumns: { xs: '1fr', xl: 'minmax(0, 1.4fr) minmax(360px, 0.9fr)' },
          alignItems: 'start',
        }}
      >
        <Paper sx={{ p: 3, borderRadius: 3 }}>
          <Stack spacing={3}>
            <Stack spacing={1}>
              <Stack direction="row" spacing={1} alignItems="center">
                <CampaignRoundedIcon fontSize="small" />
                <Typography variant="h5">Объявления команд</Typography>
              </Stack>
              <Typography variant="body2" color="text.secondary">
                Короткие обновления по дедлайнам, ссылкам и договоренностям. Лента остается компактной, а форма публикации не мешает чтению.
              </Typography>
            </Stack>

            {groups.length > 0 ? (
              <Paper sx={{ p: 2, borderRadius: 3, bgcolor: '#f9fafb' }}>
                <Stack spacing={2}>
                  <Typography variant="subtitle2">Новое сообщение</Typography>
                  <FormControl fullWidth size="small">
                    <Select
                      value={postGroupId === '' ? '' : String(postGroupId)}
                      displayEmpty
                      onChange={(e) => setPostGroupId(Number(e.target.value))}
                    >
                      {groups.map((group) => (
                        <MenuItem key={group.id} value={group.id}>{group.name}</MenuItem>
                      ))}
                    </Select>
                  </FormControl>
                  <TextField
                    placeholder="Короткое объявление для группы"
                    multiline
                    minRows={4}
                    fullWidth
                    value={postBody}
                    onChange={(e) => setPostBody(e.target.value)}
                  />
                  {postError ? <Alert severity="warning">{postError}</Alert> : null}
                  <Box>
                    <Button
                      variant="contained"
                      startIcon={<SendRoundedIcon />}
                      disabled={posting || !postBody.trim()}
                      onClick={() => void submitAnnouncement()}
                    >
                      Опубликовать
                    </Button>
                  </Box>
                </Stack>
              </Paper>
            ) : (
              <Alert severity="info">Вступите в группу на странице «Группы», чтобы публиковать объявления.</Alert>
            )}

            <Stack spacing={1.5}>
              {announcements.length === 0 ? (
                <Typography variant="body2" color="text.secondary">Пока нет объявлений.</Typography>
              ) : (
                announcements.map((item) => (
                  <Paper key={item.id} sx={{ p: 2, borderRadius: 3, bgcolor: '#ffffff' }}>
                    <Stack direction="row" justifyContent="space-between" alignItems="flex-start" spacing={1}>
                      <Box sx={{ minWidth: 0 }}>
                        <Typography variant="subtitle2">{item.group_name}</Typography>
                        <Typography variant="caption" color="text.secondary">{item.author_name}</Typography>
                      </Box>
                      <Typography variant="caption" color="text.secondary" sx={{ flexShrink: 0 }}>
                        {dayjs(item.created_at).fromNow()}
                      </Typography>
                    </Stack>
                    <Typography sx={{ mt: 1.25, whiteSpace: 'pre-wrap' }}>{item.body}</Typography>
                  </Paper>
                ))
              )}
            </Stack>
          </Stack>
        </Paper>

        <Paper sx={{ p: 3, borderRadius: 3 }}>
          <Stack spacing={2}>
            <Stack spacing={1}>
              <Typography variant="h5">Суммаризация текста</Typography>
              <Typography variant="body2" color="text.secondary">
                Вставьте учебный материал, чтобы быстро получить краткое резюме.
              </Typography>
            </Stack>
            <TextField
              placeholder="Вставьте текст на русском языке"
              value={input}
              onChange={(event) => setInput(event.target.value)}
              multiline
              minRows={12}
              fullWidth
            />
            <Box>
              <Button variant="contained" onClick={() => void summarize()} disabled={!input.trim()}>
                Получить резюме
              </Button>
            </Box>
            {summary ? (
              <Paper sx={{ p: 2, borderRadius: 3, bgcolor: '#f9fafb' }}>
                <Typography variant="subtitle2" sx={{ mb: 1 }}>Результат</Typography>
                <Typography variant="body2">{summary}</Typography>
              </Paper>
            ) : null}
          </Stack>
        </Paper>
      </Box>
    </Stack>
  );
}
