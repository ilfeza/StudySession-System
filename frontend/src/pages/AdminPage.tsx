import AnalyticsRoundedIcon from '@mui/icons-material/AnalyticsRounded';
import GroupWorkRoundedIcon from '@mui/icons-material/GroupWorkRounded';
import PeopleRoundedIcon from '@mui/icons-material/PeopleRounded';
import {
  Alert,
  Box,
  Button,
  Chip,
  MenuItem,
  Paper,
  Stack,
  Switch,
  TextField,
  Typography,
} from '@mui/material';
import { useCallback, useEffect, useState } from 'react';

import { api } from '../api/client';
import { useAuth } from '../context/AuthContext';
import type { AdminAnalyticsOverview, AdminGroup, User } from '../types';

const emptyAnalyst = {
  full_name: '',
  email: '',
  password: '',
  role: 'analyst',
  skills: 'analytics,reports',
};

function MetricCard({ title, value, icon }: { title: string; value: string | number; icon: React.ReactNode }) {
  return (
    <Paper sx={{ p: 2.25, borderRadius: 2.5 }}>
      <Stack direction="row" justifyContent="space-between" alignItems="flex-start" spacing={2}>
        <Box>
          <Typography variant="body2" color="text.secondary">{title}</Typography>
          <Typography variant="h4" sx={{ mt: 1 }}>{value}</Typography>
        </Box>
        <Box sx={{ color: 'text.secondary' }}>{icon}</Box>
      </Stack>
    </Paper>
  );
}

