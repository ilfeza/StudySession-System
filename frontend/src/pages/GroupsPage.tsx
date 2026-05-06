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
  Divider,
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
  { key: 'exam_prep', name: 'Подготовка к экзамену', description: 'Вопросы, повторение и фиксация прогресса.' },
  { key: 'team_project', name: 'Командный проект', description: 'Роли, задачи и контроль статусов.' },
  { key: 'topic_review', name: 'Разбор темы', description: 'Теория, материалы и выводы по теме.' },
];

const panelBorder = {
  border: '1px solid',
  borderColor: 'divider',
  borderRadius: 2.5,
};

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
      setError(err instanceof Error ? err.message : 'Не удалось загрузить данные группы.');
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
  }, [templateKey, sessionDescription, sessionTitle]);

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
      setError(err instanceof Error ? err.message : 'Не удалось создать группу.');
    }
  }

  async function handleJoinGroup(groupId: number) {
    try {
      await api.post(`/groups/${groupId}/join`);
      await loadGroups();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Не удалось вступить в группу.');
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
    <Stack spacing={3}>
      <Stack
        direction={{ xs: 'column', lg: 'row' }}
        justifyContent="space-between"
        spacing={2}
        sx={{
          pb: 2,
          borderBottom: '1px solid',
          borderColor: 'divider',
        }}
      >
        <Box>
          <Typography variant="h4">Группы</Typography>
          <Typography variant="body2" color="text.secondary" sx={{ mt: 0.75, maxWidth: 720 }}>
            Пространства для встреч, задач, материалов и истории работы команды.
          </Typography>
        </Box>
        <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1} sx={{ flexShrink: 0 }}>
          <Button variant="outlined" startIcon={<AddCircleRoundedIcon />} onClick={() => setGroupDialogOpen(true)}>
            Новая группа
          </Button>
          <Button
            variant="contained"
            startIcon={<RocketLaunchRoundedIcon />}
            onClick={() => setSessionDialogOpen(true)}
            disabled={!selectedGroupId}
          >
            Новая сессия
          </Button>
        </Stack>
      </Stack>

      {error ? <Alert severity="warning">{error}</Alert> : null}

      <Box
        sx={{
          display: 'grid',
          gap: { xs: 3, xl: 4 },
          gridTemplateColumns: {
            xs: '1fr',
            lg: '220px minmax(0, 1fr)',
            xl: '240px minmax(0, 1fr) 280px',
          },
          alignItems: 'start',
        }}
      >
        <Box
          component="aside"
          sx={{
            minWidth: 0,
            pr: { lg: 2 },
            borderRight: { lg: '1px solid' },
            borderColor: { lg: 'divider' },
          }}
        >
          <Stack spacing={2}>
            <Box>
              <Typography variant="overline" color="text.secondary" sx={{ letterSpacing: '0.08em' }}>
                Мои группы
              </Typography>
              <Typography variant="h6" sx={{ mt: 0.5 }}>
                {groups.length} {groups.length === 1 ? 'группа' : 'группы'}
              </Typography>
            </Box>

            <Stack spacing={0.75}>
              {groups.map((group) => {
                const active = selectedGroupId === group.id;
                return (
                  <Box
                    key={group.id}
                    onClick={() => setSelectedGroupId(group.id)}
                    sx={{
                      px: 1.5,
                      py: 1.25,
                      borderRadius: 2.5,
                      cursor: 'pointer',
                      border: '1px solid',
                      borderColor: active ? '#9ca3af' : 'transparent',
                      bgcolor: active ? '#ffffff' : 'transparent',
                      transition: 'background-color 120ms ease, border-color 120ms ease',
                      '&:hover': {
                        bgcolor: '#ffffff',
                        borderColor: '#d1d5db',
                      },
                    }}
                  >
                    <Typography variant="subtitle2" sx={{ pr: 1 }}>
                      {group.name}
                    </Typography>
                    <Typography
                      variant="caption"
                      color="text.secondary"
                      sx={{
                        mt: 0.5,
                        display: '-webkit-box',
                        overflow: 'hidden',
                        WebkitLineClamp: 2,
                        WebkitBoxOrient: 'vertical',
                      }}
                    >
                      {group.description || 'Описание пока не добавлено.'}
                    </Typography>
                  </Box>
                );
              })}
            </Stack>

            {groups.length === 0 ? <Alert severity="info">У вас пока нет групп.</Alert> : null}
          </Stack>
        </Box>

        <Box component="main" sx={{ minWidth: 0 }}>
          <Stack spacing={3}>
            <Box>
              <Stack direction={{ xs: 'column', md: 'row' }} justifyContent="space-between" spacing={2}>
                <Box sx={{ minWidth: 0 }}>
                  <Typography variant="overline" color="text.secondary" sx={{ letterSpacing: '0.08em' }}>
                    Активная группа
                  </Typography>
                  <Typography variant="h4" sx={{ mt: 0.5 }}>
                    {selectedGroup?.name ?? 'Выберите группу'}
                  </Typography>
                  <Typography variant="body2" color="text.secondary" sx={{ mt: 1, maxWidth: 760 }}>
                    {selectedGroup?.description || 'Здесь будут сессии, история и материалы выбранной группы.'}
                  </Typography>
                </Box>
                {selectedGroup ? <Chip label={`Группа #${selectedGroup.id}`} sx={{ alignSelf: 'flex-start' }} /> : null}
              </Stack>

              <Stack
                direction={{ xs: 'column', sm: 'row' }}
                spacing={{ xs: 1, sm: 3 }}
                divider={<Divider orientation="vertical" flexItem sx={{ display: { xs: 'none', sm: 'block' } }} />}
                sx={{ mt: 2.5, pt: 2.5, borderTop: '1px solid', borderColor: 'divider' }}
              >
                <Box>
                  <Typography variant="caption" color="text.secondary">
                    Сессий
                  </Typography>
                  <Typography variant="subtitle1">{sessions.length}</Typography>
                </Box>
                <Box>
                  <Typography variant="caption" color="text.secondary">
                    История
                  </Typography>
                  <Typography variant="subtitle1">{history.length}</Typography>
                </Box>
                <Box>
                  <Typography variant="caption" color="text.secondary">
                    Материалы
                  </Typography>
                  <Typography variant="subtitle1">{selectedGroup ? 'В группе' : 'Недоступно'}</Typography>
                </Box>
              </Stack>
            </Box>

            <Box>
              <Tabs value={tab} onChange={(_, next) => setTab(next)} sx={{ mb: 2 }}>
                <Tab value="sessions" icon={<MeetingRoomRoundedIcon />} iconPosition="start" label="Сессии" />
                <Tab value="history" icon={<HistoryRoundedIcon />} iconPosition="start" label="История" />
                <Tab value="materials" icon={<LibraryBooksRoundedIcon />} iconPosition="start" label="Материалы" />
              </Tabs>

              {tab === 'sessions' ? (
                <Stack spacing={1.5}>
                  {sessions.map((session) => (
                    <Paper
                      key={session.id}
                      sx={{
                        p: { xs: 2, md: 2.25 },
                        borderRadius: 2.5,
                        bgcolor: '#ffffff',
                        boxShadow: 'none',
                      }}
                    >
                      <Stack direction={{ xs: 'column', md: 'row' }} justifyContent="space-between" spacing={1.5}>
                        <Box sx={{ minWidth: 0 }}>
                          <Typography variant="subtitle1">{session.title}</Typography>
                          <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1} sx={{ mt: 0.75 }}>
                            <Typography variant="caption" color="text.secondary">
                              {new Date(session.starts_at).toLocaleString('ru-RU')}
                            </Typography>
                            {session.template_key ? (
                              <Chip
                                size="small"
                                label={
                                  sessionTemplates.find((item) => item.key === session.template_key)?.name ??
                                  session.template_key
                                }
                              />
                            ) : null}
                          </Stack>
                          <Typography variant="body2" color="text.secondary" sx={{ mt: 1.25 }}>
                            {session.description || 'Описание сессии пока не добавлено.'}
                          </Typography>
                        </Box>
                        <Box sx={{ flexShrink: 0 }}>
                          <Button
                            component={RouterLink}
                            to={`/sessions/${session.id}`}
                            variant="contained"
                            size="medium"
                            sx={{ minHeight: 36, px: 2 }}
                          >
                            Открыть
                          </Button>
                        </Box>
                      </Stack>
                    </Paper>
                  ))}
                  {selectedGroup && sessions.length === 0 ? <Alert severity="info">В этой группе пока нет сессий.</Alert> : null}
                </Stack>
              ) : null}

              {tab === 'history' ? (
                <Box sx={{ ...panelBorder, bgcolor: 'transparent', px: { xs: 2, md: 2.5 } }}>
                  {history.map((item, index) => (
                    <Box
                      key={item.summary_id}
                      sx={{
                        py: 2,
                        borderBottom: index === history.length - 1 ? 'none' : '1px solid',
                        borderColor: 'divider',
                      }}
                    >
                      <Typography variant="subtitle1">{item.session_title}</Typography>
                      <Typography variant="caption" color="text.secondary" sx={{ mt: 0.5, display: 'block' }}>
                        {new Date(item.session_date).toLocaleString('ru-RU')}
                      </Typography>
                      <Typography variant="body2" sx={{ mt: 1.25 }}>
                        {item.short_description || 'Итоги сессии пока не заполнены.'}
                      </Typography>
                      <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
                        Участники: {item.participants.join(', ') || 'нет данных'}
                      </Typography>
                    </Box>
                  ))}
                  {selectedGroup && history.length === 0 ? <Alert severity="info" sx={{ my: 2 }}>История этой группы пока пуста.</Alert> : null}
                </Box>
              ) : null}

              {tab === 'materials' && selectedGroup ? (
                <Box sx={{ pt: 1 }}>
                  <MaterialsPanel groupId={selectedGroup.id} />
                </Box>
              ) : null}
            </Box>
          </Stack>
        </Box>

        <Box component="aside" sx={{ minWidth: 0 }}>
          <Stack spacing={2}>
            <Box>
              <Typography variant="overline" color="text.secondary" sx={{ letterSpacing: '0.08em' }}>
                Каталог
              </Typography>
              <Typography variant="h6" sx={{ mt: 0.5 }}>
                Найти группу
              </Typography>
              <Typography variant="body2" color="text.secondary" sx={{ mt: 0.75 }}>
                Доступные сообщества, в которые можно вступить.
              </Typography>
            </Box>

            <Stack spacing={1.25}>
              {catalog.map((group) => {
                const joined = groups.some((item) => item.id === group.id);
                return (
                  <Paper
                    key={group.id}
                    sx={{
                      p: 1.75,
                      borderRadius: 2.5,
                      bgcolor: '#ffffff',
                      boxShadow: 'none',
                    }}
                  >
                    <Typography variant="subtitle2">{group.name}</Typography>
                    <Typography
                      variant="body2"
                      color="text.secondary"
                      sx={{
                        mt: 0.75,
                        display: '-webkit-box',
                        overflow: 'hidden',
                        WebkitLineClamp: 3,
                        WebkitBoxOrient: 'vertical',
                      }}
                    >
                      {group.description || 'Описание пока не добавлено.'}
                    </Typography>
                    <Button
                      variant={joined ? 'outlined' : 'contained'}
                      disabled={joined}
                      onClick={() => void handleJoinGroup(group.id)}
                      size="small"
                      sx={{ mt: 1.25, minHeight: 34, px: 1.5 }}
                    >
                      {joined ? 'Уже вступили' : 'Вступить'}
                    </Button>
                  </Paper>
                );
              })}
            </Stack>
          </Stack>
        </Box>
      </Box>

      <Dialog open={groupDialogOpen} onClose={() => setGroupDialogOpen(false)} fullWidth maxWidth="sm">
        <DialogTitle>Новая группа</DialogTitle>
        <DialogContent>
          <Stack spacing={2} sx={{ pt: 1 }}>
            <TextField label="Название группы" value={groupName} onChange={(event) => setGroupName(event.target.value)} fullWidth />
            <TextField label="Описание" value={groupDescription} onChange={(event) => setGroupDescription(event.target.value)} multiline minRows={4} fullWidth />
            <Button variant="contained" onClick={() => void handleCreateGroup()} disabled={!groupName.trim()}>
              Сохранить
            </Button>
          </Stack>
        </DialogContent>
      </Dialog>

      <Dialog open={sessionDialogOpen} onClose={() => setSessionDialogOpen(false)} fullWidth maxWidth="md">
        <DialogTitle>Новая учебная сессия</DialogTitle>
        <DialogContent>
          <Stack spacing={2} sx={{ pt: 1 }}>
            <TextField select label="Шаблон" value={templateKey} onChange={(event) => setTemplateKey(event.target.value)} fullWidth>
              {sessionTemplates.map((template) => (
                <MenuItem key={template.key} value={template.key}>{template.name}</MenuItem>
              ))}
            </TextField>
            <TextField label="Название сессии" value={sessionTitle} onChange={(event) => setSessionTitle(event.target.value)} fullWidth />
            <TextField label="Описание" value={sessionDescription} onChange={(event) => setSessionDescription(event.target.value)} multiline minRows={4} fullWidth />
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
