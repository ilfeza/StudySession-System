import AddCircleRoundedIcon from '@mui/icons-material/AddCircleRounded';
import ExitToAppRoundedIcon from '@mui/icons-material/ExitToAppRounded';
import ForumRoundedIcon from '@mui/icons-material/ForumRounded';
import GroupAddRoundedIcon from '@mui/icons-material/GroupAddRounded';
import GroupsRoundedIcon from '@mui/icons-material/GroupsRounded';
import HistoryRoundedIcon from '@mui/icons-material/HistoryRounded';
import KeyRoundedIcon from '@mui/icons-material/KeyRounded';
import LibraryBooksRoundedIcon from '@mui/icons-material/LibraryBooksRounded';
import ManageAccountsRoundedIcon from '@mui/icons-material/ManageAccountsRounded';
import RocketLaunchRoundedIcon from '@mui/icons-material/RocketLaunchRounded';
import SearchRoundedIcon from '@mui/icons-material/SearchRounded';
import {
  Alert,
  Box,
  Button,
  Chip,
  Dialog,
  DialogContent,
  DialogTitle,
  Divider,
  List,
  ListItemButton,
  ListItemText,
  MenuItem,
  Paper,
  Stack,
  TextField,
  Typography,
} from '@mui/material';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link as RouterLink } from 'react-router-dom';

import { api } from '../api/client';
import { MaterialsPanel } from '../components/materials/MaterialsPanel';
import type {
  Conversation,
  ConversationMessage,
  Friendship,
  Group,
  GroupVisibility,
  SessionSummaryHistoryItem,
  UserDirectory,
  VideoSession,
} from '../types';

const sessionTemplates = [
  { key: 'exam_prep', name: 'Подготовка к экзамену', description: 'Вопросы, повторение и фиксация прогресса.' },
  { key: 'team_project', name: 'Командный проект', description: 'Роли, задачи и контроль статусов.' },
  { key: 'topic_review', name: 'Разбор темы', description: 'Теория, материалы и выводы по теме.' },
];

const leftTabs = [
  { key: 'search', label: 'Поиск', icon: <SearchRoundedIcon fontSize="small" /> },
  { key: 'my', label: 'Мои группы', icon: <GroupsRoundedIcon fontSize="small" /> },
  { key: 'materials', label: 'Материалы', icon: <LibraryBooksRoundedIcon fontSize="small" /> },
  { key: 'friends', label: 'Друзья', icon: <GroupAddRoundedIcon fontSize="small" /> },
  { key: 'messages', label: 'Сообщения', icon: <ForumRoundedIcon fontSize="small" /> },
  { key: 'settings', label: 'Управление', icon: <ManageAccountsRoundedIcon fontSize="small" /> },
] as const;

type LeftTab = typeof leftTabs[number]['key'];

function formatDate(value: string) {
  return new Date(value).toLocaleString('ru-RU');
}