export function AdminPage() {
  const { user } = useAuth();
  const isReadOnly = user?.role === 'analyst';
  const [overview, setOverview] = useState<AdminAnalyticsOverview | null>(null);
  const [users, setUsers] = useState<User[]>([]);
  const [groups, setGroups] = useState<AdminGroup[]>([]);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [analystForm, setAnalystForm] = useState(emptyAnalyst);

  const loadAdminData = useCallback(async () => {
    const [overviewResponse, groupsResponse] = await Promise.all([
      api.get<AdminAnalyticsOverview>('/admin/analytics'),
      api.get<AdminGroup[]>('/admin/groups'),
    ]);
    setOverview(overviewResponse.data);
    setGroups(groupsResponse.data);
    if (!isReadOnly) {
      const usersResponse = await api.get<User[]>('/admin/users');
      setUsers(usersResponse.data);
    }
  }, [isReadOnly]);

  useEffect(() => {
    loadAdminData().catch((err: Error) => setError(err.message || 'Не удалось загрузить данные админ-панели.'));
  }, [loadAdminData]);

  async function handleCreateAnalyst() {
    try {
      await api.post('/admin/users', {
        ...analystForm,
        skills: analystForm.skills.split(',').map((item) => item.trim()).filter(Boolean),
      });
      setAnalystForm(emptyAnalyst);
      setSuccess('Аналитик создан.');
      await loadAdminData();
    } catch (err) {
      setError((err as Error).message || 'Не удалось создать аналитика.');
    }
  }

  async function toggleUserActive(target: User) {
    try {
      await api.patch(`/admin/users/${target.id}`, { is_active: !(target as User & { is_active?: boolean }).is_active });
      await loadAdminData();
    } catch (err) {
      setError((err as Error).message || 'Не удалось обновить пользователя.');
    }
  }

  async function toggleModerator(groupId: number, userId: number, canModerate: boolean) {
    try {
      await api.patch(`/admin/groups/${groupId}/members/${userId}`, { can_moderate: !canModerate });
      await loadAdminData();
    } catch (err) {
      setError((err as Error).message || 'Не удалось обновить права модератора.');
    }
  }

  async function updateGroupVisibility(groupId: number, visibility: 'public' | 'private') {
    try {
      await api.patch(`/admin/groups/${groupId}`, { visibility });
      await loadAdminData();
    } catch (err) {
      setError((err as Error).message || 'Не удалось обновить видимость группы.');
    }
  }

  if (!user || (user.role !== 'admin' && user.role !== 'analyst')) {
    return <Alert severity="warning">Доступ к админ-панели закрыт.</Alert>;
  }

  return (
    <Stack spacing={3}>
      <Box>
        <Typography variant="h4">{isReadOnly ? 'Аналитика платформы' : 'Панель администратора'}</Typography>
        <Typography variant="body2" color="text.secondary" sx={{ mt: 0.75, maxWidth: 760 }}>
          {isReadOnly
            ? 'У вас доступ только на просмотр общей статистики и структуры групп.'
            : 'Здесь можно управлять пользователями, назначать аналитиков, модерировать группы и следить за общими метриками сайта.'}
        </Typography>
      </Box>

      {error ? <Alert severity="warning" onClose={() => setError('')}>{error}</Alert> : null}
      {success ? <Alert severity="success" onClose={() => setSuccess('')}>{success}</Alert> : null}

      {overview ? (
        <Box sx={{ display: 'grid', gap: 2, gridTemplateColumns: { xs: '1fr', md: 'repeat(4, minmax(0, 1fr))' } }}>
          <MetricCard title="Пользователи" value={overview.total_users} icon={<PeopleRoundedIcon />} />
          <MetricCard title="Активные пользователи" value={overview.active_users} icon={<AnalyticsRoundedIcon />} />
          <MetricCard title="Группы" value={overview.total_groups} icon={<GroupWorkRoundedIcon />} />
          <MetricCard title="Активные сессии" value={overview.active_sessions} icon={<AnalyticsRoundedIcon />} />
        </Box>
      ) : null}

      <Box sx={{ display: 'grid', gap: 2, gridTemplateColumns: { xs: '1fr', xl: isReadOnly ? '1fr 1fr' : '1.15fr 0.85fr' } }}>
        <Paper sx={{ p: 2.5, borderRadius: 2.5 }}>
          <Stack spacing={2}>
            <Typography variant="h5">Сводная аналитика</Typography>
            {overview ? (
              <>
                <Stack direction="row" spacing={1} useFlexGap flexWrap="wrap">
                  <Chip label={`Приватных групп: ${overview.private_groups}`} />
                  <Chip label={`Дружб и заявок: ${overview.total_friendships}`} />
                  <Chip label={`Выполненных задач: ${overview.completed_tasks}`} />
                  <Chip label={`Открытых задач: ${overview.pending_tasks}`} />
                </Stack>
                <Paper sx={{ p: 2, borderRadius: 2 }}>
                  <Typography variant="subtitle1">Распределение ролей</Typography>
                  <Stack direction="row" spacing={1} useFlexGap flexWrap="wrap" sx={{ mt: 1 }}>
                    {Object.entries(overview.role_distribution).map(([role, count]) => (
                      <Chip key={role} label={`${role}: ${count}`} />
                    ))}
                  </Stack>
                </Paper>
                <Paper sx={{ p: 2, borderRadius: 2 }}>
                  <Typography variant="subtitle1">Самые большие группы</Typography>
                  <Stack spacing={1} sx={{ mt: 1 }}>
                    {overview.top_groups.map((group) => (
                      <Box key={group.id} sx={{ display: 'flex', justifyContent: 'space-between', gap: 2 }}>
                        <Typography variant="body2">{group.name}</Typography>
                        <Typography variant="body2" color="text.secondary">{group.member_count} участников</Typography>
                      </Box>
                    ))}
                  </Stack>
                </Paper>
              </>
            ) : null}
          </Stack>
        </Paper>

        <Paper sx={{ p: 2.5, borderRadius: 2.5 }}>
          <Stack spacing={2}>
            <Typography variant="h5">Новые пользователи</Typography>
            {overview?.recent_users.map((item) => (
              <Paper key={item.id} sx={{ p: 1.5, borderRadius: 2 }}>
                <Typography variant="subtitle2">{item.full_name}</Typography>
                <Typography variant="body2" color="text.secondary">{item.email}</Typography>
                <Typography variant="caption" color="text.secondary">
                  Роль: {item.role} | {item.is_active ? 'активен' : 'заблокирован'}
                </Typography>
              </Paper>
            ))}
          </Stack>
        </Paper>
      </Box>

      {!isReadOnly ? (
        <Box sx={{ display: 'grid', gap: 2, gridTemplateColumns: { xs: '1fr', xl: '0.9fr 1.1fr' } }}>
          <Paper sx={{ p: 2.5, borderRadius: 2.5 }}>
            <Stack spacing={2}>
              <Typography variant="h5">Назначить аналитика</Typography>
              <TextField label="ФИО" value={analystForm.full_name} onChange={(event) => setAnalystForm((prev) => ({ ...prev, full_name: event.target.value }))} />
              <TextField label="Email" value={analystForm.email} onChange={(event) => setAnalystForm((prev) => ({ ...prev, email: event.target.value }))} />
              <TextField label="Пароль" type="password" value={analystForm.password} onChange={(event) => setAnalystForm((prev) => ({ ...prev, password: event.target.value }))} />
              <TextField select label="Роль" value={analystForm.role} onChange={(event) => setAnalystForm((prev) => ({ ...prev, role: event.target.value }))}>
                <MenuItem value="analyst">Аналитик</MenuItem>
                <MenuItem value="student">Студент</MenuItem>
                <MenuItem value="instructor">Преподаватель</MenuItem>
              </TextField>
              <TextField label="Навыки" value={analystForm.skills} onChange={(event) => setAnalystForm((prev) => ({ ...prev, skills: event.target.value }))} />
              <Button variant="contained" onClick={() => void handleCreateAnalyst()} disabled={!analystForm.full_name || !analystForm.email || !analystForm.password}>
                Создать пользователя
              </Button>
            </Stack>
          </Paper>

          <Paper sx={{ p: 2.5, borderRadius: 2.5 }}>
            <Stack spacing={1.5}>
              <Typography variant="h5">Пользователи сайта</Typography>
              {users.map((item) => (
                <Paper key={item.id} sx={{ p: 1.5, borderRadius: 2 }}>
                  <Stack direction={{ xs: 'column', md: 'row' }} justifyContent="space-between" spacing={1.5}>
                    <Box>
                      <Typography variant="subtitle2">{item.full_name}</Typography>
                      <Typography variant="body2" color="text.secondary">{item.email}</Typography>
                      <Typography variant="caption" color="text.secondary">
                        Роль: {item.role} | Навыки: {item.skills.join(', ') || 'не указаны'}
                      </Typography>
                    </Box>
                    <Stack direction="row" spacing={1} alignItems="center">
                      <Typography variant="body2" color="text.secondary">Активен</Typography>
                      <Switch
                        checked={Boolean((item as User & { is_active?: boolean }).is_active ?? true)}
                        onChange={() => void toggleUserActive(item)}
                      />
                    </Stack>
                  </Stack>
                </Paper>
              ))}
            </Stack>
          </Paper>
        </Box>
      ) : null}

      <Paper sx={{ p: 2.5, borderRadius: 2.5 }}>
        <Stack spacing={2}>
          <Typography variant="h5">Группы и модераторы</Typography>
          {groups.map((group) => (
            <Paper key={group.id} sx={{ p: 2, borderRadius: 2 }}>
              <Stack spacing={1.5}>
                <Stack direction={{ xs: 'column', md: 'row' }} justifyContent="space-between" spacing={1.5}>
                  <Box>
                    <Typography variant="subtitle1">{group.name}</Typography>
                    <Typography variant="body2" color="text.secondary">{group.description || 'Описание не заполнено.'}</Typography>
                    <Typography variant="caption" color="text.secondary">
                      Владелец: {group.owner_name} | Участников: {group.member_count} | Активных сессий: {group.active_sessions}
                    </Typography>
                  </Box>
                  <Stack direction="row" spacing={1} useFlexGap flexWrap="wrap">
                    <Chip label={group.visibility === 'private' ? 'Приватная' : 'Открытая'} />
                    {!isReadOnly ? (
                      <Button
                        variant="outlined"
                        onClick={() => void updateGroupVisibility(group.id, group.visibility === 'private' ? 'public' : 'private')}
                      >
                        Сделать {group.visibility === 'private' ? 'открытой' : 'приватной'}
                      </Button>
                    ) : null}
                  </Stack>
                </Stack>
                <Stack spacing={1}>
                  {group.members.map((member) => (
                    <Paper key={member.user_id} sx={{ p: 1.25, borderRadius: 2 }}>
                      <Stack direction={{ xs: 'column', md: 'row' }} justifyContent="space-between" spacing={1}>
                        <Box>
                          <Typography variant="subtitle2">{member.full_name}</Typography>
                          <Typography variant="body2" color="text.secondary">{member.email}</Typography>
                          <Typography variant="caption" color="text.secondary">Роль: {member.role}</Typography>
                        </Box>
                        {!isReadOnly ? (
                          <Button variant="outlined" onClick={() => void toggleModerator(group.id, member.user_id, member.can_moderate)}>
                            {member.can_moderate ? 'Снять модератора' : 'Сделать модератором'}
                          </Button>
                        ) : (
                          <Chip label={member.can_moderate ? 'Модератор' : 'Участник'} />
                        )}
                      </Stack>
                    </Paper>
                  ))}
                </Stack>
              </Stack>
            </Paper>
          ))}
        </Stack>
      </Paper>
    </Stack>
  );
}
