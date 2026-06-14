import {
  Alert,
  Box,
  Button,
  MenuItem,
  Paper,
  Stack,
  Switch,
  TextField,
  Typography,
} from '@mui/material';
import { useCallback, useEffect, useState } from 'react';

import { api } from '../../api/client';
import { roleLabel } from '../../utils/roleLabels';
import type { User } from '../../types';

const emptyAnalyst = {
  full_name: '',
  email: '',
  password: '',
  role: 'analyst',
  skills: 'analytics,reports',
};

export function AdminUsersPage() {
  const [users, setUsers] = useState<User[]>([]);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [analystForm, setAnalystForm] = useState(emptyAnalyst);

  const loadUsers = useCallback(async () => {
    const response = await api.get<User[]>('/admin/users');
    setUsers(response.data);
  }, []);

  useEffect(() => {
    loadUsers().catch((err: Error) => setError(err.message || 'Не удалось загрузить пользователей.'));
  }, [loadUsers]);

  async function handleCreateAnalyst() {
    try {
      await api.post('/admin/users', {
        ...analystForm,
        skills: analystForm.skills.split(',').map((item) => item.trim()).filter(Boolean),
      });
      setAnalystForm(emptyAnalyst);
      setSuccess('Пользователь создан.');
      await loadUsers();
    } catch (err) {
      setError((err as Error).message || 'Не удалось создать пользователя.');
    }
  }

  async function toggleUserActive(target: User) {
    try {
      await api.patch(`/admin/users/${target.id}`, { is_active: !(target as User & { is_active?: boolean }).is_active });
      await loadUsers();
    } catch (err) {
      setError((err as Error).message || 'Не удалось обновить пользователя.');
    }
  }

  return (
    <Stack spacing={2}>
      {error ? <Alert severity="warning" onClose={() => setError('')}>{error}</Alert> : null}
      {success ? <Alert severity="success" onClose={() => setSuccess('')}>{success}</Alert> : null}

      <Box sx={{ display: 'grid', gap: 2, gridTemplateColumns: { xs: '1fr', xl: '380px minmax(0, 1fr)' } }}>
        <Paper sx={{ p: 2.5, borderRadius: 2.5 }}>
          <Typography variant="subtitle1" sx={{ mb: 2 }}>Создать пользователя</Typography>
          <Stack spacing={2}>
            <TextField label="ФИО" value={analystForm.full_name} onChange={(event) => setAnalystForm((prev) => ({ ...prev, full_name: event.target.value }))} fullWidth />
            <TextField label="Email" value={analystForm.email} onChange={(event) => setAnalystForm((prev) => ({ ...prev, email: event.target.value }))} fullWidth />
            <TextField label="Пароль" type="password" value={analystForm.password} onChange={(event) => setAnalystForm((prev) => ({ ...prev, password: event.target.value }))} fullWidth />
            <TextField select label="Роль" value={analystForm.role} onChange={(event) => setAnalystForm((prev) => ({ ...prev, role: event.target.value }))} fullWidth>
              <MenuItem value="analyst">Аналитик</MenuItem>
              <MenuItem value="student">Студент</MenuItem>
              <MenuItem value="instructor">Преподаватель</MenuItem>
            </TextField>
            <TextField label="Навыки через запятую" value={analystForm.skills} onChange={(event) => setAnalystForm((prev) => ({ ...prev, skills: event.target.value }))} fullWidth />
            <Button variant="contained" onClick={() => void handleCreateAnalyst()} disabled={!analystForm.full_name || !analystForm.email || !analystForm.password} fullWidth>
              Создать
            </Button>
          </Stack>
        </Paper>

        <Paper sx={{ p: 2.5, borderRadius: 2.5 }}>
          <Typography variant="subtitle1" sx={{ mb: 2 }}>Все пользователи ({users.length})</Typography>
          <Stack spacing={1.25}>
            {users.map((item) => (
              <Paper key={item.id} variant="outlined" sx={{ p: 1.75, borderRadius: 2 }}>
                <Stack direction={{ xs: 'column', sm: 'row' }} justifyContent="space-between" alignItems={{ sm: 'center' }} spacing={1.5}>
                  <Box sx={{ minWidth: 0 }}>
                    <Typography variant="subtitle2">{item.full_name}</Typography>
                    <Typography variant="body2" color="text.secondary">{item.email}</Typography>
                    <Typography variant="caption" color="text.secondary">
                      {roleLabel(item.role)} · {item.skills.join(', ') || 'навыки не указаны'}
                    </Typography>
                  </Box>
                  <Stack direction="row" spacing={1} alignItems="center" flexShrink={0}>
                    <Typography variant="body2" color="text.secondary">Активен</Typography>
                    <Switch checked={Boolean((item as User & { is_active?: boolean }).is_active ?? true)} onChange={() => void toggleUserActive(item)} />
                  </Stack>
                </Stack>
              </Paper>
            ))}
          </Stack>
        </Paper>
      </Box>
    </Stack>
  );
}
