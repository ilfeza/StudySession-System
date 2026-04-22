import AddRoundedIcon from '@mui/icons-material/AddRounded';
import GroupAddRoundedIcon from '@mui/icons-material/GroupAddRounded';
import VideocamRoundedIcon from '@mui/icons-material/VideocamRounded';
import {
  Alert,
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Divider,
  Paper,
  Stack,
  TextField,
  Typography,
} from '@mui/material';
import dayjs from 'dayjs';
import { useEffect, useMemo, useState } from 'react';
import { Link as RouterLink } from 'react-router-dom';

import { TaskHub } from '../components/TaskHub';
import { useAuth } from '../context/AuthContext';
import { api } from '../api/client';
import { Group, VideoSession } from '../types';

export function GroupsPage() {
  const { user } = useAuth();
  const [groups, setGroups] = useState<Group[]>([]);
  const [catalog, setCatalog] = useState<Group[]>([]);
  const [sessionsByGroup, setSessionsByGroup] = useState<Record<number, VideoSession[]>>({});
  const [selectedGroup, setSelectedGroup] = useState<number | null>(null);
  const [newGroup, setNewGroup] = useState('');
  const [open, setOpen] = useState(false);
  const [error, setError] = useState('');

  const canModerateByRole = user?.role === 'admin' || user?.role === 'instructor';

  async function reload() {
    try {
      const [myGroupsResponse, catalogResponse] = await Promise.all([
        api.get<Group[]>('/groups'),
        api.get<Group[]>('/groups/catalog'),
      ]);

      setGroups(myGroupsResponse.data);
      setCatalog(catalogResponse.data);

      const pairs = await Promise.all(
        myGroupsResponse.data.map(async (group) => {
          const sessions = await api.get<VideoSession[]>(`/sessions/group/${group.id}`);
          return [group.id, sessions.data] as const;
        }),
      );
      setSessionsByGroup(Object.fromEntries(pairs));

      if (!selectedGroup && myGroupsResponse.data[0]) {
        setSelectedGroup(myGroupsResponse.data[0].id);
      }
    } catch (err) {
      setError((err as Error).message || 'Не удалось загрузить группы.');
    }
  }

  useEffect(() => {
    reload();
  }, []);

  async function createGroup() {
    if (!newGroup.trim()) {
      return;
    }
    setError('');
    try {
      await api.post('/groups', { name: newGroup, description: 'Новая учебная группа' });
      setOpen(false);
      setNewGroup('');
      await reload();
    } catch (err) {
      setError((err as Error).message || 'Не удалось создать группу.');
    }
  }

  async function createSession(groupId: number) {
    setError('');
    try {
      await api.post('/sessions', {
        group_id: groupId,
        title: 'Плановая сессия',
        description: 'Обсуждение задач и материалов',
        starts_at: dayjs().add(5, 'minute').toISOString(),
      });
      await reload();
    } catch (err) {
      setError((err as Error).message || 'Не удалось создать сессию.');
    }
  }

  async function joinGroup(groupId: number) {
    setError('');
    try {
      await api.post(`/groups/${groupId}/join`);
      await reload();
    } catch (err) {
      setError((err as Error).message || 'Не удалось вступить в группу.');
    }
  }

  const myGroupIds = useMemo(() => new Set(groups.map((group) => group.id)), [groups]);
  const availableGroups = useMemo(() => catalog.filter((group) => !myGroupIds.has(group.id)), [catalog, myGroupIds]);

  return (
    <Stack spacing={2}>
      {error && <Alert severity="error">{error}</Alert>}
      <Stack direction={{ xs: 'column', lg: 'row' }} spacing={2}>
        <Paper sx={{ p: 2, flex: 1 }}>
          <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 2 }}>
            <Typography variant="h5">Мои группы и комнаты</Typography>
            <Button variant="contained" startIcon={<AddRoundedIcon />} onClick={() => setOpen(true)}>Создать группу</Button>
          </Stack>
          <Stack spacing={1.2}>
            {groups.length === 0 && <Typography color="text.secondary">Вы пока не состоите ни в одной группе.</Typography>}
            {groups.map((group) => (
              <Paper
                key={group.id}
                onClick={() => setSelectedGroup(group.id)}
                sx={{
                  p: 1.5,
                  cursor: 'pointer',
                  border: selectedGroup === group.id ? '2px solid #165DFF' : '1px solid #dfe6f4',
                }}
              >
                <Typography fontWeight={700}>{group.name}</Typography>
                <Typography variant="body2" color="text.secondary">{group.description}</Typography>
                <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1} sx={{ mt: 1 }}>
                  <Button size="small" startIcon={<VideocamRoundedIcon />} onClick={() => createSession(group.id)}>Создать комнату</Button>
                </Stack>
                <Stack spacing={1} sx={{ mt: 1 }}>
                  {(sessionsByGroup[group.id] || []).map((session) => (
                    <Button key={session.id} component={RouterLink} to={`/sessions/${session.id}`} variant="outlined" size="small">
                      Войти в «{session.title}»
                    </Button>
                  ))}
                </Stack>
              </Paper>
            ))}
          </Stack>
        </Paper>

        <Paper sx={{ p: 2, flex: 1 }}>
          <Typography variant="h5" sx={{ mb: 2 }}>Каталог групп</Typography>
          <Stack spacing={1.2}>
            {availableGroups.length === 0 && <Typography color="text.secondary">Нет доступных групп для вступления.</Typography>}
            {availableGroups.map((group) => (
              <Paper key={group.id} sx={{ p: 1.5, border: '1px solid #dfe6f4' }}>
                <Typography fontWeight={700}>{group.name}</Typography>
                <Typography variant="body2" color="text.secondary">{group.description}</Typography>
                <Button sx={{ mt: 1 }} size="small" variant="contained" startIcon={<GroupAddRoundedIcon />} onClick={() => joinGroup(group.id)}>
                  Вступить
                </Button>
              </Paper>
            ))}
          </Stack>
        </Paper>
      </Stack>

      <Divider />

      <Stack>
        {selectedGroup ? (
          <TaskHub groupId={selectedGroup} moderatorMode={Boolean(canModerateByRole)} />
        ) : (
          <Paper sx={{ p: 2 }}>
            <Typography>Выберите группу для работы с задачами.</Typography>
          </Paper>
        )}
      </Stack>

      <Dialog open={open} onClose={() => setOpen(false)} fullWidth maxWidth="sm">
        <DialogTitle>Новая группа</DialogTitle>
        <DialogContent>
          <TextField autoFocus label="Название" fullWidth value={newGroup} onChange={(event) => setNewGroup(event.target.value)} />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setOpen(false)}>Отмена</Button>
          <Button onClick={createGroup}>Создать</Button>
        </DialogActions>
      </Dialog>
    </Stack>
  );
}
