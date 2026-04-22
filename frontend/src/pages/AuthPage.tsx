import {
  Alert,
  Box,
  Button,
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
    <Box sx={{ minHeight: 'calc(100vh - 140px)', display: 'grid', placeItems: 'center' }}>
      <Paper sx={{ width: 440, p: 3, borderRadius: 3 }}>
        <Typography variant="h4" fontWeight={800}>Платформа совместной работы</Typography>
        <Typography variant="body2" color="text.secondary">Учебные видеосессии, задачи и ML-помощник.</Typography>
        <Tabs value={tab} onChange={(_, value) => setTab(value)} sx={{ mt: 2, mb: 2 }}>
          <Tab label="Вход" />
          <Tab label="Регистрация" />
        </Tabs>
        {error && <Alert severity="error">{error}</Alert>}
        <Stack component="form" spacing={2} sx={{ mt: 1 }} onSubmit={onSubmit}>
          {tab === 1 && <TextField label="ФИО" value={fullName} onChange={(e) => setFullName(e.target.value)} required />}
          <TextField label="Email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
          <TextField label="Пароль" type="password" value={password} onChange={(e) => setPassword(e.target.value)} required />
          {tab === 1 && (
            <>
              <TextField select label="Роль" value={role} onChange={(e) => setRole(e.target.value as 'student' | 'instructor')}>
                <MenuItem value="student">Студент</MenuItem>
                <MenuItem value="instructor">Преподаватель</MenuItem>
              </TextField>
              <TextField
                label="Навыки (через запятую)"
                value={skills}
                onChange={(e) => setSkills(e.target.value)}
                placeholder="python, аналитика, презентации"
              />
            </>
          )}
          <Button type="submit" variant="contained" size="large">
            {tab === 0 ? 'Войти' : 'Создать аккаунт'}
          </Button>
        </Stack>
      </Paper>
    </Box>
  );
}
