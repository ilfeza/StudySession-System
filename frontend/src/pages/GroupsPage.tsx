import AddCircleRoundedIcon from '@mui/icons-material/AddCircleRounded';
import HistoryRoundedIcon from '@mui/icons-material/HistoryRounded';
import LibraryBooksRoundedIcon from '@mui/icons-material/LibraryBooksRounded';
import MeetingRoomRoundedIcon from '@mui/icons-material/MeetingRoomRounded';
import RocketLaunchRoundedIcon from '@mui/icons-material/RocketLaunchRounded';
import {
  Alert,
  Box,
  Button,
  Chip,
  Dialog,
  DialogContent,
  DialogTitle,
  MenuItem,
  Paper,
  Stack,
  Tab,
  Tabs,
  TextField,
  Typography,
} from '@mui/material';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link as RouterLink } from 'react-router-dom';

import { api } from '../api/client';
import { MaterialsPanel } from '../components/materials/MaterialsPanel';
import type { Group, SessionSummaryHistoryItem, VideoSession } from '../types';

const sessionTemplates = [
  { key: 'exam_prep', name: 'Подготовка к экзамену', description: 'План, вопросы, повторение и фиксация прогресса.' },
  { key: 'team_project', name: 'Командный проект', description: 'Распределение ролей, задач и контроль статусов.' },
  { key: 'topic_review', name: 'Разбор темы', description: 'Обсуждение теории, материалов и выводов по теме.' },
];

