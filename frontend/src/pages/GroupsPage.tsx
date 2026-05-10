import AddCircleRoundedIcon from '@mui/icons-material/AddCircleRounded';
import ForumRoundedIcon from '@mui/icons-material/ForumRounded';
import GroupAddRoundedIcon from '@mui/icons-material/GroupAddRounded';
import GroupsRoundedIcon from '@mui/icons-material/GroupsRounded';
import HistoryRoundedIcon from '@mui/icons-material/HistoryRounded';
import KeyRoundedIcon from '@mui/icons-material/KeyRounded';
import LibraryBooksRoundedIcon from '@mui/icons-material/LibraryBooksRounded';
import ManageAccountsRoundedIcon from '@mui/icons-material/ManageAccountsRounded';
import RocketLaunchRoundedIcon from '@mui/icons-material/RocketLaunchRounded';
import SearchRoundedIcon from '@mui/icons-material/SearchRounded';
import VisibilityRoundedIcon from '@mui/icons-material/VisibilityRounded';
import {
  Alert,
  Box,
  Button,
  Chip,
  Dialog,
  DialogContent,
  DialogTitle,
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
  { key: 'exam_prep', name: 'Подготовка к экзамену', description: 'Повторение материала, вопросы и план следующего занятия.' },
  { key: 'team_project', name: 'Командный проект', description: 'Распределение ролей, задач и контроль статусов.' },
  { key: 'topic_review', name: 'Разбор темы', description: 'Обсуждение теории, выводов и совместных заметок.' },
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
  const [selectedProfile, setSelectedProfile] = useState<UserDirectory | null>(null);
  const [error, setError] = useState('');
  const [groupDialogOpen, setGroupDialogOpen] = useState(false);
  const [sessionDialogOpen, setSessionDialogOpen] = useState(false);
  const [groupName, setGroupName] = useState('');
  const [groupDescription, setGroupDescription] = useState('');
  const [groupVisibility, setGroupVisibility] = useState<GroupVisibility>('public');
  const [privateJoinKey, setPrivateJoinKey] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [friendSearchQuery, setFriendSearchQuery] = useState('');
  const [sessionTitle, setSessionTitle] = useState('');
  const [sessionDescription, setSessionDescription] = useState('');
  const [sessionStartsAt, setSessionStartsAt] = useState('');
  const [templateKey, setTemplateKey] = useState(sessionTemplates[0].key);
  const [messageDraft, setMessageDraft] = useState('');

  const joinedGroupIds = useMemo(() => new Set(groups.map((group) => group.id)), [groups]);
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
    if (selectedGroupId && joinedGroupIds.has(selectedGroupId)) {
      void loadGroupData(selectedGroupId).catch((err: Error) => setError(err.message || 'Не удалось загрузить данные группы.'));
    }
  }, [joinedGroupIds, loadGroupData, selectedGroupId]);

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
      setError((err as Error).message || 'Не удалось создать группу.');
    }
  }

  async function handleJoinGroup(groupId: number) {
    try {
      await api.post(`/groups/${groupId}/join`);
      await loadGroups();
      setSelectedGroupId(groupId);
      setActiveTab('my');
    } catch (err) {
      setError((err as Error).message || 'Не удалось вступить в группу.');
    }
  }

  async function handleJoinByKey() {
    try {
      await api.post('/groups/join-by-key', { invite_key: privateJoinKey.trim() });
      setPrivateJoinKey('');
      await loadGroups();
      setActiveTab('my');
    } catch (err) {
      setError((err as Error).message || 'Не удалось вступить в приватную группу.');
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
      setError((err as Error).message || 'Не удалось выйти из группы.');
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
      setError((err as Error).message || 'Не удалось удалить группу.');
    }
  }

  async function handleUpdateGroup(patch: Partial<Group>) {
    if (!selectedGroup) {
      return;
    }
    try {
      await api.patch(`/groups/${selectedGroup.id}`, patch);
      await loadGroups();
    } catch (err) {
      setError((err as Error).message || 'Не удалось обновить группу.');
    }
  }

  async function handleCreateSession() {
    if (!selectedGroupId || !sessionStartsAt || !sessionTitle.trim()) {
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
      setError((err as Error).message || 'Не удалось создать сессию.');
    }
  }

  async function handleUserSearch(query: string) {
    setSearchQuery(query);
    try {
      await loadDirectory(query);
    } catch (err) {
      setError((err as Error).message || 'Не удалось выполнить поиск.');
    }
  }

  async function handleSendFriendRequest(userId: number) {
    try {
      await api.post('/social/friends', { user_id: userId });
      await loadSocial();
      setActiveTab('friends');
    } catch (err) {
      setError((err as Error).message || 'Не удалось отправить запрос в друзья.');
    }
  }

  async function handleFriendAction(friendshipId: number, action: 'accept' | 'decline' | 'block') {
    try {
      await api.patch(`/social/friends/${friendshipId}`, { action });
      await loadSocial();
    } catch (err) {
      setError((err as Error).message || 'Не удалось обновить статус дружбы.');
    }
  }

  async function handleOpenDirectConversation(userId: number) {
    try {
      const response = await api.post<Conversation>(`/social/conversations/direct/${userId}`);
      await loadSocial();
      setSelectedConversationId(response.data.id);
      setActiveTab('messages');
    } catch (err) {
      setError((err as Error).message || 'Не удалось открыть личный чат.');
    }
  }

  async function handleOpenGroupConversation(groupId: number) {
    try {
      const response = await api.post<Conversation>(`/social/conversations/group/${groupId}`);
      await loadSocial();
      setSelectedConversationId(response.data.id);
      setActiveTab('messages');
    } catch (err) {
      setError((err as Error).message || 'Не удалось открыть чат группы.');
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
      setError((err as Error).message || 'Не удалось отправить сообщение.');
    }
  }

  const filteredCatalog = catalog.filter((group) => !searchQuery.trim() || group.name.toLowerCase().includes(searchQuery.toLowerCase()));
  const filteredPeople = userDirectory.filter((person) => {
    const text = friendSearchQuery.trim().toLowerCase();
    if (!text) {
      return true;
    }
    return person.full_name.toLowerCase().includes(text) || (person.email ?? '').toLowerCase().includes(text);
  });

  return (
    <Stack spacing={3}>
      <Stack direction={{ xs: 'column', lg: 'row' }} justifyContent="space-between" spacing={2}>
        <Box>
          <Typography variant="h4">Группы и сообщество</Typography>
          <Typography variant="body2" color="text.secondary" sx={{ mt: 0.75, maxWidth: 760 }}>
            Ищите группы, вступайте по приватному ключу, добавляйте людей в друзья, просматривайте профили и открывайте общие или личные чаты.
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

      {error ? <Alert severity="warning" onClose={() => setError('')}>{error}</Alert> : null}

      <Box sx={{ display: 'grid', gap: 2, gridTemplateColumns: { xs: '1fr', lg: '250px minmax(0, 1fr)' }, alignItems: 'start' }}>
        <Paper sx={{ p: 1.25, borderRadius: 2.5 }}>
          <Stack spacing={0.5}>
            {leftTabs.map((tab) => (
              <ListItemButton key={tab.key} selected={activeTab === tab.key} onClick={() => setActiveTab(tab.key)} sx={{ borderRadius: 1.5 }}>
                <ListItemText primary={tab.label} />
                {tab.icon}
              </ListItemButton>
            ))}
          </Stack>
        </Paper>

        <Paper sx={{ p: { xs: 2, md: 2.5 }, borderRadius: 2.5 }}>
          {activeTab === 'search' ? (
            <Stack spacing={2}>
              <Typography variant="h5">Поиск групп и пользователей</Typography>
              <Stack direction={{ xs: 'column', md: 'row' }} spacing={1.5} alignItems={{ md: 'stretch' }}>
                <TextField
                  fullWidth
                  label="Поиск по группам и людям"
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

              <Typography variant="subtitle1">Открытые группы</Typography>
              <Box sx={{ display: 'grid', gap: 1.5 }}>
                {filteredCatalog.map((group) => (
                  <Paper key={group.id} sx={{ p: 1.75, borderRadius: 2 }}>
                    <Stack spacing={1.25} alignItems="flex-start">
                      <Stack direction="row" spacing={1} alignItems="center" useFlexGap flexWrap="wrap">
                        <Typography variant="subtitle1">{group.name}</Typography>
                        <Chip size="small" label={group.visibility === 'private' ? 'Приватная' : 'Открытая'} />
                      </Stack>
                      <Typography variant="body2" color="text.secondary">{group.description || 'Описание не заполнено.'}</Typography>
                      <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1} useFlexGap flexWrap="wrap">
                        {joinedGroupIds.has(group.id) ? (
                          <Button variant="outlined" onClick={() => { setSelectedGroupId(group.id); setActiveTab('my'); }}>
                            Открыть
                          </Button>
                        ) : (
                          <Button variant="contained" onClick={() => void handleJoinGroup(group.id)}>
                            Вступить
                          </Button>
                        )}
                      </Stack>
                    </Stack>
                  </Paper>
                ))}
              </Box>
            </Stack>
          ) : null}

          {activeTab === 'my' ? (
            <Box sx={{ display: 'grid', gap: 2, gridTemplateColumns: { xs: '1fr', xl: '280px minmax(0, 1fr)' } }}>
              <Paper sx={{ p: 1.25, borderRadius: 2 }}>
                <List dense disablePadding>
                  {groups.map((group) => (
                    <ListItemButton key={group.id} selected={selectedGroupId === group.id} onClick={() => setSelectedGroupId(group.id)} sx={{ borderRadius: 1.5, mb: 0.5 }}>
                      <ListItemText primary={group.name} secondary={group.visibility === 'private' ? 'Приватная группа' : 'Открытая группа'} />
                    </ListItemButton>
                  ))}
                </List>
              </Paper>

              <Stack spacing={2}>
                {selectedGroup ? (
                  <>
                    <Paper sx={{ p: 2, borderRadius: 2 }}>
                      <Stack spacing={1.5} alignItems="flex-start">
                        <Stack direction="row" spacing={1} alignItems="center" useFlexGap flexWrap="wrap">
                          <Typography variant="h5">{selectedGroup.name}</Typography>
                          <Chip size="small" label={selectedGroup.visibility === 'private' ? 'Приватная' : 'Открытая'} />
                        </Stack>
                        <Typography variant="body2" color="text.secondary">
                          {selectedGroup.description || 'Описание пока не добавлено.'}
                        </Typography>
                        <Typography variant="caption" color="text.secondary">
                          Ключ для приглашения: {selectedGroup.invite_key}
                        </Typography>
                        <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1} useFlexGap flexWrap="wrap">
                          <Button variant="outlined" startIcon={<ForumRoundedIcon />} onClick={() => void handleOpenGroupConversation(selectedGroup.id)}>
                            Чат группы
                          </Button>
                          <Button component={RouterLink} to={sessions[0] ? `/sessions/${sessions[0].id}` : '#'} variant="contained" disabled={!sessions.length}>
                            Быстрый вход
                          </Button>
                        </Stack>
                      </Stack>
                    </Paper>

                    <Paper sx={{ p: 2, borderRadius: 2 }}>
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

                    <Paper sx={{ p: 2, borderRadius: 2 }}>
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
                              {item.short_description || 'Итоги сессии пока не заполнены.'}
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
          ) : null}

          {activeTab === 'materials' ? (
            selectedGroup && joinedGroupIds.has(selectedGroup.id) ? (
              <Stack spacing={2}>
                <Typography variant="h5">Материалы группы</Typography>
                <Typography variant="body2" color="text.secondary">
                  Здесь можно хранить ссылки и файлы, чтобы у участников был общий контекст по занятиям.
                </Typography>
                <MaterialsPanel groupId={selectedGroup.id} />
              </Stack>
            ) : (
              <Alert severity="info">Выберите свою группу, чтобы работать с материалами.</Alert>
            )
          ) : null}

          {activeTab === 'friends' ? (
            <Stack spacing={2}>
              <Typography variant="h5">Друзья, поиск и профили</Typography>
              <TextField
                label="Поиск друзей и пользователей"
                value={friendSearchQuery}
                onChange={(event) => setFriendSearchQuery(event.target.value)}
              />

              <Box sx={{ display: 'grid', gap: 2, gridTemplateColumns: { xs: '1fr', xl: '0.95fr 1.05fr' } }}>
                <Paper sx={{ p: 2, borderRadius: 2 }}>
                  <Typography variant="subtitle1">Каталог пользователей</Typography>
                  <Stack spacing={1.25} sx={{ mt: 1.25 }}>
                    {filteredPeople.map((person) => (
                      <Paper key={person.id} sx={{ p: 1.5, borderRadius: 1.5 }}>
                        <Stack spacing={1.25} alignItems="flex-start">
                          <Box>
                            <Typography variant="subtitle2">{person.full_name}</Typography>
                            <Typography variant="body2" color="text.secondary">
                              {person.email || 'Email скрыт'}
                            </Typography>
                            <Typography variant="caption" color="text.secondary">
                              {person.current_status}
                            </Typography>
                          </Box>
                          <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1} useFlexGap flexWrap="wrap">
                            <Button variant="outlined" startIcon={<VisibilityRoundedIcon />} onClick={() => setSelectedProfile(person)}>
                              Профиль
                            </Button>
                            <Button variant="contained" onClick={() => void handleSendFriendRequest(person.id)}>
                              В друзья
                            </Button>
                          </Stack>
                        </Stack>
                      </Paper>
                    ))}
                  </Stack>
                </Paper>

                <Paper sx={{ p: 2, borderRadius: 2 }}>
                  <Typography variant="subtitle1">Мои друзья и запросы</Typography>
                  <Stack spacing={1.25} sx={{ mt: 1.25 }}>
                    {friends.map((friendship) => (
                      <Paper key={friendship.id} sx={{ p: 1.5, borderRadius: 1.5 }}>
                        <Stack spacing={1.25} alignItems="flex-start">
                          <Box>
                            <Typography variant="subtitle2">{friendship.user.full_name}</Typography>
                            <Typography variant="body2" color="text.secondary">{friendship.user.current_status}</Typography>
                            <Typography variant="caption" color="text.secondary">Статус: {friendship.status}</Typography>
                          </Box>
                          <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1} useFlexGap flexWrap="wrap">
                            <Button variant="outlined" onClick={() => setSelectedProfile(friendship.user)}>
                              Профиль
                            </Button>
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
                </Paper>
              </Box>
            </Stack>
          ) : null}

          {activeTab === 'messages' ? (
            <Box sx={{ display: 'grid', gap: 2, gridTemplateColumns: { xs: '1fr', xl: '320px minmax(0, 1fr)' } }}>
              <Paper sx={{ p: 1.25, borderRadius: 2 }}>
                <Typography variant="subtitle1" sx={{ px: 0.5, pb: 1 }}>Чаты</Typography>
                <List dense disablePadding>
                  {conversations.map((conversation) => (
                    <ListItemButton key={conversation.id} selected={selectedConversationId === conversation.id} onClick={() => setSelectedConversationId(conversation.id)} sx={{ borderRadius: 1.5, mb: 0.5 }}>
                      <ListItemText primary={conversation.title} secondary={conversation.last_message_preview || 'Сообщений пока нет'} />
                    </ListItemButton>
                  ))}
                </List>
              </Paper>

              <Paper sx={{ p: 2, borderRadius: 2, minHeight: 480 }}>
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
                <TextField
                  label="Название группы"
                  value={selectedGroup.name}
                  onChange={(event) => setGroups((prev) => prev.map((item) => item.id === selectedGroup.id ? { ...item, name: event.target.value } : item))}
                />
                <TextField label="Описание" multiline minRows={4} value={selectedGroup.description} onChange={(event) => setGroups((prev) => prev.map((item) => item.id === selectedGroup.id ? { ...item, description: event.target.value } : item))} />
                <TextField select label="Видимость" value={selectedGroup.visibility} onChange={(event) => setGroups((prev) => prev.map((item) => item.id === selectedGroup.id ? { ...item, visibility: event.target.value as GroupVisibility } : item))}>
                  <MenuItem value="public">Открытая</MenuItem>
                  <MenuItem value="private">Приватная</MenuItem>
                </TextField>
                <Paper sx={{ p: 1.5, borderRadius: 1.5 }}>
                  <Typography variant="subtitle2">Ключ для приватного входа</Typography>
                  <Typography variant="body2" color="text.secondary" sx={{ mt: 0.75 }}>{selectedGroup.invite_key}</Typography>
                </Paper>
                <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1} useFlexGap flexWrap="wrap">
                  <Button
                    variant="contained"
                    onClick={() => void handleUpdateGroup({
                      name: groups.find((item) => item.id === selectedGroup.id)?.name,
                      description: groups.find((item) => item.id === selectedGroup.id)?.description,
                      visibility: groups.find((item) => item.id === selectedGroup.id)?.visibility,
                    })}
                  >
                    Сохранить изменения
                  </Button>
                  <Button variant="outlined" color="warning" onClick={() => void handleLeaveGroup()}>
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

      <Dialog open={Boolean(selectedProfile)} onClose={() => setSelectedProfile(null)} fullWidth maxWidth="sm">
        <DialogTitle>Профиль пользователя</DialogTitle>
        <DialogContent>
          {selectedProfile ? (
            <Stack spacing={2} sx={{ pt: 1 }}>
              <Typography variant="h6">{selectedProfile.full_name}</Typography>
              <Typography variant="body2" color="text.secondary">{selectedProfile.email || 'Email не указан'}</Typography>
              <Stack direction="row" spacing={1} useFlexGap flexWrap="wrap">
                <Chip label={`Роль: ${selectedProfile.role}`} />
                <Chip label={selectedProfile.is_online ? 'Сейчас онлайн' : 'Сейчас офлайн'} />
              </Stack>
              <Typography variant="body2">{selectedProfile.current_status}</Typography>
              <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1}>
                <Button variant="contained" onClick={() => void handleSendFriendRequest(selectedProfile.id)}>
                  Добавить в друзья
                </Button>
                <Button variant="outlined" onClick={() => void handleOpenDirectConversation(selectedProfile.id)}>
                  Открыть чат
                </Button>
              </Stack>
            </Stack>
          ) : null}
        </DialogContent>
      </Dialog>
    </Stack>
  );
}
