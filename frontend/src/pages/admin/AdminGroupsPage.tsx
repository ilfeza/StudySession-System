import {
  Alert,
  Box,
  Button,
  Chip,
  Paper,
  Stack,
  Typography,
} from '@mui/material';
import { useCallback, useEffect, useState } from 'react';

import { api } from '../../api/client';
import { useAuth } from '../../context/AuthContext';
import { roleLabel } from '../../utils/roleLabels';
import type { AdminGroup } from '../../types';

export function AdminGroupsPage() {
  const { user } = useAuth();
  const isReadOnly = user?.role === 'analyst';
  const [groups, setGroups] = useState<AdminGroup[]>([]);
  const [error, setError] = useState('');

  const loadGroups = useCallback(async () => {
    const response = await api.get<AdminGroup[]>('/admin/groups');
    setGroups(response.data);
  }, []);

  useEffect(() => {
    loadGroups().catch((err: Error) => setError(err.message || 'Не удалось загрузить группы.'));
  }, [loadGroups]);

  async function toggleModerator(groupId: number, userId: number, canModerate: boolean) {
    try {
      await api.patch(`/admin/groups/${groupId}/members/${userId}`, { can_moderate: !canModerate });
      await loadGroups();
    } catch (err) {
      setError((err as Error).message || 'Не удалось обновить права модератора.');
    }
  }

  async function updateGroupVisibility(groupId: number, visibility: 'public' | 'private') {
    try {
      await api.patch(`/admin/groups/${groupId}`, { visibility });
      await loadGroups();
    } catch (err) {
      setError((err as Error).message || 'Не удалось обновить видимость группы.');
    }
  }

  return (
    <Stack spacing={1.5}>
      {error ? <Alert severity="warning" onClose={() => setError('')}>{error}</Alert> : null}

      {groups.map((group) => (
        <Paper key={group.id} sx={{ p: 2.5, borderRadius: 2.5 }}>
          <Stack spacing={2}>
            <Stack direction={{ xs: 'column', md: 'row' }} justifyContent="space-between" spacing={1.5}>
              <Box sx={{ minWidth: 0 }}>
                <Stack direction="row" spacing={1} alignItems="center" useFlexGap flexWrap="wrap">
                  <Typography variant="subtitle1">{group.name}</Typography>
                  <Chip size="small" label={group.visibility === 'private' ? 'Приватная' : 'Открытая'} />
                </Stack>
                <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
                  {group.description || 'Описание не заполнено.'}
                </Typography>
                <Typography variant="caption" color="text.secondary" sx={{ mt: 0.5, display: 'block' }}>
                  Владелец: {group.owner_name} · {group.member_count} участников · {group.active_sessions} активных сессий
                </Typography>
              </Box>
              {!isReadOnly ? (
                <Button variant="outlined" onClick={() => void updateGroupVisibility(group.id, group.visibility === 'private' ? 'public' : 'private')} sx={{ flexShrink: 0, alignSelf: { md: 'flex-start' } }}>
                  Сделать {group.visibility === 'private' ? 'открытой' : 'приватной'}
                </Button>
              ) : null}
            </Stack>

            <Stack spacing={1}>
              {group.members.map((member) => (
                <Paper key={member.user_id} variant="outlined" sx={{ p: 1.5, borderRadius: 2 }}>
                  <Stack direction={{ xs: 'column', sm: 'row' }} justifyContent="space-between" alignItems={{ sm: 'center' }} spacing={1}>
                    <Box>
                      <Typography variant="body2" sx={{ fontWeight: 600 }}>{member.full_name}</Typography>
                      <Typography variant="caption" color="text.secondary">
                        {member.email} · {roleLabel(member.role)}
                      </Typography>
                    </Box>
                    {!isReadOnly ? (
                      <Button variant="outlined" onClick={() => void toggleModerator(group.id, member.user_id, member.can_moderate)} sx={{ flexShrink: 0 }}>
                        {member.can_moderate ? 'Снять модератора' : 'Назначить модератором'}
                      </Button>
                    ) : (
                      <Chip size="small" label={member.can_moderate ? 'Модератор' : 'Участник'} />
                    )}
                  </Stack>
                </Paper>
              ))}
            </Stack>
          </Stack>
        </Paper>
      ))}

      {!groups.length ? (
        <Paper sx={{ p: 3, borderRadius: 2.5 }}>
          <Typography variant="body2" color="text.secondary">Групп пока нет.</Typography>
        </Paper>
      ) : null}
    </Stack>
  );
}