export function GroupsPage() {
  const [activeTab, setActiveTab] = useState<LeftTab>('my');
  const [groups, setGroups] = useState<Group[]>([]);
  const [catalog, setCatalog] = useState<Group[]>([]);
  const [selectedGroupId, setSelectedGroupId] = useState<number | null>(null);
  const [sessions, setSessions] = useState<VideoSession[]>([]);
  const [history, setHistory] = useState<SessionSummaryHistoryItem[]>([]);
  const [friends, setFriends] = useState<Friendship[]>([]);
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [conversationMessages, setConversationMessages] = useState<ConversationMessage[]>([]);
  const [selectedConversationId, setSelectedConversationId] = useState<number | null>(null);
  const [userDirectory, setUserDirectory] = useState<UserDirectory[]>([]);
  const [error, setError] = useState('');
  const [groupDialogOpen, setGroupDialogOpen] = useState(false);
  const [sessionDialogOpen, setSessionDialogOpen] = useState(false);
  const [groupName, setGroupName] = useState('');
  const [groupDescription, setGroupDescription] = useState('');
  const [groupVisibility, setGroupVisibility] = useState<GroupVisibility>('public');
  const [privateJoinKey, setPrivateJoinKey] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [sessionTitle, setSessionTitle] = useState('');
  const [sessionDescription, setSessionDescription] = useState('');
  const [sessionStartsAt, setSessionStartsAt] = useState('');
  const [templateKey, setTemplateKey] = useState(sessionTemplates[0].key);
  const [messageDraft, setMessageDraft] = useState('');

  const selectedGroup = useMemo(
    () => groups.find((group) => group.id === selectedGroupId) ?? catalog.find((group) => group.id === selectedGroupId) ?? null,
    [catalog, groups, selectedGroupId],
  );
  const selectedConversation = useMemo(
    () => conversations.find((item) => item.id === selectedConversationId) ?? null,
    [conversations, selectedConversationId],
  );

  const loadGroups = useCallback(async () => {
    const [groupsResponse, catalogResponse] = await Promise.all([
      api.get<Group[]>('/groups'),
      api.get<Group[]>('/groups/catalog'),
    ]);
    setGroups(groupsResponse.data);
    setCatalog(catalogResponse.data);
    setSelectedGroupId((prev) => prev ?? groupsResponse.data[0]?.id ?? catalogResponse.data[0]?.id ?? null);
  }, []);

  const loadGroupData = useCallback(async (groupId: number) => {
    const [sessionsResponse, historyResponse] = await Promise.all([
      api.get<VideoSession[]>(`/sessions/group/${groupId}`),
      api.get<SessionSummaryHistoryItem[]>(`/groups/${groupId}/history`),
    ]);
    setSessions(sessionsResponse.data);
    setHistory(historyResponse.data);
  }, []);

  const loadSocial = useCallback(async () => {
    const [friendsResponse, conversationsResponse] = await Promise.all([
      api.get<Friendship[]>('/social/friends'),
      api.get<Conversation[]>('/social/conversations'),
    ]);
    setFriends(friendsResponse.data);
    setConversations(conversationsResponse.data);
    setSelectedConversationId((prev) => prev ?? conversationsResponse.data[0]?.id ?? null);
  }, []);

  const loadDirectory = useCallback(async (query = '') => {
    const response = await api.get<UserDirectory[]>('/social/users', { params: { query } });
    setUserDirectory(response.data);
  }, []);

  useEffect(() => {
    Promise.all([loadGroups(), loadSocial(), loadDirectory()])
      .catch((err: Error) => setError(err.message || 'Не удалось загрузить страницу групп.'));
  }, [loadDirectory, loadGroups, loadSocial]);

  useEffect(() => {
    if (selectedGroupId && groups.some((group) => group.id === selectedGroupId)) {
      void loadGroupData(selectedGroupId).catch((err: Error) => setError(err.message || 'Не удалось загрузить данные группы.'));
    }
  }, [groups, loadGroupData, selectedGroupId]);

  useEffect(() => {
    if (!selectedConversationId) {
      setConversationMessages([]);
      return;
    }
    api.get<ConversationMessage[]>(`/social/conversations/${selectedConversationId}/messages`)
      .then((response) => setConversationMessages(response.data))
      .catch((err: Error) => setError(err.message || 'Не удалось загрузить сообщения.'));
  }, [selectedConversationId]);

  useEffect(() => {
    const template = sessionTemplates.find((item) => item.key === templateKey);
    if (!template) {
      return;
    }
    if (!sessionTitle.trim()) {
      setSessionTitle(template.name);
    }
    if (!sessionDescription.trim()) {
      setSessionDescription(template.description);
    }
  }, [templateKey, sessionDescription, sessionTitle]);

  async function handleCreateGroup() {
    if (!groupName.trim()) {
      return;
    }
    try {
      await api.post('/groups', {
        name: groupName.trim(),
        description: groupDescription.trim(),
        visibility: groupVisibility,
      });
      setGroupDialogOpen(false);
      setGroupName('');
      setGroupDescription('');
      setGroupVisibility('public');
      await loadGroups();
      setActiveTab('my');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Не удалось создать группу.');
    }
  }

  async function handleUpdateGroup() {
    if (!selectedGroup) {
      return;
    }
    try {
      await api.patch(`/groups/${selectedGroup.id}`, {
        name: selectedGroup.name,
        description: selectedGroup.description,
        visibility: selectedGroup.visibility,
      });
      await loadGroups();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Не удалось обновить группу.');
    }
  }

  async function handleJoinGroup(groupId: number) {
    try {
      await api.post(`/groups/${groupId}/join`);
      await loadGroups();
      setActiveTab('my');
      setSelectedGroupId(groupId);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Не удалось вступить в группу.');
    }
  }

  async function handleJoinByKey() {
    if (!privateJoinKey.trim()) {
      return;
    }
    try {
      await api.post('/groups/join-by-key', { invite_key: privateJoinKey.trim() });
      setPrivateJoinKey('');
      await loadGroups();
      setActiveTab('my');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Не удалось вступить в приватную группу.');
    }
  }

  async function handleLeaveGroup() {
    if (!selectedGroup) {
      return;
    }
    try {
      await api.post(`/groups/${selectedGroup.id}/leave`);
      await loadGroups();
      setSelectedGroupId(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Не удалось выйти из группы.');
    }
  }

  async function handleDeleteGroup() {
    if (!selectedGroup) {
      return;
    }
    try {
      await api.delete(`/groups/${selectedGroup.id}`);
      await loadGroups();
      setSelectedGroupId(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Не удалось удалить группу.');
    }
  }

  async function handleCreateSession() {
    if (!selectedGroupId || !sessionTitle.trim() || !sessionStartsAt) {
      return;
    }
    try {
      await api.post('/sessions', {
        group_id: selectedGroupId,
        title: sessionTitle.trim(),
        description: sessionDescription.trim(),
        template_key: templateKey,
        starts_at: new Date(sessionStartsAt).toISOString(),
      });
      setSessionDialogOpen(false);
      setSessionTitle('');
      setSessionDescription('');
      setSessionStartsAt('');
      setTemplateKey(sessionTemplates[0].key);
      await loadGroupData(selectedGroupId);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Не удалось создать сессию.');
    }
  }

  async function handleUserSearch(query: string) {
    setSearchQuery(query);
    try {
      await loadDirectory(query);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Не удалось найти пользователей.');
    }
  }

  async function handleSendFriendRequest(userId: number) {
    try {
      await api.post('/social/friends', { user_id: userId });
      await loadSocial();
      setActiveTab('friends');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Не удалось отправить запрос в друзья.');
    }
  }

  async function handleFriendAction(friendshipId: number, action: 'accept' | 'decline' | 'block') {
    try {
      await api.patch(`/social/friends/${friendshipId}`, { action });
      await loadSocial();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Не удалось обновить статус дружбы.');
    }
  }

  async function handleOpenDirectConversation(userId: number) {
    try {
      const response = await api.post<Conversation>(`/social/conversations/direct/${userId}`);
      await loadSocial();
      setSelectedConversationId(response.data.id);
      setActiveTab('messages');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Не удалось открыть диалог.');
    }
  }

  async function handleOpenGroupConversation(groupId: number) {
    try {
      const response = await api.post<Conversation>(`/social/conversations/group/${groupId}`);
      await loadSocial();
      setSelectedConversationId(response.data.id);
      setActiveTab('messages');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Не удалось открыть чат группы.');
    }
  }

  async function handleSendMessage() {
    if (!selectedConversationId || !messageDraft.trim()) {
      return;
    }
    try {
      const response = await api.post<ConversationMessage>(`/social/conversations/${selectedConversationId}/messages`, {
        body: messageDraft.trim(),
      });
      setConversationMessages((prev) => [...prev, response.data]);
      setMessageDraft('');
      await loadSocial();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Не удалось отправить сообщение.');
    }
  }

  function updateSelectedGroupPatch(patch: Partial<Group>) {
    if (!selectedGroup) {
      return;
    }
    setGroups((prev) => prev.map((item) => (item.id === selectedGroup.id ? { ...item, ...patch } : item)));
    setCatalog((prev) => prev.map((item) => (item.id === selectedGroup.id ? { ...item, ...patch } : item)));
  }

  const joinedGroupIds = new Set(groups.map((group) => group.id));
  const acceptedFriends = friends.filter((item) => item.status === 'accepted');

  return (
    <Stack spacing={3}>
      <Stack direction={{ xs: 'column', lg: 'row' }} justifyContent="space-between" spacing={2}>
        <Box>
          <Typography variant="h4">Группы и сообщества</Typography>
          <Typography variant="body2" color="text.secondary" sx={{ mt: 0.75, maxWidth: 760 }}>
            Здесь собраны публичные и приватные группы, их история, материалы, обычные чаты и круг друзей вне видеосессий.
          </Typography>
        </Box>
        <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1}>
          <Button variant="outlined" startIcon={<AddCircleRoundedIcon />} onClick={() => setGroupDialogOpen(true)}>
            Новая группа
          </Button>
          <Button variant="contained" startIcon={<RocketLaunchRoundedIcon />} onClick={() => setSessionDialogOpen(true)} disabled={!selectedGroupId || !joinedGroupIds.has(selectedGroupId)}>
            Новая сессия
          </Button>
        </Stack>
      </Stack>

      {error ? <Alert severity="warning">{error}</Alert> : null}

      <Box
        sx={{
          display: 'grid',
          gap: 2,
          gridTemplateColumns: { xs: '1fr', lg: '240px minmax(0, 1fr)' },
          alignItems: 'start',
        }}
      >
        <Paper sx={{ p: 1.25, borderRadius: 2 }}>
          <Stack spacing={0.5}>
            {leftTabs.map((tab) => (
              <ListItemButton
                key={tab.key}
                selected={activeTab === tab.key}
                onClick={() => setActiveTab(tab.key)}
                sx={{ borderRadius: 1.5 }}
              >
                <ListItemText primary={tab.label} secondary={tab.key === 'messages' ? `${conversations.length} чатов` : undefined} />
                {tab.icon}
              </ListItemButton>
            ))}
          </Stack>
        </Paper>

        <Paper sx={{ p: { xs: 2, md: 2.5 }, borderRadius: 2 }}>
          {activeTab === 'search' ? (
            <Stack spacing={2}>
              <Stack spacing={1}>
                <Typography variant="h5">Поиск групп и людей</Typography>
                <Typography variant="body2" color="text.secondary">
                  Можно искать открытые группы, вступать по приватному ключу, добавлять людей в друзья и сразу открывать личный чат.
                </Typography>
              </Stack>

              <Stack direction={{ xs: 'column', md: 'row' }} spacing={1.5}>
                <TextField
                  fullWidth
                  label="Поиск по группам и пользователям"
                  value={searchQuery}
                  onChange={(event) => void handleUserSearch(event.target.value)}
                />
                <TextField
                  label="Приватный ключ"
                  value={privateJoinKey}
                  onChange={(event) => setPrivateJoinKey(event.target.value)}
                  sx={{ minWidth: { md: 220 } }}
                />
                <Button variant="contained" startIcon={<KeyRoundedIcon />} onClick={() => void handleJoinByKey()}>
                  Вступить
                </Button>
              </Stack>

              <Typography variant="subtitle2">Открытые группы</Typography>
              <Stack spacing={1.25}>
                {catalog
                  .filter((group) => !searchQuery.trim() || group.name.toLowerCase().includes(searchQuery.toLowerCase()))
                  .map((group) => (
                    <Paper key={group.id} sx={{ p: 1.75, borderRadius: 1.5 }}>
                      <Stack direction={{ xs: 'column', md: 'row' }} spacing={1.5} justifyContent="space-between">
                        <Box sx={{ minWidth: 0 }}>
                          <Stack direction="row" spacing={1} alignItems="center" useFlexGap flexWrap="wrap">
                            <Typography variant="subtitle1">{group.name}</Typography>
                            <Chip size="small" label={group.visibility === 'private' ? 'Приватная' : 'Открытая'} />
                          </Stack>
                          <Typography variant="body2" color="text.secondary" sx={{ mt: 0.75 }}>
                            {group.description || 'Описание пока не добавлено.'}
                          </Typography>
                        </Box>
                        <Stack direction="row" spacing={1}>
                          <Button variant="outlined" onClick={() => setSelectedGroupId(group.id)}>
                            Подробнее
                          </Button>
                          <Button variant={joinedGroupIds.has(group.id) ? 'outlined' : 'contained'} disabled={joinedGroupIds.has(group.id)} onClick={() => void handleJoinGroup(group.id)}>
                            {joinedGroupIds.has(group.id) ? 'Вы уже в группе' : 'Вступить'}
                          </Button>
                        </Stack>
                      </Stack>
                    </Paper>
                  ))}
              </Stack>

              <Divider />

              <Typography variant="subtitle2">Люди</Typography>
              <Stack spacing={1.25}>
                {userDirectory.map((item) => (
                  <Paper key={item.id} sx={{ p: 1.5, borderRadius: 1.5 }}>
                    <Stack direction={{ xs: 'column', md: 'row' }} justifyContent="space-between" spacing={1.25}>
                      <Box>
                        <Typography variant="subtitle2">{item.full_name}</Typography>
                        <Typography variant="body2" color="text.secondary">
                          {item.current_status}
                        </Typography>
                      </Box>
                      <Stack direction="row" spacing={1}>
                        <Button variant="outlined" onClick={() => void handleOpenDirectConversation(item.id)}>
                          Написать
                        </Button>
                        <Button variant="contained" onClick={() => void handleSendFriendRequest(item.id)}>
                          В друзья
                        </Button>
                      </Stack>
                    </Stack>
                  </Paper>
                ))}
              </Stack>
            </Stack>
          ) : null}

          {activeTab === 'my' ? (
            <Stack spacing={2}>
              <Stack spacing={1}>
                <Typography variant="h5">Мои группы</Typography>
                <Typography variant="body2" color="text.secondary">
                  Выберите группу слева из списка ниже, посмотрите историю, чат группы и переходите в сессии.
                </Typography>
              </Stack>

              <Box sx={{ display: 'grid', gap: 2, gridTemplateColumns: { xs: '1fr', xl: '280px minmax(0, 1fr)' } }}>
                <Paper sx={{ p: 1.25, borderRadius: 1.5 }}>
                  <List dense disablePadding>
                    {groups.map((group) => (
                      <ListItemButton key={group.id} selected={selectedGroupId === group.id} onClick={() => setSelectedGroupId(group.id)} sx={{ borderRadius: 1.5, mb: 0.5 }}>
                        <ListItemText
                          primary={group.name}
                          secondary={group.visibility === 'private' ? 'Приватная группа' : 'Открытая группа'}
                        />
                      </ListItemButton>
                    ))}
                  </List>
                </Paper>

                <Stack spacing={2}>
                  {selectedGroup ? (
                    <>
                      <Paper sx={{ p: 2, borderRadius: 1.5 }}>
                        <Stack direction={{ xs: 'column', md: 'row' }} justifyContent="space-between" spacing={1.5}>
                          <Box>
                            <Stack direction="row" spacing={1} alignItems="center" useFlexGap flexWrap="wrap">
                              <Typography variant="h5">{selectedGroup.name}</Typography>
                              <Chip size="small" label={selectedGroup.visibility === 'private' ? 'Приватная' : 'Открытая'} />
                            </Stack>
                            <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
                              {selectedGroup.description || 'Описание пока не добавлено.'}
                            </Typography>
                            <Typography variant="caption" color="text.secondary" sx={{ mt: 1, display: 'block' }}>
                              Приватный ключ: {selectedGroup.invite_key}
                            </Typography>
                          </Box>
                          <Stack direction="row" spacing={1} useFlexGap flexWrap="wrap">
                            <Button variant="outlined" startIcon={<ForumRoundedIcon />} onClick={() => void handleOpenGroupConversation(selectedGroup.id)}>
                              Чат группы
                            </Button>
                            <Button
                              component={RouterLink}
                              to={sessions[0] ? `/sessions/${sessions[0].id}` : '#'}
                              variant="contained"
                              disabled={!sessions.length}
                            >
                              Быстрый вход
                            </Button>
                          </Stack>
                        </Stack>
                      </Paper>

                      <Paper sx={{ p: 2, borderRadius: 1.5 }}>
                        <Typography variant="subtitle1">Ближайшие и активные сессии</Typography>
                        <Stack spacing={1.25} sx={{ mt: 1.25 }}>
                          {sessions.map((session) => (
                            <Paper key={session.id} sx={{ p: 1.5, borderRadius: 1.5 }}>
                              <Stack direction={{ xs: 'column', md: 'row' }} spacing={1} justifyContent="space-between">
                                <Box>
                                  <Typography variant="subtitle2">{session.title}</Typography>
                                  <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
                                    {formatDate(session.starts_at)}
                                  </Typography>
                                </Box>
                                <Button component={RouterLink} to={`/sessions/${session.id}`} variant="contained">
                                  Открыть
                                </Button>
                              </Stack>
                            </Paper>
                          ))}
                          {!sessions.length ? <Alert severity="info">В этой группе пока нет сессий.</Alert> : null}
                        </Stack>
                      </Paper>

                      <Paper sx={{ p: 2, borderRadius: 1.5 }}>
                        <Stack direction="row" spacing={1} alignItems="center">
                          <HistoryRoundedIcon fontSize="small" />
                          <Typography variant="subtitle1">История группы</Typography>
                        </Stack>
                        <Stack spacing={1.25} sx={{ mt: 1.25 }}>
                          {history.map((item) => (
                            <Paper key={item.summary_id} sx={{ p: 1.5, borderRadius: 1.5 }}>
                              <Typography variant="subtitle2">{item.session_title}</Typography>
                              <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
                                {formatDate(item.session_date)}
                              </Typography>
                              <Typography variant="body2" sx={{ mt: 1 }}>
                                {item.short_description || 'Итоги сессии ещё не заполнены.'}
                              </Typography>
                            </Paper>
                          ))}
                          {!history.length ? <Alert severity="info">История этой группы пока пустая.</Alert> : null}
                        </Stack>
                      </Paper>
                    </>
                  ) : (
                    <Alert severity="info">Выберите группу, чтобы открыть её детали.</Alert>
                  )}
                </Stack>
              </Box>
            </Stack>
          ) : null}

          {activeTab === 'materials' ? (
            selectedGroup && joinedGroupIds.has(selectedGroup.id) ? (
              <Stack spacing={2}>
                <Typography variant="h5">Материалы группы</Typography>
                <Typography variant="body2" color="text.secondary">
                  Здесь можно хранить ссылки, файлы и использовать материалы как общий контекст для группы.
                </Typography>
                <MaterialsPanel groupId={selectedGroup.id} />
              </Stack>
            ) : (
              <Alert severity="info">Выберите свою группу, чтобы работать с её материалами.</Alert>
            )
          ) : null}

          {activeTab === 'friends' ? (
            <Stack spacing={2}>
              <Typography variant="h5">Друзья и запросы</Typography>
              <Typography variant="body2" color="text.secondary">
                Здесь видна текущая занятость людей, можно принимать запросы и открывать личные чаты.
              </Typography>

              <Stack spacing={1.25}>
                {friends.map((friendship) => (
                  <Paper key={friendship.id} sx={{ p: 1.5, borderRadius: 1.5 }}>
                    <Stack direction={{ xs: 'column', md: 'row' }} spacing={1.25} justifyContent="space-between">
                      <Box>
                        <Typography variant="subtitle2">{friendship.user.full_name}</Typography>
                        <Typography variant="body2" color="text.secondary">
                          {friendship.user.current_status}
                        </Typography>
                        <Typography variant="caption" color="text.secondary">
                          Статус: {friendship.status}
                        </Typography>
                      </Box>
                      <Stack direction="row" spacing={1} useFlexGap flexWrap="wrap">
                        {friendship.status === 'pending' && friendship.direction === 'incoming' ? (
                          <>
                            <Button variant="contained" onClick={() => void handleFriendAction(friendship.id, 'accept')}>
                              Принять
                            </Button>
                            <Button variant="outlined" onClick={() => void handleFriendAction(friendship.id, 'decline')}>
                              Отклонить
                            </Button>
                          </>
                        ) : null}
                        {friendship.status === 'accepted' ? (
                          <Button variant="outlined" onClick={() => void handleOpenDirectConversation(friendship.user.id)}>
                            Открыть чат
                          </Button>
                        ) : null}
                      </Stack>
                    </Stack>
                  </Paper>
                ))}
                {!friends.length ? <Alert severity="info">Пока нет друзей и запросов.</Alert> : null}
              </Stack>
            </Stack>
          ) : null}

          {activeTab === 'messages' ? (
            <Box sx={{ display: 'grid', gap: 2, gridTemplateColumns: { xs: '1fr', xl: '320px minmax(0, 1fr)' } }}>
              <Paper sx={{ p: 1.25, borderRadius: 1.5 }}>
                <Typography variant="subtitle1" sx={{ px: 0.5, pb: 1 }}>
                  Чаты
                </Typography>
                <List dense disablePadding>
                  {conversations.map((conversation) => (
                    <ListItemButton key={conversation.id} selected={selectedConversationId === conversation.id} onClick={() => setSelectedConversationId(conversation.id)} sx={{ borderRadius: 1.5, mb: 0.5 }}>
                      <ListItemText primary={conversation.title} secondary={conversation.last_message_preview || 'Сообщений пока нет'} />
                    </ListItemButton>
                  ))}
                </List>
              </Paper>

              <Paper sx={{ p: 2, borderRadius: 1.5, minHeight: 480 }}>
                {selectedConversation ? (
                  <Stack spacing={2} sx={{ height: '100%' }}>
                    <Box>
                      <Typography variant="h6">{selectedConversation.title}</Typography>
                      <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
                        Участники: {selectedConversation.member_names.join(', ')}
                      </Typography>
                    </Box>
                    <Stack spacing={1} sx={{ flex: 1, minHeight: 240, overflowY: 'auto' }}>
                      {conversationMessages.map((message) => (
                        <Paper key={message.id} sx={{ p: 1.25, borderRadius: 1.5 }}>
                          <Typography variant="subtitle2">{message.sender_name}</Typography>
                          <Typography variant="body2" sx={{ mt: 0.5 }}>{message.body}</Typography>
                          <Typography variant="caption" color="text.secondary" sx={{ mt: 0.75, display: 'block' }}>
                            {formatDate(message.created_at)}
                          </Typography>
                        </Paper>
                      ))}
                    </Stack>
                    <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1}>
                      <TextField fullWidth label="Сообщение" value={messageDraft} onChange={(event) => setMessageDraft(event.target.value)} />
                      <Button variant="contained" onClick={() => void handleSendMessage()}>
                        Отправить
                      </Button>
                    </Stack>
                  </Stack>
                ) : (
                  <Alert severity="info">Выберите чат слева.</Alert>
                )}
              </Paper>
            </Box>
          ) : null}

          {activeTab === 'settings' ? (
            selectedGroup && joinedGroupIds.has(selectedGroup.id) ? (
              <Stack spacing={2}>
                <Typography variant="h5">Управление группой</Typography>
                <Typography variant="body2" color="text.secondary">
                  Здесь можно менять название и видимость группы, делиться приватным ключом, выходить из группы или удалять её.
                </Typography>

                <TextField
                  label="Название группы"
                  value={selectedGroup.name}
                  onChange={(event) => updateSelectedGroupPatch({ name: event.target.value })}
                />
                <TextField
                  label="Описание"
                  multiline
                  minRows={4}
                  value={selectedGroup.description}
                  onChange={(event) => updateSelectedGroupPatch({ description: event.target.value })}
                />
                <TextField
                  select
                  label="Видимость"
                  value={selectedGroup.visibility}
                  onChange={(event) => updateSelectedGroupPatch({ visibility: event.target.value as GroupVisibility })}
                >
                  <MenuItem value="public">Открытая</MenuItem>
                  <MenuItem value="private">Приватная</MenuItem>
                </TextField>
                <Paper sx={{ p: 1.5, borderRadius: 1.5 }}>
                  <Typography variant="subtitle2">Ключ для приватного входа</Typography>
                  <Typography variant="body2" color="text.secondary" sx={{ mt: 0.75 }}>
                    {selectedGroup.invite_key}
                  </Typography>
                </Paper>
                <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1}>
                  <Button variant="contained" onClick={() => void handleUpdateGroup()}>
                    Сохранить изменения
                  </Button>
                  <Button variant="outlined" color="warning" startIcon={<ExitToAppRoundedIcon />} onClick={() => void handleLeaveGroup()}>
                    Выйти из группы
                  </Button>
                  <Button variant="outlined" color="error" onClick={() => void handleDeleteGroup()}>
                    Удалить группу
                  </Button>
                </Stack>
              </Stack>
            ) : (
              <Alert severity="info">Выберите свою группу, чтобы открыть управление.</Alert>
            )
          ) : null}
        </Paper>
      </Box>

      <Dialog open={groupDialogOpen} onClose={() => setGroupDialogOpen(false)} fullWidth maxWidth="sm">
        <DialogTitle>Новая группа</DialogTitle>
        <DialogContent>
          <Stack spacing={2} sx={{ pt: 1 }}>
            <TextField label="Название группы" value={groupName} onChange={(event) => setGroupName(event.target.value)} fullWidth />
            <TextField label="Описание" value={groupDescription} onChange={(event) => setGroupDescription(event.target.value)} multiline minRows={4} fullWidth />
            <TextField select label="Видимость" value={groupVisibility} onChange={(event) => setGroupVisibility(event.target.value as GroupVisibility)} fullWidth>
              <MenuItem value="public">Открытая</MenuItem>
              <MenuItem value="private">Приватная</MenuItem>
            </TextField>
            <Button variant="contained" onClick={() => void handleCreateGroup()} disabled={!groupName.trim()}>
              Создать группу
            </Button>
          </Stack>
        </DialogContent>
      </Dialog>

      <Dialog open={sessionDialogOpen} onClose={() => setSessionDialogOpen(false)} fullWidth maxWidth="md">
        <DialogTitle>Новая учебная сессия</DialogTitle>
        <DialogContent>
          <Stack spacing={2} sx={{ pt: 1 }}>
            <TextField select label="Шаблон" value={templateKey} onChange={(event) => setTemplateKey(event.target.value)} fullWidth>
              {sessionTemplates.map((template) => (
                <MenuItem key={template.key} value={template.key}>{template.name}</MenuItem>
              ))}
            </TextField>
            <TextField label="Название сессии" value={sessionTitle} onChange={(event) => setSessionTitle(event.target.value)} fullWidth />
            <TextField label="Описание" value={sessionDescription} onChange={(event) => setSessionDescription(event.target.value)} multiline minRows={4} fullWidth />
            <TextField
              label="Начало"
              type="datetime-local"
              value={sessionStartsAt}
              onChange={(event) => setSessionStartsAt(event.target.value)}
              InputLabelProps={{ shrink: true }}
              fullWidth
            />
            <Button variant="contained" onClick={() => void handleCreateSession()} disabled={!selectedGroupId || !sessionTitle.trim() || !sessionStartsAt}>
              Создать сессию
            </Button>
          </Stack>
        </DialogContent>
      </Dialog>
    </Stack>
  );
}
