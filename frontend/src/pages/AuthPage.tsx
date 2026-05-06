import {
  Alert,
  Box,
  Button,
  Chip,
  MenuItem,
  Paper,
  Stack,
  Tab,
  Tabs,
  TextField,
  Typography,
} from '@mui/material';
import { FormEvent, useState } from 'react';
import { Navigate } from 'react-router-dom';

import { useAuth } from '../context/AuthContext';

export function AuthPage() {
  const { user, login, register } = useAuth();
  const [tab, setTab] = useState(0);
  const [error, setError] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [fullName, setFullName] = useState('');
  const [role, setRole] = useState<'student' | 'instructor'>('student');
  const [skills, setSkills] = useState('');

  if (user) {
    return <Navigate to="/dashboard" replace />;
  }

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    setError('');

    try {
      if (tab === 0) {
        await login(email, password);
      } else {
        await register({
          email,
          password,
          full_name: fullName,
          role,
          skills: skills.split(',').map((item) => item.trim()).filter(Boolean),
        });
      }
    } catch (err) {
      setError((err as Error).message || 'Не удалось выполнить действие.');
    }
  }

  return (
    <Box sx={{ minHeight: '100vh', display: 'grid', placeItems: 'center', px: 2, py: 4 }}>
      <Box
        sx={{
          width: '100%',
          maxWidth: 1080,
          display: 'grid',
          gap: 3,
          gridTemplateColumns: { xs: '1fr', lg: 'minmax(0, 1.1fr) minmax(420px, 480px)' },
        }}
      >
        <Paper sx={{ p: { xs: 3, md: 5 }, borderRadius: 3, display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
          <Stack spacing={3}>
            <Chip label="StudySession Platform" sx={{ alignSelf: 'flex-start' }} />
            <Box>
              <Typography variant="h2" sx={{ maxWidth: 540 }}>
                Спокойный рабочий контур для учебных встреч, задач и материалов.
              </Typography>
              <Typography variant="body1" color="text.secondary" sx={{ mt: 2, maxWidth: 560 }}>
                Платформа объединяет видеосессии, командные задачи, историю встреч и материалы в одном аккуратном интерфейсе без лишнего шума.
              </Typography>
            </Box>
            <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1.5}>
              <Paper sx={{ p: 2.5, flex: 1, borderRadius: 3, bgcolor: '#f9fafb' }}>
                <Typography variant="subtitle2">Видеосессии</Typography>
                <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
                  Чистая комната для работы команды с фокусом на контенте.
                </Typography>
              </Paper>
              <Paper sx={{ p: 2.5, flex: 1, borderRadius: 3, bgcolor: '#f9fafb' }}>
                <Typography variant="subtitle2">Kanban и материалы</Typography>
                <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
                  Задачи, история и файлы собраны в одном предсказуемом потоке.
                </Typography>
              </Paper>
            </Stack>
          </Stack>
        </Paper>

        <Paper sx={{ p: { xs: 3, md: 4 }, borderRadius: 3 }}>
          <Typography variant="h4">Вход в рабочее пространство</Typography>
          <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
            Используйте существующий аккаунт или создайте новый профиль.
          </Typography>
          <Tabs value={tab} onChange={(_, value) => setTab(value)} sx={{ mt: 3, mb: 3 }}>
            <Tab label="Вход" />
            <Tab label="Регистрация" />
          </Tabs>
          {error ? <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert> : null}
          <Stack component="form" spacing={2} onSubmit={onSubmit}>
            {tab === 1 ? <TextField label="ФИО" value={fullName} onChange={(e) => setFullName(e.target.value)} required /> : null}
            <TextField label="Email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
            <TextField label="Пароль" type="password" value={password} onChange={(e) => setPassword(e.target.value)} required />
            {tab === 1 ? (
              <>
                <TextField select label="Роль" value={role} onChange={(e) => setRole(e.target.value as 'student' | 'instructor')}>
                  <MenuItem value="student">Студент</MenuItem>
                  <MenuItem value="instructor">Преподаватель</MenuItem>
                </TextField>
                <TextField
                  label="Навыки"
                  value={skills}
                  onChange={(e) => setSkills(e.target.value)}
                  placeholder="python, аналитика, презентации"
                  helperText="Необязательно. Укажите навыки через запятую."
                />
              </>
            ) : null}
            <Button type="submit" variant="contained" size="large">
              {tab === 0 ? 'Войти' : 'Создать аккаунт'}
            </Button>
          </Stack>
        </Paper>
      </Box>
    </Box>
  );
}