export function GroupsPage() {
  const [groups, setGroups] = useState<Group[]>([]);
  const [catalog, setCatalog] = useState<Group[]>([]);
  const [selectedGroupId, setSelectedGroupId] = useState<number | null>(null);
  const [sessions, setSessions] = useState<VideoSession[]>([]);
  const [history, setHistory] = useState<SessionSummaryHistoryItem[]>([]);
  const [tab, setTab] = useState<'sessions' | 'history' | 'materials'>('sessions');
  const [error, setError] = useState('');
  const [groupDialogOpen, setGroupDialogOpen] = useState(false);
  const [sessionDialogOpen, setSessionDialogOpen] = useState(false);
  const [groupName, setGroupName] = useState('');
  const [groupDescription, setGroupDescription] = useState('');
  const [sessionTitle, setSessionTitle] = useState('');
  const [sessionDescription, setSessionDescription] = useState('');
  const [sessionStartsAt, setSessionStartsAt] = useState('');
  const [templateKey, setTemplateKey] = useState(sessionTemplates[0].key);

  const selectedGroup = useMemo(
    () => groups.find((group) => group.id === selectedGroupId) ?? null,
    [groups, selectedGroupId],
  );

  const loadGroups = useCallback(async () => {
    setError('');
    try {
      const [groupsResponse, catalogResponse] = await Promise.all([
        api.get<Group[]>('/groups'),
        api.get<Group[]>('/groups/catalog'),
      ]);
      setGroups(groupsResponse.data);
      setCatalog(catalogResponse.data);
      setSelectedGroupId((prev) => prev ?? groupsResponse.data[0]?.id ?? null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Не удалось загрузить группы.');
    }
  }, []);

  const loadGroupData = useCallback(async (groupId: number) => {
    try {
      const [sessionsResponse, historyResponse] = await Promise.all([
        api.get<VideoSession[]>(`/sessions/group/${groupId}`),
        api.get<SessionSummaryHistoryItem[]>(`/groups/${groupId}/history`),
      ]);
      setSessions(sessionsResponse.data);
      setHistory(historyResponse.data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Не удалось загрузить данные комнаты.');
    }
  }, []);

  useEffect(() => {
    void loadGroups();
  }, [loadGroups]);

  useEffect(() => {
    if (selectedGroupId) {
      void loadGroupData(selectedGroupId);
    }
  }, [loadGroupData, selectedGroupId]);

  useEffect(() => {
    const template = sessionTemplates.find((item) => item.key === templateKey);
    if (!template) {
      return;
    }
    if (!sessionTitle.trim()) {
      setSessionTitle(template.name);
    }
    if (!sessionDescription.trim()) {
      setSessionDescription(template.description);
    }
  }, [templateKey]);

  async function handleCreateGroup() {
    if (!groupName.trim()) {
      return;
    }
    try {
      await api.post('/groups', { name: groupName.trim(), description: groupDescription.trim() });
      setGroupDialogOpen(false);
      setGroupName('');
      setGroupDescription('');
      await loadGroups();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Не удалось создать комнату.');
    }
  }

  async function handleJoinGroup(groupId: number) {
    try {
      await api.post(`/groups/${groupId}/join`);
      await loadGroups();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Не удалось вступить в комнату.');
    }
  }

  async function handleCreateSession() {
    if (!selectedGroupId || !sessionTitle.trim() || !sessionStartsAt) {
      return;
    }
    try {
      await api.post('/sessions', {
        group_id: selectedGroupId,
        title: sessionTitle.trim(),
        description: sessionDescription.trim(),
        template_key: templateKey,
        starts_at: new Date(sessionStartsAt).toISOString(),
      });
      setSessionDialogOpen(false);
      setSessionTitle('');
      setSessionDescription('');
      setSessionStartsAt('');
      setTemplateKey(sessionTemplates[0].key);
      await loadGroupData(selectedGroupId);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Не удалось создать сессию.');
    }
  }

  return (
    <Stack spacing={2.5}>
      <Stack direction={{ xs: 'column', lg: 'row' }} spacing={2}>
        <Paper sx={{ p: 2.5, flex: 1, borderRadius: 5 }}>
          <Stack direction={{ xs: 'column', md: 'row' }} justifyContent="space-between" spacing={2}>
            <Box>
              <Typography variant="h4" fontWeight={900}>Учебные комнаты</Typography>
              <Typography color="text.secondary" sx={{ mt: 0.75 }}>
                Здесь создаются сессии, шаблоны встреч, история и материалы комнаты.
              </Typography>
            </Box>
            <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1}>
              <Button variant="outlined" startIcon={<AddCircleRoundedIcon />} onClick={() => setGroupDialogOpen(true)}>
                Создать комнату
              </Button>
              <Button variant="contained" startIcon={<RocketLaunchRoundedIcon />} onClick={() => setSessionDialogOpen(true)} disabled={!selectedGroupId}>
                Создать сессию
              </Button>
            </Stack>
          </Stack>
          {error ? <Alert severity="warning" sx={{ mt: 2 }}>{error}</Alert> : null}
        </Paper>

        <Paper sx={{ p: 2.5, width: { xs: '100%', lg: 360 }, borderRadius: 5 }}>
          <Typography variant="h6" fontWeight={800}>Доступные шаблоны</Typography>
          <Stack spacing={1.1} sx={{ mt: 1.5 }}>
            {sessionTemplates.map((template) => (
              <Paper key={template.key} variant="outlined" sx={{ p: 1.25, borderRadius: 3 }}>
                <Typography fontWeight={800}>{template.name}</Typography>
                <Typography variant="body2" color="text.secondary">{template.description}</Typography>
              </Paper>
            ))}
          </Stack>
        </Paper>
      </Stack>

      <Stack direction={{ xs: 'column', lg: 'row' }} spacing={2}>
        <Paper sx={{ p: 2, borderRadius: 5, width: { xs: '100%', lg: 320 } }}>
          <Typography variant="h6" fontWeight={800}>Мои комнаты</Typography>
          <Stack spacing={1.1} sx={{ mt: 1.5 }}>
            {groups.map((group) => (
              <Paper
                key={group.id}
                onClick={() => setSelectedGroupId(group.id)}
                sx={{
                  p: 1.5,
                  borderRadius: 3.5,
                  cursor: 'pointer',
                  border: selectedGroupId === group.id ? '2px solid #1976d2' : '1px solid #dbe5f2',
                  background: selectedGroupId === group.id ? 'rgba(25, 118, 210, 0.06)' : '#fff',
                }}
              >
                <Typography fontWeight={800}>{group.name}</Typography>
                <Typography variant="body2" color="text.secondary">
                  {group.description || 'Описание пока не добавлено.'}
                </Typography>
              </Paper>
            ))}
            {groups.length === 0 ? <Alert severity="info">У вас пока нет комнат.</Alert> : null}
          </Stack>
        </Paper>

        <Stack spacing={2} sx={{ flex: 1 }}>
          <Paper sx={{ p: 2, borderRadius: 5 }}>
            <Typography variant="h6" fontWeight={800}>Каталог комнат</Typography>
            <Stack spacing={1} sx={{ mt: 1.5 }}>
              {catalog.map((group) => {
                const joined = groups.some((item) => item.id === group.id);
                return (
                  <Paper key={group.id} variant="outlined" sx={{ p: 1.5, borderRadius: 3.5 }}>
                    <Stack direction={{ xs: 'column', md: 'row' }} justifyContent="space-between" spacing={1.5}>
                      <Box>
                        <Typography fontWeight={800}>{group.name}</Typography>
                        <Typography variant="body2" color="text.secondary">
                          {group.description || 'Описание пока не добавлено.'}
                        </Typography>
                      </Box>
                      <Button variant={joined ? 'outlined' : 'contained'} disabled={joined} onClick={() => void handleJoinGroup(group.id)}>
                        {joined ? 'Вы уже в комнате' : 'Вступить'}
                      </Button>
                    </Stack>
                  </Paper>
                );
              })}
            </Stack>
          </Paper>

          <Paper sx={{ p: 2, borderRadius: 5, minHeight: 420 }}>
            <Stack direction={{ xs: 'column', md: 'row' }} justifyContent="space-between" spacing={1.5}>
              <Box>
                <Typography variant="h5" fontWeight={900}>{selectedGroup?.name ?? 'Выберите комнату'}</Typography>
                <Typography color="text.secondary">
                  {selectedGroup?.description || 'Здесь будут сессии, история и материалы выбранной комнаты.'}
                </Typography>
              </Box>
              {selectedGroup ? <Chip label={`Комната #${selectedGroup.id}`} /> : null}
            </Stack>

            <Tabs
              value={tab}
              onChange={(_, next) => setTab(next)}
              sx={{ mt: 1.5, mb: 2 }}
            >
              <Tab value="sessions" icon={<MeetingRoomRoundedIcon />} iconPosition="start" label="Сессии" />
              <Tab value="history" icon={<HistoryRoundedIcon />} iconPosition="start" label="История" />
              <Tab value="materials" icon={<LibraryBooksRoundedIcon />} iconPosition="start" label="Материалы" />
            </Tabs>

            {tab === 'sessions' ? (
              <Stack spacing={1.2}>
                {sessions.map((session) => (
                  <Paper key={session.id} variant="outlined" sx={{ p: 1.5, borderRadius: 3.5 }}>
                    <Stack direction={{ xs: 'column', md: 'row' }} justifyContent="space-between" spacing={1.5}>
                      <Box>
                        <Typography fontWeight={800}>{session.title}</Typography>
                        <Typography variant="body2" color="text.secondary">
                          {new Date(session.starts_at).toLocaleString('ru-RU')}
                        </Typography>
                        <Typography variant="body2" color="text.secondary">
                          {session.description || 'Описание сессии пока не добавлено.'}
                        </Typography>
                      </Box>
                      <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1}>
                        {session.template_key ? <Chip label={sessionTemplates.find((item) => item.key === session.template_key)?.name ?? session.template_key} /> : null}
                        <Button component={RouterLink} to={`/sessions/${session.id}`} variant="contained">
                          Открыть
                        </Button>
                      </Stack>
                    </Stack>
                  </Paper>
                ))}
                {selectedGroup && sessions.length === 0 ? <Alert severity="info">В этой комнате пока нет сессий.</Alert> : null}
              </Stack>
            ) : null}

            {tab === 'history' ? (
              <Stack spacing={1.2}>
                {history.map((item) => (
                  <Paper key={item.summary_id} variant="outlined" sx={{ p: 1.5, borderRadius: 3.5 }}>
                    <Typography fontWeight={800}>{item.session_title}</Typography>
                    <Typography variant="body2" color="text.secondary">
                      {new Date(item.session_date).toLocaleString('ru-RU')}
                    </Typography>
                    <Typography variant="body2" sx={{ mt: 0.75 }}>
                      {item.short_description || 'Итоги сессии пока не заполнены.'}
                    </Typography>
                    <Typography variant="body2" color="text.secondary" sx={{ mt: 0.75 }}>
                      Участники: {item.participants.join(', ') || 'нет данных'}
                    </Typography>
                  </Paper>
                ))}
                {selectedGroup && history.length === 0 ? <Alert severity="info">История этой комнаты пока пуста.</Alert> : null}
              </Stack>
            ) : null}

            {tab === 'materials' && selectedGroup ? <MaterialsPanel groupId={selectedGroup.id} /> : null}
          </Paper>
        </Stack>
      </Stack>

      <Dialog open={groupDialogOpen} onClose={() => setGroupDialogOpen(false)} fullWidth maxWidth="sm">
        <DialogTitle>Создать комнату</DialogTitle>
        <DialogContent>
          <Stack spacing={1.5} sx={{ pt: 1 }}>
            <TextField label="Название комнаты" value={groupName} onChange={(event) => setGroupName(event.target.value)} fullWidth />
            <TextField label="Описание" value={groupDescription} onChange={(event) => setGroupDescription(event.target.value)} multiline minRows={3} fullWidth />
            <Button variant="contained" onClick={() => void handleCreateGroup()} disabled={!groupName.trim()}>
              Сохранить
            </Button>
          </Stack>
        </DialogContent>
      </Dialog>

      <Dialog open={sessionDialogOpen} onClose={() => setSessionDialogOpen(false)} fullWidth maxWidth="md">
        <DialogTitle>Создать учебную сессию</DialogTitle>
        <DialogContent>
          <Stack spacing={1.5} sx={{ pt: 1 }}>
            <TextField
              select
              label="Шаблон"
              value={templateKey}
              onChange={(event) => setTemplateKey(event.target.value)}
              fullWidth
            >
              {sessionTemplates.map((template) => (
                <MenuItem key={template.key} value={template.key}>{template.name}</MenuItem>
              ))}
            </TextField>
            <TextField label="Название сессии" value={sessionTitle} onChange={(event) => setSessionTitle(event.target.value)} fullWidth />
            <TextField label="Описание" value={sessionDescription} onChange={(event) => setSessionDescription(event.target.value)} multiline minRows={3} fullWidth />
            <TextField
              label="Начало"
              type="datetime-local"
              value={sessionStartsAt}
              onChange={(event) => setSessionStartsAt(event.target.value)}
              InputLabelProps={{ shrink: true }}
              fullWidth
            />
            <Button variant="contained" onClick={() => void handleCreateSession()} disabled={!selectedGroupId || !sessionTitle.trim() || !sessionStartsAt}>
              Создать сессию
            </Button>
          </Stack>
        </DialogContent>
      </Dialog>
    </Stack>
  );
}
