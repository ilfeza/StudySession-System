import AutoAwesomeRoundedIcon from '@mui/icons-material/AutoAwesomeRounded';
import CampaignRoundedIcon from '@mui/icons-material/CampaignRounded';
import Groups2RoundedIcon from '@mui/icons-material/Groups2Rounded';
import SendRoundedIcon from '@mui/icons-material/SendRounded';
import TaskAltRoundedIcon from '@mui/icons-material/TaskAltRounded';
import {
  Alert,
  Box,
  Button,
  Divider,
  FormControl,
  InputLabel,
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
import { useCallback, useEffect, useState } from 'react';

import { api } from '../api/client';
import { AnnouncementFeedItem, Group, Task } from '../types';

dayjs.extend(relativeTime);
dayjs.locale('ru');

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
    <Stack spacing={2}>
      <Typography variant="h4" fontWeight={800}>Дашборд прогресса</Typography>
      {loadError ? <Alert severity="error">{loadError}</Alert> : null}
      <Stack direction={{ xs: 'column', md: 'row' }} spacing={2}>
        <Paper sx={{ p: 2, flex: 1 }}>
          <Stack direction="row" spacing={1} alignItems="center"><Groups2RoundedIcon color="primary" /><Typography>Ваши группы</Typography></Stack>
          <Typography variant="h3" fontWeight={700}>{groups.length}</Typography>
        </Paper>
        <Paper sx={{ p: 2, flex: 1 }}>
          <Stack direction="row" spacing={1} alignItems="center"><TaskAltRoundedIcon color="primary" /><Typography>Задачи в работе</Typography></Stack>
          <Typography variant="h3" fontWeight={700}>{tasks.filter((t) => !t.is_completed).length}</Typography>
        </Paper>
        <Paper sx={{ p: 2, flex: 1 }}>
          <Stack direction="row" spacing={1} alignItems="center"><AutoAwesomeRoundedIcon color="primary" /><Typography>ML-анализ</Typography></Stack>
          <Typography variant="body2" color="text.secondary">Краткое резюме учебного материала.</Typography>
        </Paper>
      </Stack>

      <Paper sx={{ p: 2 }}>
        <Stack direction="row" spacing={1} alignItems="center" sx={{ mb: 1 }}>
          <CampaignRoundedIcon color="primary" />
          <Typography variant="h6">Объявления команды</Typography>
        </Stack>
        <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
          Общая лента для ваших групп: дедлайны, ссылки на материалы и короткие напоминания — как на доске в Notion или Moodle.
        </Typography>
        {groups.length > 0 ? (
          <Stack spacing={2} sx={{ mb: 3 }}>
            <FormControl fullWidth size="small">
              <InputLabel id="announcement-group-label">Группа</InputLabel>
              <Select
                labelId="announcement-group-label"
                label="Группа"
                value={postGroupId === '' ? '' : String(postGroupId)}
                onChange={(e) => setPostGroupId(Number(e.target.value))}
              >
                {groups.map((g) => (
                  <MenuItem key={g.id} value={g.id}>{g.name}</MenuItem>
                ))}
              </Select>
            </FormControl>
            <TextField
              label="Текст объявления"
              placeholder="Например: встреча в Zoom в 18:00, ссылка в чате группы"
              multiline
              minRows={3}
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
        ) : (
          <Alert severity="info" sx={{ mb: 2 }}>Вступите в группу на странице «Группы», чтобы писать объявления.</Alert>
        )}
        <Divider sx={{ my: 1 }} />
        <Typography variant="subtitle2" color="text.secondary" sx={{ mb: 1 }}>Последние сообщения</Typography>
        {announcements.length === 0 ? (
          <Typography variant="body2" color="text.secondary">Пока нет объявлений — напишите первое для своей команды.</Typography>
        ) : (
          <Stack spacing={1.5}>
            {announcements.map((a) => (
              <Paper key={a.id} variant="outlined" sx={{ p: 1.5, bgcolor: 'rgba(22, 93, 255, 0.04)' }}>
                <Stack direction="row" justifyContent="space-between" alignItems="baseline" flexWrap="wrap" gap={1}>
                  <Typography fontWeight={700} color="primary">{a.group_name}</Typography>
                  <Typography variant="caption" color="text.secondary">
                    {dayjs(a.created_at).fromNow()}
                  </Typography>
                </Stack>
                <Typography variant="body2" color="text.secondary">{a.author_name}</Typography>
                <Typography sx={{ mt: 1, whiteSpace: 'pre-wrap' }}>{a.body}</Typography>
              </Paper>
            ))}
          </Stack>
        )}
      </Paper>

      <Paper sx={{ p: 2 }}>
        <Typography variant="h6">Суммаризация текста</Typography>
        <textarea
          style={{ width: '100%', minHeight: 120, marginTop: 8, borderRadius: 8, border: '1px solid #ced8ea', padding: 12 }}
          placeholder="Вставьте текст материала на русском языке"
          value={input}
          onChange={(event) => setInput(event.target.value)}
        />
        <Box sx={{ mt: 1 }}>
          <button type="button" onClick={() => void summarize()} style={{ border: 0, padding: '10px 16px', borderRadius: 8, background: '#165DFF', color: '#fff' }}>
            Получить резюме
          </button>
        </Box>
        {summary ? <Typography sx={{ mt: 2 }}>{summary}</Typography> : null}
      </Paper>
    </Stack>
  );
}
