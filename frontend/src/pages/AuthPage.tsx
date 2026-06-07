import { Alert, Box, Button, Chip, MenuItem, Paper, Stack, Tab, Tabs, TextField, Typography } from '@mui/material';
import { FormEvent, useState } from 'react';
import { Navigate } from 'react-router-dom';

import { SkillsTagInput } from '../components/SkillsTagInput';
import { useAuth } from '../context/AuthContext';

export function AuthPage() {
  const { user, login, register } = useAuth();
  const [tab, setTab] = useState(0);
  const [error, setError] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [fullName, setFullName] = useState('');
  const [role, setRole] = useState<'student' | 'instructor'>('student');
  const [skills, setSkills] = useState<string[]>([]);

  if (user) {
    return <Navigate to={user.role === 'analyst' ? '/admin' : '/dashboard'} replace />;
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
          skills,
        });
      }
    } catch (err) {
      setError((err as Error).message || 'Не удалось выполнить действие.');
    }
  }

  return (
    <Box sx={{ minHeight: '100vh', display: 'grid', placeItems: 'center', px: 2, py: 4 }}>
      <Box sx={{ width: '100%', maxWidth: 1080, display: 'grid', gap: 3, gridTemplateColumns: { xs: '1fr', lg: 'minmax(0, 1.1fr) minmax(420px, 480px)' } }}>
        <Paper sx={{ p: { xs: 3, md: 5 }, borderRadius: 3, display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
          <Stack spacing={3}>
            <Chip label="Платформа StudySession" sx={{ alignSelf: 'flex-start' }} />
            <Box>
              <Typography variant="h2" sx={{ maxWidth: 560 }}>
                Единое пространство для учебных встреч, групп, задач и материалов.
              </Typography>
              <Typography variant="body1" color="text.secondary" sx={{ mt: 2, maxWidth: 560 }}>
                Здесь можно вести групповые встречи, искать друзей, работать с материалами, модерировать сообщества и следить за аналитикой сайта.
              </Typography>
            </Box>
            <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1.5}>
              <Paper sx={{ p: 2.5, flex: 1, borderRadius: 3, bgcolor: '#f9fafb' }}>
                <Typography variant="subtitle2">Группы и видеосессии</Typography>
                <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
                  Создавайте учебные комнаты, открывайте общие чаты и храните историю встреч в одном месте.
                </Typography>
              </Paper>
              <Paper sx={{ p: 2.5, flex: 1, borderRadius: 3, bgcolor: '#f9fafb' }}>
                <Typography variant="subtitle2">Админка и аналитика</Typography>
                <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
                  Вход `admin / admin` открывает панель управления пользователями, группами и общей статистикой платформы.
                </Typography>
              </Paper>
            </Stack>
          </Stack>
        </Paper>

        <Paper sx={{ p: { xs: 3, md: 4 }, borderRadius: 3 }}>
          <Typography variant="h4">Вход в рабочее пространство</Typography>
          <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
            Войдите в существующий аккаунт или создайте новый профиль.
          </Typography>
          <Tabs value={tab} onChange={(_, value) => setTab(value)} sx={{ mt: 3, mb: 3 }}>
            <Tab label="Вход" />
            <Tab label="Регистрация" />
          </Tabs>
          {error ? <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert> : null}
          <Stack component="form" spacing={2} onSubmit={onSubmit}>
            {tab === 1 ? <TextField label="ФИО" value={fullName} onChange={(e) => setFullName(e.target.value)} required /> : null}
            <TextField label={tab === 0 ? 'Логин или email' : 'Email'} type="text" value={email} onChange={(e) => setEmail(e.target.value)} required />
            <TextField label="Пароль" type="password" value={password} onChange={(e) => setPassword(e.target.value)} required />
            {tab === 1 ? (
              <>
                <TextField select label="Роль" value={role} onChange={(e) => setRole(e.target.value as 'student' | 'instructor')}>
                  <MenuItem value="student">Студент</MenuItem>
                  <MenuItem value="instructor">Преподаватель</MenuItem>
                </TextField>
                <SkillsTagInput
                  value={skills}
                  onChange={setSkills}
                  helperText="Необязательно. Добавьте навыки тегами, чтобы распределение задач было точнее."
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
