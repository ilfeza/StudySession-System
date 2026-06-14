import AlternateEmailRoundedIcon from '@mui/icons-material/AlternateEmailRounded';
import CameraAltOutlinedIcon from '@mui/icons-material/CameraAltOutlined';
import DarkModeRoundedIcon from '@mui/icons-material/DarkModeRounded';
import EditRoundedIcon from '@mui/icons-material/EditRounded';
import EmailRoundedIcon from '@mui/icons-material/EmailRounded';
import LightModeRoundedIcon from '@mui/icons-material/LightModeRounded';
import LogoutRoundedIcon from '@mui/icons-material/LogoutRounded';
import PersonRoundedIcon from '@mui/icons-material/PersonRounded';
import SettingsRoundedIcon from '@mui/icons-material/SettingsRounded';
import ShieldOutlinedIcon from '@mui/icons-material/ShieldOutlined';
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
  ListItemButton,
  ListItemText,
  Paper,
  Stack,
  TextField,
  ToggleButton,
  ToggleButtonGroup,
  Typography,
} from '@mui/material';
import type { PaletteMode } from '@mui/material';
import type { ReactNode } from 'react';
import { useEffect, useMemo, useState } from 'react';
import { Navigate, Route, Routes, useLocation, useNavigate } from 'react-router-dom';

import { SkillsTagInput } from '../components/SkillsTagInput';
import { useAuth } from '../context/AuthContext';
import { useThemeMode } from '../context/ThemeModeContext';
import { roleLabel } from '../utils/roleLabels';

function getInitials(fullName: string) {
  const parts = fullName.trim().split(/\s+/).filter(Boolean);
  return parts.slice(0, 2).map((part) => part[0]?.toUpperCase() ?? '').join('') || 'U';
}

function createUsername(fullName: string, email: string) {
  const localPart = email.split('@')[0]?.trim();
  if (localPart) return localPart.toLowerCase();
  return fullName.trim().toLowerCase().replace(/\s+/g, '.');
}

function DetailField({ label, value, icon }: { label: string; value: string; icon: ReactNode }) {
  return (
    <Stack spacing={0.75}>
      <Stack direction="row" spacing={1} alignItems="center">
        <Box sx={{ color: 'text.secondary', display: 'grid', placeItems: 'center' }}>{icon}</Box>
        <Typography variant="body2" color="text.secondary">{label}</Typography>
      </Stack>
      <Typography variant="subtitle2">{value}</Typography>
    </Stack>
  );
}

function ProfileSidebar() {
  const navigate = useNavigate();
  const location = useLocation();

  const items = [
    { to: '/profile', label: 'Мой профиль', icon: <PersonRoundedIcon fontSize="small" /> },
    { to: '/profile/settings', label: 'Настройки аккаунта', icon: <SettingsRoundedIcon fontSize="small" /> },
  ];

  return (
    <Paper sx={{ p: 1, borderRadius: 2.5 }}>
      <Stack spacing={0.5}>
        {items.map((item) => {
          const active = location.pathname === item.to;
          return (
            <ListItemButton key={item.to} selected={active} onClick={() => navigate(item.to)} sx={{ borderRadius: 1.5 }}>
              <ListItemText primary={item.label} />
              {item.icon}
            </ListItemButton>
          );
        })}
      </Stack>
    </Paper>
  );
}

function ProfileOverview({
  error,
  displayName,
  displayEmail,
  displayUsername,
  displayBio,
  avatarSrc,
  initials,
  currentSkills,
  onEdit,
}: {
  error: string;
  displayName: string;
  displayEmail: string;
  displayUsername: string;
  displayBio: string;
  avatarSrc?: string;
  initials: string;
  currentSkills: string[];
  onEdit: () => void;
}) {
  const { user } = useAuth();

  return (
    <Stack spacing={2}>
      {error ? <Alert severity="warning">{error}</Alert> : null}

      <Paper sx={{ p: { xs: 2, md: 2.5 }, borderRadius: 2.5 }}>
        <Stack direction={{ xs: 'column', md: 'row' }} spacing={2} alignItems={{ xs: 'flex-start', md: 'center' }} justifyContent="space-between">
          <Stack direction="row" spacing={2} alignItems="center">
            <Avatar src={avatarSrc} sx={{ width: 72, height: 72, bgcolor: 'text.primary', color: 'background.paper', fontWeight: 700 }}>
              {initials}
            </Avatar>
            <Stack spacing={0.5}>
              <Typography variant="h6">{displayName}</Typography>
              <Typography variant="body2" color="text.secondary">{displayEmail}</Typography>
              <Typography variant="body2" color="text.secondary">{roleLabel(user?.role)}</Typography>
            </Stack>
          </Stack>
          <Button variant="contained" startIcon={<EditRoundedIcon />} onClick={onEdit}>
            Редактировать профиль
          </Button>
        </Stack>
      </Paper>

      <Paper sx={{ p: { xs: 2, md: 2.5 }, borderRadius: 2.5 }}>
        <Stack spacing={2.5}>
          <Typography variant="subtitle1">Личные данные</Typography>
          <Box sx={{ display: 'grid', gap: 2, gridTemplateColumns: { xs: '1fr', md: 'repeat(2, minmax(0, 1fr))' } }}>
            <DetailField label="Полное имя" value={displayName} icon={<PersonRoundedIcon fontSize="small" />} />
            <DetailField label="Email" value={displayEmail} icon={<EmailRoundedIcon fontSize="small" />} />
            <DetailField label="Username" value={`@${displayUsername}`} icon={<AlternateEmailRoundedIcon fontSize="small" />} />
            <DetailField label="Роль" value={roleLabel(user?.role)} icon={<ShieldOutlinedIcon fontSize="small" />} />
          </Box>
          <Divider />
          <Stack spacing={1}>
            <Typography variant="subtitle2">О себе</Typography>
            <Typography variant="body2" color="text.secondary">{displayBio}</Typography>
          </Stack>
          <Divider />
          <Stack spacing={1}>
            <Typography variant="subtitle2">Навыки</Typography>
            <Stack direction="row" spacing={1} useFlexGap flexWrap="wrap">
              {currentSkills.length
                ? currentSkills.map((skill) => <Chip key={skill} label={skill} size="small" />)
                : <Typography variant="body2" color="text.secondary">Навыки пока не заполнены.</Typography>}
            </Stack>
          </Stack>
        </Stack>
      </Paper>
    </Stack>
  );
}

