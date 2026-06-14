import AutoStoriesRoundedIcon from '@mui/icons-material/AutoStoriesRounded';
import GroupsRoundedIcon from '@mui/icons-material/GroupsRounded';
import TaskAltRoundedIcon from '@mui/icons-material/TaskAltRounded';
import VideocamRoundedIcon from '@mui/icons-material/VideocamRounded';
import { Alert, Box, Button, Divider, Paper, Stack, Tab, Tabs, TextField, Typography } from '@mui/material';
import { alpha, useTheme } from '@mui/material/styles';
import { FormEvent, useState } from 'react';
import { Navigate } from 'react-router-dom';

import { SkillsTagInput } from '../components/SkillsTagInput';
import { StudySessionLogo } from '../components/StudySessionLogo';
import { useAuth } from '../context/AuthContext';

const features = [
  {
    icon: <VideocamRoundedIcon fontSize="small" />,
    title: 'Видеосессии',
    description: 'Совместные учебные встречи с чатом, задачами и материалами в одной комнате.',
  },
  {
    icon: <GroupsRoundedIcon fontSize="small" />,
    title: 'Группы',
    description: 'Объединяйтесь в команды, приглашайте участников и планируйте занятия.',
  },
  {
    icon: <TaskAltRoundedIcon fontSize="small" />,
    title: 'Задачи',
    description: 'Канбан-доска для распределения работы и отслеживания прогресса.',
  },
  {
    icon: <AutoStoriesRoundedIcon fontSize="small" />,
    title: 'Материалы',
    description: 'Общие файлы и заметки, доступные всем участникам группы.',
  },
];

export function AuthPage() {
  const theme = useTheme();
  const { user, login, register } = useAuth();
  const [tab, setTab] = useState(0);
  const [error, setError] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [fullName, setFullName] = useState('');
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
          role: 'student',
          skills,
        });
      }
    } catch (err) {
      setError((err as Error).message || 'Не удалось выполнить действие.');
    }
  }

  return (
    <Box
      sx={{
        minHeight: '100vh',
        display: 'grid',
        placeItems: 'center',
        px: 2,
        py: 4,
        background: `linear-gradient(135deg, ${alpha(theme.palette.text.primary, 0.04)} 0%, ${alpha('#3b82f6', 0.08)} 100%)`,
      }}
    >
      <Box
        sx={{
          width: '100%',
          maxWidth: 960,
          display: 'grid',
          gap: 3,
          gridTemplateColumns: { xs: '1fr', md: '1fr 400px' },
          alignItems: 'center',
        }}
      >
        <Paper sx={{ p: { xs: 3, md: 3.5 }, borderRadius: 3 }}>
          <Stack spacing={3}>
            <Stack direction="row" spacing={1.5} alignItems="center">
              <StudySessionLogo size={48} sx={{ color: 'text.primary' }} />
              <Typography variant="h5">StudySession</Typography>
            </Stack>

            <Box>
              <Typography variant="h3" sx={{ maxWidth: 480, lineHeight: 1.2 }}>
                Учитесь вместе — онлайн и без лишнего
              </Typography>
              <Typography variant="body1" color="text.secondary" sx={{ mt: 1.5, maxWidth: 460 }}>
                Платформа для совместных учебных сессий: видеозвонки, группы, задачи и материалы в одном месте.
              </Typography>
            </Box>

            <Box sx={{ display: 'grid', gap: 1.5, gridTemplateColumns: { xs: '1fr', sm: '1fr 1fr' } }}>
              {features.map((feature) => (
                <Paper key={feature.title} variant="outlined" sx={{ p: 2, borderRadius: 2, boxShadow: 'none' }}>
                  <Stack direction="row" spacing={1.5} alignItems="flex-start">
                    <Box
                      sx={{
                        width: 36,
                        height: 36,
                        borderRadius: 1.5,
                        display: 'grid',
                        placeItems: 'center',
                        bgcolor: alpha(theme.palette.text.primary, 0.06),
                        flexShrink: 0,
                      }}
                    >
                      {feature.icon}
                    </Box>
                    <Box>
                      <Typography variant="subtitle2">{feature.title}</Typography>
                      <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
                        {feature.description}
                      </Typography>
                    </Box>
                  </Stack>
                </Paper>
              ))}
            </Box>
          </Stack>
        </Paper>

        <Paper sx={{ p: { xs: 3, md: 3.5 }, borderRadius: 3 }}>
          <Typography variant="h5">{tab === 0 ? 'Вход' : 'Регистрация'}</Typography>

          <Tabs value={tab} onChange={(_, value) => setTab(value)} sx={{ mt: 2.5, mb: 2 }}>
            <Tab label="Вход" />
            <Tab label="Регистрация" />
          </Tabs>

          {error ? <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert> : null}

          <Stack component="form" spacing={2} onSubmit={onSubmit}>
            {tab === 1 ? (
              <TextField label="ФИО" value={fullName} onChange={(e) => setFullName(e.target.value)} required fullWidth />
            ) : null}
            <TextField
              label={tab === 0 ? 'Логин или email' : 'Email'}
              type="text"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              fullWidth
            />
            <TextField
              label="Пароль"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              fullWidth
            />
            {tab === 1 ? (
              <SkillsTagInput value={skills} onChange={setSkills} />
            ) : null}
            <Divider sx={{ mt: 1 }} />
            <Button type="submit" variant="contained" fullWidth>
              {tab === 0 ? 'Войти' : 'Создать аккаунт'}
            </Button>
          </Stack>
        </Paper>
      </Box>
    </Box>
  );
}
