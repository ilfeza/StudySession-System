import AlternateEmailRoundedIcon from '@mui/icons-material/AlternateEmailRounded';
import CameraAltOutlinedIcon from '@mui/icons-material/CameraAltOutlined';
import ChevronRightRoundedIcon from '@mui/icons-material/ChevronRightRounded';
import EditRoundedIcon from '@mui/icons-material/EditRounded';
import EmailRoundedIcon from '@mui/icons-material/EmailRounded';
import InsightsRoundedIcon from '@mui/icons-material/InsightsRounded';
import LockRoundedIcon from '@mui/icons-material/LockRounded';
import LogoutRoundedIcon from '@mui/icons-material/LogoutRounded';
import PaletteOutlinedIcon from '@mui/icons-material/PaletteOutlined';
import PersonRoundedIcon from '@mui/icons-material/PersonRounded';
import ShieldOutlinedIcon from '@mui/icons-material/ShieldOutlined';
import TaskAltRoundedIcon from '@mui/icons-material/TaskAltRounded';
import VideoCameraFrontRoundedIcon from '@mui/icons-material/VideoCameraFrontRounded';
import {
  Alert,
  Avatar,
  Box,
  Button,
  Chip,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Divider,
  Paper,
  Stack,
  Switch,
  TextField,
  Typography,
} from '@mui/material';
import type { ReactNode } from 'react';
import { useEffect, useMemo, useState } from 'react';

import { api } from '../api/client';
import { useAuth } from '../context/AuthContext';
import type { UserProgress, UserRole } from '../types';

function getInitials(fullName: string) {
  const parts = fullName.trim().split(/\s+/).filter(Boolean);
  return parts.slice(0, 2).map((part) => part[0]?.toUpperCase() ?? '').join('') || 'U';
}

function createUsername(fullName: string, email: string) {
  const localPart = email.split('@')[0]?.trim();
  if (localPart) {
    return localPart.toLowerCase();
  }

  return fullName.trim().toLowerCase().replace(/\s+/g, '.');
}

function roleLabel(role?: UserRole) {
  switch (role) {
    case 'admin':
      return 'Администратор платформы';
    case 'instructor':
      return 'Куратор обучения';
    case 'student':
    default:
      return 'Участник учебных сессий';
  }
}

function MetricCard({ title, value, icon }: { title: string; value: number; icon: ReactNode }) {
  return (
    <Paper sx={{ p: 2.25, borderRadius: '12px' }}>
      <Stack spacing={1.5}>
        <Stack direction="row" justifyContent="space-between" alignItems="center">
          <Typography variant="body2" color="text.secondary">
            {title}
          </Typography>
          <Box
            sx={{
              width: 34,
              height: 34,
              borderRadius: '10px',
              display: 'grid',
              placeItems: 'center',
              bgcolor: 'rgba(17, 24, 39, 0.05)',
              color: 'text.secondary',
            }}
          >
            {icon}
          </Box>
        </Stack>
        <Typography variant="h5">{value}</Typography>
      </Stack>
    </Paper>
  );
}

function DetailField({ label, value, icon }: { label: string; value: string; icon: ReactNode }) {
  return (
    <Stack spacing={0.75}>
      <Stack direction="row" spacing={1} alignItems="center">
        <Box sx={{ color: 'text.secondary', display: 'grid', placeItems: 'center' }}>{icon}</Box>
        <Typography variant="body2" color="text.secondary">
          {label}
        </Typography>
      </Stack>
      <Typography variant="subtitle2">{value}</Typography>
    </Stack>
  );
}

function SettingsRow({
  icon,
  title,
  description,
  action,
}: {
  icon: ReactNode;
  title: string;
  description: string;
  action: ReactNode;
}) {
  return (
    <Stack
      direction="row"
      spacing={1.5}
      alignItems="center"
      justifyContent="space-between"
      sx={{ py: 1.5 }}
    >
      <Stack direction="row" spacing={1.5} alignItems="flex-start" sx={{ minWidth: 0 }}>
        <Box
          sx={{
            width: 36,
            height: 36,
            borderRadius: '10px',
            display: 'grid',
            placeItems: 'center',
            bgcolor: 'rgba(17, 24, 39, 0.05)',
            color: 'text.secondary',
            flexShrink: 0,
          }}
        >
          {icon}
        </Box>
        <Box sx={{ minWidth: 0 }}>
          <Typography variant="subtitle2">{title}</Typography>
          <Typography variant="body2" color="text.secondary">
            {description}
          </Typography>
        </Box>
      </Stack>
      <Box sx={{ flexShrink: 0 }}>{action}</Box>
    </Stack>
  );
}