function ProfileSettings() {
  const { logout } = useAuth();
  const { mode, setMode } = useThemeMode();

  function handleThemeChange(_: React.MouseEvent<HTMLElement>, nextMode: PaletteMode | null) {
    if (nextMode) setMode(nextMode);
  }

  return (
    <Stack spacing={2}>
      <Paper sx={{ p: { xs: 2, md: 2.5 }, borderRadius: 2.5 }}>
        <Stack spacing={2}>
          <Typography variant="subtitle1">Настройки аккаунта</Typography>

          <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1.5} alignItems={{ sm: 'center' }} justifyContent="space-between">
            <Box>
              <Typography variant="subtitle2">Цветовой режим</Typography>
              <Typography variant="body2" color="text.secondary">Светлая или тёмная тема интерфейса.</Typography>
            </Box>
            <ToggleButtonGroup exclusive value={mode} onChange={handleThemeChange}>
              <ToggleButton value="light"><LightModeRoundedIcon fontSize="small" sx={{ mr: 0.75 }} />Светлый</ToggleButton>
              <ToggleButton value="dark"><DarkModeRoundedIcon fontSize="small" sx={{ mr: 0.75 }} />Тёмный</ToggleButton>
            </ToggleButtonGroup>
          </Stack>

          <Divider />

          <Stack spacing={1.5}>
            <Typography variant="subtitle2">Безопасность</Typography>
            <Typography variant="body2" color="text.secondary">
              Смена пароля будет доступна после подключения серверного API.
            </Typography>
            <TextField label="Текущий пароль" type="password" fullWidth disabled placeholder="Скоро" />
            <TextField label="Новый пароль" type="password" fullWidth disabled placeholder="Скоро" />
          </Stack>

          <Divider />

          <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1} alignItems={{ sm: 'center' }} justifyContent="space-between">
            <Box>
              <Typography variant="subtitle2">Выход из аккаунта</Typography>
              <Typography variant="body2" color="text.secondary">Завершить текущую сессию на этом устройстве.</Typography>
            </Box>
            <Button variant="outlined" color="error" startIcon={<LogoutRoundedIcon />} onClick={logout}>
              Выйти
            </Button>
          </Stack>
        </Stack>
      </Paper>
    </Stack>
  );
}

