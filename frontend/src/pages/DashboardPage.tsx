import CampaignRoundedIcon from '@mui/icons-material/CampaignRounded';
import AddRoundedIcon from '@mui/icons-material/AddRounded';
import SendRoundedIcon from '@mui/icons-material/SendRounded';
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
  FormControl,
  InputLabel,
  MenuItem,
  Paper,
  Select,
  Stack,
  TextField,
  Typography,
} from '@mui/material';
import { alpha, useTheme } from '@mui/material/styles';
import dayjs from 'dayjs';
import relativeTime from 'dayjs/plugin/relativeTime';
import 'dayjs/locale/ru';
import { useCallback, useEffect, useState } from 'react';

import { api } from '../api/client';
import { useAuth } from '../context/AuthContext';
import type { AnnouncementFeedItem, Group } from '../types';

dayjs.extend(relativeTime);
dayjs.locale('ru');

function authorInitials(name: string) {
  return name.trim().split(/\s+/).slice(0, 2).map((part) => part[0]?.toUpperCase() ?? '').join('') || '?';
}

export function DashboardPage() {
  const theme = useTheme();
  const { user } = useAuth();
  const [groups, setGroups] = useState<Group[]>([]);
  const [announcements, setAnnouncements] = useState<AnnouncementFeedItem[]>([]);
  const [loadError, setLoadError] = useState('');
  const [createOpen, setCreateOpen] = useState(false);
  const [postGroupId, setPostGroupId] = useState<number | ''>('');
  const [postBody, setPostBody] = useState('');
  const [posting, setPosting] = useState(false);
  const [postError, setPostError] = useState('');

  const loadDashboard = useCallback(async () => {
    setLoadError('');
    try {
      const [groupsResponse, feedResponse] = await Promise.all([
        api.get<Group[]>('/groups'),
        api.get<AnnouncementFeedItem[]>('/dashboard/announcements'),
      ]);
      const loadedGroups = groupsResponse.data;
      setGroups(loadedGroups);
      setAnnouncements(feedResponse.data);
      const ids = loadedGroups.map((group) => group.id);
      setPostGroupId((prev) => {
        if (ids.length === 0) return '';
        if (typeof prev === 'number' && ids.includes(prev)) return prev;
        return ids[0];
      });
    } catch (err: unknown) {
      setLoadError(err instanceof Error ? err.message : 'Не удалось загрузить данные.');
      setGroups([]);
      setAnnouncements([]);
    }
  }, []);

  useEffect(() => {
    void loadDashboard();
  }, [loadDashboard]);

  async function submitAnnouncement() {
    if (postGroupId === '') {
      setPostError('Выберите группу.');
      return;
    }
    setPostError('');
    setPosting(true);
    try {
      const { data } = await api.post<AnnouncementFeedItem>('/dashboard/announcements', {
        group_id: postGroupId,
        body: postBody,
      });
      setAnnouncements((prev) => [{
        ...data,
        author_avatar_url: data.author_avatar_url || user?.avatar_url || '',
      }, ...prev.filter((item) => item.id !== data.id)]);
      setPostBody('');
      setCreateOpen(false);
    } catch (err: unknown) {
      setPostError(err instanceof Error ? err.message : 'Не удалось опубликовать.');
    } finally {
      setPosting(false);
    }
  }

  return (
    <Stack spacing={2}>
      <Stack direction="row" alignItems="center" justifyContent="space-between" spacing={1} flexWrap="wrap">
        <Typography variant="h4">Главная</Typography>
        <Button
          variant="contained"
          startIcon={<AddRoundedIcon />}
          onClick={() => setCreateOpen(true)}
          disabled={!groups.length}
        >
          Создать объявление
        </Button>
      </Stack>

      {loadError ? <Alert severity="error">{loadError}</Alert> : null}

      <Paper sx={{ p: { xs: 2, md: 2.5 }, borderRadius: 2.5 }}>
        <Stack spacing={1.5}>
          <Stack direction="row" spacing={1} alignItems="center">
            <CampaignRoundedIcon fontSize="small" color="action" />
            <Typography variant="subtitle1" sx={{ fontWeight: 700 }}>Объявления команд</Typography>
          </Stack>

          {announcements.length === 0 ? (
            <Alert severity="info" sx={{ borderRadius: 2 }}>
              Пока нет объявлений. Создайте первое, чтобы команда увидела обновление.
            </Alert>
          ) : (
            <Stack spacing={1.25}>
              {announcements.map((item) => (
                <Paper
                  key={item.id}
                  sx={{
                    p: 2,
                    borderRadius: 2.5,
                    border: '1px solid',
                    borderColor: 'divider',
                    background: `linear-gradient(135deg, ${alpha(theme.palette.primary.main, theme.palette.mode === 'dark' ? 0.08 : 0.03)} 0%, transparent 100%)`,
                  }}
                >
                  <Stack direction="row" spacing={1.5} alignItems="flex-start">
                    <Avatar src={item.author_avatar_url || undefined} sx={{ width: 40, height: 40, bgcolor: 'text.primary', color: 'background.paper', fontSize: '0.85rem', fontWeight: 700 }}>
                      {authorInitials(item.author_name)}
                    </Avatar>
                    <Box sx={{ flex: 1, minWidth: 0 }}>
                      <Stack direction="row" justifyContent="space-between" alignItems="flex-start" spacing={1}>
                        <Box>
                          <Typography variant="subtitle2" sx={{ fontWeight: 700 }}>{item.author_name}</Typography>
                          <Stack direction="row" spacing={1} alignItems="center" sx={{ mt: 0.25 }}>
                            <Chip size="small" label={item.group_name} sx={{ height: 22 }} />
                            <Typography variant="caption" color="text.secondary">
                              {dayjs(item.created_at).fromNow()}
                            </Typography>
                          </Stack>
                        </Box>
                      </Stack>
                      <Typography variant="body2" sx={{ mt: 1.25, whiteSpace: 'pre-wrap', lineHeight: 1.6 }}>
                        {item.body}
                      </Typography>
                    </Box>
                  </Stack>
                </Paper>
              ))}
            </Stack>
          )}
        </Stack>
      </Paper>

      <Dialog open={createOpen} onClose={() => !posting && setCreateOpen(false)} fullWidth maxWidth="sm">
        <DialogTitle>Новое объявление</DialogTitle>
        <DialogContent>
          <Stack spacing={2} sx={{ pt: 1 }}>
            {groups.length === 0 ? (
              <Alert severity="info">Вступите в группу, чтобы публиковать объявления.</Alert>
            ) : (
              <>
                <FormControl fullWidth size="small">
                  <InputLabel id="announcement-group-label">Группа</InputLabel>
                  <Select
                    labelId="announcement-group-label"
                    label="Группа"
                    value={postGroupId === '' ? '' : String(postGroupId)}
                    onChange={(event) => setPostGroupId(Number(event.target.value))}
                  >
                    {groups.map((group) => (
                      <MenuItem key={group.id} value={group.id}>{group.name}</MenuItem>
                    ))}
                  </Select>
                </FormControl>
                <TextField
                  label="Текст объявления"
                  placeholder="Короткое сообщение для участников группы"
                  multiline
                  minRows={4}
                  fullWidth
                  value={postBody}
                  onChange={(event) => setPostBody(event.target.value)}
                />
              </>
            )}
            {postError ? <Alert severity="warning">{postError}</Alert> : null}
          </Stack>
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2 }}>
          <Button onClick={() => setCreateOpen(false)} disabled={posting}>Отмена</Button>
          <Button
            variant="contained"
            startIcon={<SendRoundedIcon />}
            disabled={posting || !postBody.trim() || postGroupId === ''}
            onClick={() => void submitAnnouncement()}
          >
            Опубликовать
          </Button>
        </DialogActions>
      </Dialog>
    </Stack>
  );
}