export function ProfilePage() {
  const { user, logout } = useAuth();
  const [progress, setProgress] = useState<UserProgress | null>(null);
  const [error, setError] = useState('');
  const [editOpen, setEditOpen] = useState(false);
  const [securityOpen, setSecurityOpen] = useState(false);
  const [notificationsEnabled, setNotificationsEnabled] = useState(true);
  const [weeklyDigestEnabled, setWeeklyDigestEnabled] = useState(false);
  const [profileState, setProfileState] = useState({
    fullName: '',
    email: '',
    username: '',
    bio: '',
    photoName: '',
  });
  const [editDraft, setEditDraft] = useState({
    fullName: '',
    email: '',
    username: '',
    bio: '',
    photoName: '',
  });

  useEffect(() => {
    api.get<UserProgress>('/users/me/progress')
      .then((response) => {
        setProgress(response.data);
        setProfileState((prev) => ({
          fullName: prev.fullName || response.data.full_name,
          email: prev.email || response.data.email,
          username: prev.username || createUsername(response.data.full_name, response.data.email),
          bio: prev.bio || 'Собираю задачи, встречи и учебные договоренности в одном рабочем профиле.',
          photoName: prev.photoName,
        }));
      })
      .catch((err: unknown) => setError(err instanceof Error ? err.message : 'Не удалось загрузить профиль.'));
  }, []);

  const displayName = profileState.fullName || progress?.full_name || user?.full_name || 'Пользователь';
  const displayEmail = profileState.email || progress?.email || user?.email || 'email@example.com';
  const displayUsername = profileState.username || createUsername(displayName, displayEmail);
  const displayBio = profileState.bio || 'Добавьте пару слов о себе, чтобы профиль выглядел живым и понятным команде.';
  const initials = useMemo(() => getInitials(displayName), [displayName]);

  const accountHighlights = [
    user?.skills?.length ? `${user.skills.length} навыка в профиле` : 'Навыки пока не заполнены',
    `Лимит нагрузки: ${user?.workload_limit ?? 0}`,
    `Надежность: ${Math.round(user?.reliability_score ?? 0)}%`,
  ];

  function openEditDialog() {
    setEditDraft(profileState);
    setEditOpen(true);
  }

  return (
    <Stack spacing={3}>
      <Box sx={{ px: { xs: 0.5, md: 0 } }}>
        <Typography variant="h4">Профиль</Typography>
        <Typography variant="body1" color="text.secondary" sx={{ mt: 0.75, maxWidth: 720 }}>
          Управляйте личными данными, настройками аккаунта и учебной активностью в одном аккуратном рабочем пространстве.
        </Typography>
      </Box>

      {error ? <Alert severity="warning">{error}</Alert> : null}

      {progress ? (
        <>
          <Paper sx={{ p: { xs: 2.25, md: 3 }, borderRadius: '12px' }}>
            <Stack spacing={2.5}>
              <Stack
                direction={{ xs: 'column', md: 'row' }}
                spacing={2}
                alignItems={{ xs: 'flex-start', md: 'center' }}
                justifyContent="space-between"
              >
                <Stack direction="row" spacing={2} alignItems="center">
                  <Avatar
                    sx={{
                      width: 76,
                      height: 76,
                      bgcolor: '#111827',
                      color: '#ffffff',
                      fontSize: '1.5rem',
                      fontWeight: 700,
                    }}
                  >
                    {initials}
                  </Avatar>
                  <Stack spacing={0.75}>
                    <Stack direction="row" spacing={1} alignItems="center" useFlexGap flexWrap="wrap">
                      <Typography variant="h5">{displayName}</Typography>
                      <Chip label="Аккаунт активен" size="small" />
                    </Stack>
                    <Typography variant="body1" color="text.secondary">
                      {displayEmail}
                    </Typography>
                    <Typography variant="body2" color="text.secondary">
                      {roleLabel(user?.role)}
                    </Typography>
                  </Stack>
                </Stack>

                <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1.25} sx={{ width: { xs: '100%', md: 'auto' } }}>
                  <Button variant="contained" startIcon={<EditRoundedIcon />} onClick={openEditDialog}>
                    Редактировать профиль
                  </Button>
                  <Button variant="outlined" startIcon={<LockRoundedIcon />} onClick={() => setSecurityOpen(true)}>
                    Безопасность
                  </Button>
                </Stack>
              </Stack>

              <Divider />

              <Stack direction={{ xs: 'column', md: 'row' }} spacing={1} useFlexGap flexWrap="wrap">
                {accountHighlights.map((item) => (
                  <Chip key={item} label={item} sx={{ bgcolor: '#f9fafb' }} />
                ))}
              </Stack>
            </Stack>
          </Paper>

          <Box
            sx={{
              display: 'grid',
              gap: 2,
              gridTemplateColumns: { xs: '1fr', xl: 'minmax(0, 1.3fr) minmax(320px, 0.9fr)' },
              alignItems: 'start',
            }}
          >
            <Paper sx={{ p: { xs: 2.25, md: 3 }, borderRadius: '12px' }}>
              <Stack spacing={3}>
                <Stack spacing={0.75}>
                  <Typography variant="h6">Личные данные</Typography>
                  <Typography variant="body2" color="text.secondary">
                    Основная информация профиля, которую увидят ваши коллеги и участники учебных сессий.
                  </Typography>
                </Stack>

                <Box
                  sx={{
                    display: 'grid',
                    gap: 2.5,
                    gridTemplateColumns: { xs: '1fr', md: 'repeat(2, minmax(0, 1fr))' },
                  }}
                >
                  <DetailField label="Полное имя" value={displayName} icon={<PersonRoundedIcon fontSize="small" />} />
                  <DetailField label="Email" value={displayEmail} icon={<EmailRoundedIcon fontSize="small" />} />
                  <DetailField label="Username" value={`@${displayUsername}`} icon={<AlternateEmailRoundedIcon fontSize="small" />} />
                  <DetailField label="Роль" value={roleLabel(user?.role)} icon={<ShieldOutlinedIcon fontSize="small" />} />
                </Box>

                <Divider />

                <Stack spacing={1.25}>
                  <Typography variant="subtitle2">О себе</Typography>
                  <Typography variant="body2" color="text.secondary">
                    {displayBio}
                  </Typography>
                </Stack>

                <Stack spacing={1.25}>
                  <Typography variant="subtitle2">Фото профиля</Typography>
                  <Paper
                    variant="outlined"
                    sx={{
                      p: 2,
                      borderRadius: '12px',
                      borderStyle: 'dashed',
                      bgcolor: '#f9fafb',
                    }}
                  >
                    <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1.5} alignItems={{ xs: 'flex-start', sm: 'center' }} justifyContent="space-between">
                      <Stack spacing={0.5}>
                        <Typography variant="body2">
                          {profileState.photoName ? `Выбран файл: ${profileState.photoName}` : 'Изображение профиля пока не добавлено'}
                        </Typography>
                        <Typography variant="caption" color="text.secondary">
                          Здесь оставлен фронтенд-плейсхолдер для будущей загрузки фото без изменения серверной логики.
                        </Typography>
                      </Stack>
                      <Button component="label" variant="outlined" startIcon={<CameraAltOutlinedIcon />}>
                        Выбрать файл
                        <input
                          hidden
                          type="file"
                          accept="image/*"
                          onChange={(event) => {
                            const file = event.target.files?.[0];
                            if (file) {
                              setProfileState((prev) => ({ ...prev, photoName: file.name }));
                            }
                          }}
                        />
                      </Button>
                    </Stack>
                  </Paper>
                </Stack>
              </Stack>
            </Paper>

            <Stack spacing={2}>
              <Paper sx={{ p: { xs: 2.25, md: 3 }, borderRadius: '12px' }}>
                <Stack spacing={0.5}>
                  <Typography variant="h6">Статистика</Typography>
                  <Typography variant="body2" color="text.secondary">
                    Короткий срез активности без перегруженных виджетов.
                  </Typography>
                </Stack>

                <Box
                  sx={{
                    mt: 2,
                    display: 'grid',
                    gap: 1.5,
                    gridTemplateColumns: { xs: '1fr', sm: 'repeat(3, minmax(0, 1fr))', xl: '1fr' },
                  }}
                >
                  <MetricCard title="Сессии" value={progress.sessions_attended} icon={<VideoCameraFrontRoundedIcon fontSize="small" />} />
                  <MetricCard title="Создано задач" value={progress.tasks_created} icon={<InsightsRoundedIcon fontSize="small" />} />
                  <MetricCard title="Завершено задач" value={progress.tasks_completed} icon={<TaskAltRoundedIcon fontSize="small" />} />
                </Box>
              </Paper>

              <Paper sx={{ p: { xs: 2.25, md: 3 }, borderRadius: '12px' }}>
                <Stack spacing={0.5}>
                  <Typography variant="h6">Настройки аккаунта</Typography>
                  <Typography variant="body2" color="text.secondary">
                    Повседневные предпочтения и действия по управлению аккаунтом.
                  </Typography>
                </Stack>

                <Stack divider={<Divider />} sx={{ mt: 1.5 }}>
                  <SettingsRow
                    icon={<EmailRoundedIcon fontSize="small" />}
                    title="Уведомления о сессиях"
                    description="Напоминания о встречах и обновлениях по задачам."
                    action={<Switch checked={notificationsEnabled} onChange={(event) => setNotificationsEnabled(event.target.checked)} />}
                  />
                  <SettingsRow
                    icon={<InsightsRoundedIcon fontSize="small" />}
                    title="Еженедельная сводка"
                    description="Короткое письмо с прогрессом по задачам и посещаемости."
                    action={<Switch checked={weeklyDigestEnabled} onChange={(event) => setWeeklyDigestEnabled(event.target.checked)} />}
                  />
                  <SettingsRow
                    icon={<PaletteOutlinedIcon fontSize="small" />}
                    title="Тема интерфейса"
                    description="Сейчас используется системная тема. Блок оставлен как UI-плейсхолдер."
                    action={<Chip label="Системная" size="small" />}
                  />
                  <SettingsRow
                    icon={<ShieldOutlinedIcon fontSize="small" />}
                    title="Конфиденциальность и вход"
                    description="Проверьте безопасность входа и параметры видимости аккаунта."
                    action={
                      <Button color="inherit" onClick={() => setSecurityOpen(true)} endIcon={<ChevronRightRoundedIcon />}>
                        Открыть
                      </Button>
                    }
                  />
                  <SettingsRow
                    icon={<LogoutRoundedIcon fontSize="small" />}
                    title="Выход из аккаунта"
                    description="Завершить текущую сессию на этом устройстве."
                    action={
                      <Button color="inherit" variant="outlined" onClick={logout}>
                        Выйти
                      </Button>
                    }
                  />
                </Stack>
              </Paper>
            </Stack>
          </Box>
        </>
      ) : null}

      <Dialog open={editOpen} onClose={() => setEditOpen(false)} fullWidth maxWidth="sm">
        <DialogTitle>Редактирование профиля</DialogTitle>
        <DialogContent dividers>
          <Stack spacing={2} sx={{ pt: 1 }}>
            <TextField
              label="Полное имя"
              fullWidth
              value={editDraft.fullName}
              onChange={(event) => setEditDraft((prev) => ({ ...prev, fullName: event.target.value }))}
            />
            <TextField
              label="Email"
              fullWidth
              value={editDraft.email}
              onChange={(event) => setEditDraft((prev) => ({ ...prev, email: event.target.value }))}
            />
            <TextField
              label="Username"
              fullWidth
              value={editDraft.username}
              onChange={(event) => setEditDraft((prev) => ({ ...prev, username: event.target.value.replace(/^@/, '') }))}
            />
            <TextField
              label="О себе"
              fullWidth
              multiline
              minRows={4}
              value={editDraft.bio}
              onChange={(event) => setEditDraft((prev) => ({ ...prev, bio: event.target.value }))}
            />
            <Button component="label" variant="outlined" startIcon={<CameraAltOutlinedIcon />} sx={{ alignSelf: 'flex-start' }}>
              {editDraft.photoName ? 'Заменить фото' : 'Загрузить фото'}
              <input
                hidden
                type="file"
                accept="image/*"
                onChange={(event) => {
                  const file = event.target.files?.[0];
                  if (file) {
                    setEditDraft((prev) => ({ ...prev, photoName: file.name }));
                  }
                }}
              />
            </Button>
            <Typography variant="caption" color="text.secondary">
              Изменения применяются только в интерфейсе страницы, пока на сервере нет отдельного обновления профиля.
            </Typography>
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button
            color="inherit"
            onClick={() => {
              setEditDraft(profileState);
              setEditOpen(false);
            }}
          >
            Отмена
          </Button>
          <Button
            variant="contained"
            onClick={() => {
              setProfileState(editDraft);
              setEditOpen(false);
            }}
          >
            Сохранить
          </Button>
        </DialogActions>
      </Dialog>

      <Dialog open={securityOpen} onClose={() => setSecurityOpen(false)} fullWidth maxWidth="xs">
        <DialogTitle>Безопасность аккаунта</DialogTitle>
        <DialogContent dividers>
          <Stack spacing={2} sx={{ pt: 1 }}>
            <Typography variant="body2" color="text.secondary">
              Здесь подготовлен UI-блок для смены пароля, управления входом и приватностью. Серверная логика намеренно не менялась.
            </Typography>
            <TextField label="Текущий пароль" type="password" fullWidth disabled placeholder="Будет доступно после подключения API" />
            <TextField label="Новый пароль" type="password" fullWidth disabled placeholder="Будет доступно после подключения API" />
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setSecurityOpen(false)}>Закрыть</Button>
        </DialogActions>
      </Dialog>
    </Stack>
  );
}