export function ProfilePage() {
  const { user, updateProfile, uploadAvatar } = useAuth();
  const [error, setError] = useState('');
  const [editOpen, setEditOpen] = useState(false);
  const [savingProfile, setSavingProfile] = useState(false);
  const [profileState, setProfileState] = useState({ fullName: '', email: '', username: '', bio: '' });
  const [avatarPreview, setAvatarPreview] = useState<string | null>(null);
  const [pendingAvatarFile, setPendingAvatarFile] = useState<File | null>(null);
  const [editDraft, setEditDraft] = useState({ fullName: '', email: '', username: '', bio: '', skills: [] as string[] });

  useEffect(() => {
    if (!user) return;
    setProfileState({
      fullName: user.full_name,
      email: user.email,
      username: createUsername(user.full_name, user.email),
      bio: 'Собираю задачи, встречи и учебные договорённости в одном рабочем профиле.',
    });
  }, [user]);

  const displayName = profileState.fullName || user?.full_name || 'Пользователь';
  const displayEmail = profileState.email || user?.email || 'email@example.com';
  const displayUsername = profileState.username || createUsername(displayName, displayEmail);
  const displayBio = profileState.bio || 'Добавьте пару слов о себе, чтобы профиль выглядел понятным команде.';
  const initials = useMemo(() => getInitials(displayName), [displayName]);
  const currentSkills = user?.skills ?? [];
  const avatarSrc = avatarPreview || user?.avatar_url || undefined;

  useEffect(() => {
    if (user?.avatar_url && !avatarPreview) {
      setProfileState((prev) => ({ ...prev, fullName: user.full_name, email: user.email }));
    }
  }, [user?.avatar_url, user?.email, user?.full_name, avatarPreview]);

  function openEditDialog() {
    setEditDraft({
      fullName: displayName,
      email: displayEmail,
      username: displayUsername,
      bio: displayBio,
      skills: currentSkills,
    });
    setPendingAvatarFile(null);
    setAvatarPreview(null);
    setEditOpen(true);
  }

  function handleAvatarSelect(file: File | undefined) {
    if (!file) return;
    setPendingAvatarFile(file);
    setAvatarPreview(URL.createObjectURL(file));
  }

  if (!user) {
    return null;
  }

  return (
    <Stack spacing={2.5}>
      <Typography variant="h4">Профиль</Typography>

      <Box sx={{ display: 'grid', gap: 2, gridTemplateColumns: { xs: '1fr', lg: '220px minmax(0, 1fr)' }, alignItems: 'start' }}>
        <ProfileSidebar />

        <Box>
          <Routes>
            <Route
              index
              element={(
                <ProfileOverview
                  error={error}
                  displayName={displayName}
                  displayEmail={displayEmail}
                  displayUsername={displayUsername}
                  displayBio={displayBio}
                  avatarSrc={avatarSrc}
                  initials={initials}
                  currentSkills={currentSkills}
                  onEdit={openEditDialog}
                />
              )}
            />
            <Route path="settings" element={<ProfileSettings />} />
            <Route path="*" element={<Navigate to="/profile" replace />} />
          </Routes>
        </Box>
      </Box>

      <Dialog open={editOpen} onClose={() => !savingProfile && setEditOpen(false)} fullWidth maxWidth="sm">
        <DialogTitle>Редактирование профиля</DialogTitle>
        <DialogContent dividers>
          <Stack spacing={2} sx={{ pt: 1 }}>
            <Stack direction="row" spacing={2} alignItems="center">
              <Avatar src={avatarPreview || user.avatar_url} sx={{ width: 64, height: 64, bgcolor: 'text.primary', color: 'background.paper' }}>
                {initials}
              </Avatar>
              <Button component="label" variant="outlined" startIcon={<CameraAltOutlinedIcon />}>
                {pendingAvatarFile || user.avatar_url ? 'Заменить фото' : 'Загрузить фото'}
                <input hidden type="file" accept="image/*" onChange={(event) => handleAvatarSelect(event.target.files?.[0])} />
              </Button>
            </Stack>
            <TextField label="Полное имя" fullWidth value={editDraft.fullName} onChange={(event) => setEditDraft((prev) => ({ ...prev, fullName: event.target.value }))} />
            <TextField label="Email" fullWidth value={editDraft.email} onChange={(event) => setEditDraft((prev) => ({ ...prev, email: event.target.value }))} />
            <TextField label="Username" fullWidth value={editDraft.username} onChange={(event) => setEditDraft((prev) => ({ ...prev, username: event.target.value.replace(/^@/, '') }))} />
            <TextField label="О себе" fullWidth multiline minRows={4} value={editDraft.bio} onChange={(event) => setEditDraft((prev) => ({ ...prev, bio: event.target.value }))} />
            <SkillsTagInput
              value={editDraft.skills}
              onChange={(skills) => setEditDraft((prev) => ({ ...prev, skills }))}
              label="Навыки"
              disabled={savingProfile}
            />
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button color="inherit" onClick={() => setEditOpen(false)} disabled={savingProfile}>Отмена</Button>
          <Button
            variant="contained"
            disabled={savingProfile}
            onClick={() => {
              setSavingProfile(true);
              const savePromise = pendingAvatarFile
                ? uploadAvatar(pendingAvatarFile).then(() => updateProfile({
                  full_name: editDraft.fullName,
                  email: editDraft.email,
                  skills: editDraft.skills,
                }))
                : updateProfile({
                  full_name: editDraft.fullName,
                  email: editDraft.email,
                  skills: editDraft.skills,
                });

              savePromise
                .then(() => {
                  setProfileState({
                    fullName: editDraft.fullName,
                    email: editDraft.email,
                    username: editDraft.username,
                    bio: editDraft.bio,
                  });
                  setPendingAvatarFile(null);
                  setAvatarPreview(null);
                  setEditOpen(false);
                })
                .catch((err: Error) => setError(err.message || 'Не удалось сохранить профиль.'))
                .finally(() => setSavingProfile(false));
            }}
          >
            Сохранить
          </Button>
        </DialogActions>
      </Dialog>
    </Stack>
  );
}
