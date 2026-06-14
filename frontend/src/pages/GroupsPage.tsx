import ForumRoundedIcon from '@mui/icons-material/ForumRounded';
import GroupAddRoundedIcon from '@mui/icons-material/GroupAddRounded';
import GroupsRoundedIcon from '@mui/icons-material/GroupsRounded';
import SearchRoundedIcon from '@mui/icons-material/SearchRounded';
import { Alert, Box, Button, Chip, Dialog, DialogActions, DialogContent, DialogTitle, List, ListItemButton, ListItemText, MenuItem, Paper, Stack, TextField, Typography } from '@mui/material';
import { alpha, useTheme } from '@mui/material/styles';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link as RouterLink, useSearchParams } from 'react-router-dom';

import { api } from '../api/client';
import { useAuth } from '../context/AuthContext';
import { parseInviteInput } from '../utils/groupInvite';
import { roleLabel } from '../utils/roleLabels';
import type {
  Conversation,
  ConversationMessage,
  Friendship,
  Group,
  GroupMember,
  GroupVisibility,
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
  { key: 'friends', label: 'Пользователи', icon: <GroupAddRoundedIcon fontSize="small" /> },
  { key: 'messages', label: 'Сообщения', icon: <ForumRoundedIcon fontSize="small" /> },
] as const;

type LeftTab = typeof leftTabs[number]['key'];

function formatDate(value: string) {
  return new Date(value).toLocaleString('ru-RU');
}

function formatMessageTime(value: string) {
  return new Date(value).toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' });
}

function formatMessageDateLabel(value: string) {
  const date = new Date(value);
  const today = new Date();
  const yesterday = new Date();
  yesterday.setDate(today.getDate() - 1);

  if (date.toDateString() === today.toDateString()) {
    return 'Сегодня';
  }
  if (date.toDateString() === yesterday.toDateString()) {
    return 'Вчера';
  }
  return date.toLocaleDateString('ru-RU', { day: 'numeric', month: 'long', year: 'numeric' });
}

function groupMessagesByDate(messages: ConversationMessage[]) {
  const groups: Array<{ dateKey: string; label: string; items: ConversationMessage[] }> = [];

  for (const message of messages) {
    const dateKey = new Date(message.created_at).toDateString();
    const last = groups[groups.length - 1];
    if (!last || last.dateKey !== dateKey) {
      groups.push({ dateKey, label: formatMessageDateLabel(message.created_at), items: [message] });
    } else {
      last.items.push(message);
    }
  }

  return groups;
}

function getConversationPeerName(conversation: Conversation, currentUserName?: string | null) {
  const normalizedCurrent = currentUserName?.trim().toLowerCase();
  const peerFromMembers = conversation.member_names.find(
    (name) => name.trim().toLowerCase() !== normalizedCurrent,
  );
  if (peerFromMembers) {
    return peerFromMembers;
  }
  const parts = conversation.title.split(' и ').map((part) => part.trim()).filter(Boolean);
  return parts.find((part) => part.toLowerCase() !== normalizedCurrent) ?? conversation.title;
}

export function GroupsPage() {
  const theme = useTheme();
  const { user } = useAuth();
  const [searchParams, setSearchParams] = useSearchParams();
  const [activeTab, setActiveTab] = useState<LeftTab>('my');
  const [groups, setGroups] = useState<Group[]>([]);
  const [catalog, setCatalog] = useState<Group[]>([]);
  const [selectedGroupId, setSelectedGroupId] = useState<number | null>(null);
  const [sessions, setSessions] = useState<VideoSession[]>([]);
  const [groupMembers, setGroupMembers] = useState<GroupMember[]>([]);
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
  const [templateKey, setTemplateKey] = useState(sessionTemplates[0].key);
  const [messageDraft, setMessageDraft] = useState('');
  const [shareDialogOpen, setShareDialogOpen] = useState(false);
  const [membersDialogOpen, setMembersDialogOpen] = useState(false);
  const [sharingToFriendId, setSharingToFriendId] = useState<number | null>(null);
  const [joinLinkHandled, setJoinLinkHandled] = useState(false);

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
    const [sessionsResponse, membersResponse] = await Promise.all([
      api.get<VideoSession[]>(`/sessions/group/${groupId}`),
      api.get<GroupMember[]>(`/groups/${groupId}/members`),
    ]);
    setSessions(sessionsResponse.data);
    setGroupMembers(membersResponse.data);
  }, []);

  const loadSocial = useCallback(async () => {
    const [friendsResponse, conversationsResponse] = await Promise.all([
      api.get<Friendship[]>('/social/friends'),
      api.get<Conversation[]>('/social/conversations'),
    ]);
    setFriends(friendsResponse.data);
    const directConversations = conversationsResponse.data.filter((item) => item.kind === 'direct');
    setConversations(directConversations);
    setSelectedConversationId((prev) => prev ?? directConversations[0]?.id ?? null);
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
    } else {
      setGroupMembers([]);
    }
  }, [joinedGroupIds, loadGroupData, selectedGroupId]);

  useEffect(() => {
    const joinKey = searchParams.get('join');
    if (!joinKey || joinLinkHandled) {
      return;
    }
    setJoinLinkHandled(true);
    void api.post('/groups/join-by-key', { invite_key: joinKey })
      .then(async (response) => {
        await loadGroups();
        setSelectedGroupId(response.data.id);
        setActiveTab('my');
        setSearchParams({}, { replace: true });
      })
      .catch((err: Error) => setError(err.message || 'Не удалось вступить в группу по ссылке.'));
  }, [joinLinkHandled, loadGroups, searchParams, setSearchParams]);

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
    const name = groupName.trim();
    if (name.length < 2) {
      setError('Название группы должно содержать минимум 2 символа.');
      return;
    }
    try {
      await api.post('/groups', {
        name,
        description: groupDescription.trim(),
        visibility: groupVisibility,
      });
      setGroupDialogOpen(false);
      setGroupName('');
      setGroupDescription('');
      setGroupVisibility('public');
      await loadGroups();
      setActiveTab('my');
    } catch (err: unknown) {
      const axiosError = err as { response?: { data?: { detail?: unknown } } };
      const detail = axiosError.response?.data?.detail;
      if (Array.isArray(detail)) {
        const message = detail.map((item) => (typeof item === 'object' && item && 'msg' in item ? String(item.msg) : '')).filter(Boolean).join(' ');
        setError(message || 'Не удалось создать группу.');
        return;
      }
      setError(err instanceof Error ? err.message : 'Не удалось создать группу.');
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
    const inviteKey = parseInviteInput(privateJoinKey);
    if (!inviteKey) {
      setError('Введите ключ или ссылку для входа в группу.');
      return;
    }
    try {
      const response = await api.post<Group>('/groups/join-by-key', { invite_key: inviteKey });
      setPrivateJoinKey('');
      await loadGroups();
      setSelectedGroupId(response.data.id);
      setActiveTab('my');
    } catch (err) {
      setError((err as Error).message || 'Не удалось вступить в группу.');
    }
  }

  async function handleRemoveMember(memberUserId: number) {
    if (!selectedGroup) return;
    try {
      await api.delete(`/groups/${selectedGroup.id}/members/${memberUserId}`);
      await loadGroupData(selectedGroup.id);
    } catch (err) {
      setError((err as Error).message || 'Не удалось удалить участника.');
    }
  }

  async function handleDeleteSession(sessionId: number) {
    if (!selectedGroupId) return;
    try {
      await api.delete(`/sessions/${sessionId}`);
      await loadGroupData(selectedGroupId);
    } catch (err) {
      setError((err as Error).message || 'Не удалось удалить сессию.');
    }
  }

  async function handleShareInviteLink(friendUserId: number) {
    if (!selectedGroup) return;
    setSharingToFriendId(friendUserId);
    try {
      const conversation = await api.post<Conversation>(`/social/conversations/direct/${friendUserId}`);
      await api.post(`/social/conversations/${conversation.data.id}/messages`, {
        body: `Приглашение в группу «${selectedGroup.name}».\nКод для входа: ${selectedGroup.invite_key}`,
      });
      setShareDialogOpen(false);
    } catch (err) {
      setError((err as Error).message || 'Не удалось отправить ссылку.');
    } finally {
      setSharingToFriendId(null);
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
    if (!selectedGroupId || !sessionTitle.trim()) {
      return;
    }
    try {
      await api.post('/sessions', {
        group_id: selectedGroupId,
        title: sessionTitle.trim(),
        description: sessionDescription.trim(),
        template_key: templateKey,
        starts_at: new Date().toISOString(),
      });
      setSessionDialogOpen(false);
      setSessionTitle('');
      setSessionDescription('');
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

  async function handleFriendAction(friendshipId: number, action: 'accept' | 'decline' | 'block' | 'remove') {
    try {
      await api.patch(`/social/friends/${friendshipId}`, { action });
      await loadSocial();
    } catch (err) {
      setError((err as Error).message || 'Не удалось обновить статус дружбы.');
    }
  }

  function getFriendshipWith(userId: number) {
    return friends.find((friendship) => friendship.user.id === userId) ?? null;
  }

  function friendshipStatusLabel(friendship: Friendship) {
    if (friendship.status === 'accepted') return 'В друзьях';
    if (friendship.status === 'blocked') return 'Заблокирован';
    return friendship.direction === 'incoming' ? 'Входящий запрос' : 'Запрос отправлен';
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
  const acceptedFriends = useMemo(
    () => friends.filter((friendship) => friendship.status === 'accepted'),
    [friends],
  );
  const isGroupOwner = selectedGroup?.owner_id === user?.id;

  return (
    <Stack spacing={3}>
      <Typography variant="h4">Группы и сообщество</Typography>

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
                  placeholder="Поиск по группам и людям"
                  value={searchQuery}
                  onChange={(event) => void handleUserSearch(event.target.value)}
                />
                <TextField
                  placeholder="Ключ или ссылка"
                  value={privateJoinKey}
                  onChange={(event) => setPrivateJoinKey(event.target.value)}
                  sx={{ minWidth: { md: 220 } }}
                />
                <Button variant="contained" onClick={() => void handleJoinByKey()} sx={{ flexShrink: 0 }}>
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
                <Button
                  variant="contained"
                  fullWidth
                  onClick={() => setGroupDialogOpen(true)}
                  sx={{ mb: 1 }}
                >
                  Создать группу
                </Button>
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
                      <Stack spacing={1.5}>
                        <Stack direction="row" alignItems="center" justifyContent="space-between" spacing={1.5} useFlexGap flexWrap="wrap">
                          <Stack direction="row" spacing={1} alignItems="center" useFlexGap flexWrap="wrap" sx={{ minWidth: 0 }}>
                            <Typography variant="h5">{selectedGroup.name}</Typography>
                            <Chip size="small" label={selectedGroup.visibility === 'private' ? 'Приватная' : 'Открытая'} />
                          </Stack>
                          <Stack direction="row" spacing={1} flexShrink={0}>
                            <Button
                              variant="contained"
                              onClick={() => setSessionDialogOpen(true)}
                              disabled={!selectedGroupId || !joinedGroupIds.has(selectedGroupId)}
                            >
                              Новая сессия
                            </Button>
                            <Button variant="outlined" onClick={() => setMembersDialogOpen(true)}>
                              Участники{groupMembers.length ? ` (${groupMembers.length})` : ''}
                            </Button>
                            {selectedGroup.visibility === 'private' ? (
                              <Button variant="outlined" onClick={() => setShareDialogOpen(true)}>
                                Поделиться
                              </Button>
                            ) : null}
                          </Stack>
                        </Stack>
                        <Typography variant="body2" color="text.secondary">
                          {selectedGroup.description || 'Описание пока не добавлено.'}
                        </Typography>
                      </Stack>
                    </Paper>

                    <Paper sx={{ p: 2, borderRadius: 2 }}>
                      <Typography variant="subtitle2" sx={{ fontWeight: 700, mb: 1 }}>
                        Ближайшие и активные сессии
                      </Typography>
                      <Stack spacing={1}>
                        {sessions.map((session) => (
                          <Paper key={session.id} variant="outlined" sx={{ p: 1.25, borderRadius: 1.5 }}>
                            <Stack direction="row" spacing={1} justifyContent="space-between" alignItems="center">
                              <Box sx={{ minWidth: 0 }}>
                                <Typography variant="body2" sx={{ fontWeight: 600 }}>{session.title}</Typography>
                                <Typography variant="caption" color="text.secondary">
                                  {formatDate(session.starts_at)}
                                </Typography>
                              </Box>
                              <Stack direction="row" spacing={0.75} flexShrink={0}>
                                <Button component={RouterLink} to={`/sessions/${session.id}`} variant="contained">
                                  Открыть
                                </Button>
                                {isGroupOwner ? (
                                  <Button color="error" variant="outlined" onClick={() => void handleDeleteSession(session.id)}>
                                    Удалить
                                  </Button>
                                ) : null}
                              </Stack>
                            </Stack>
                          </Paper>
                        ))}
                        {!sessions.length ? <Alert severity="info">В этой группе пока нет сессий.</Alert> : null}
                      </Stack>
                    </Paper>

                    {isGroupOwner ? (
                      <Paper sx={{ p: 2, borderRadius: 2 }}>
                        <Typography variant="subtitle2" sx={{ fontWeight: 700, mb: 1.5 }}>Настройки группы</Typography>
                        <Stack spacing={1.5}>
                          <TextField
                            label="Название группы"
                            value={selectedGroup.name}
                            onChange={(event) => setGroups((prev) => prev.map((item) => item.id === selectedGroup.id ? { ...item, name: event.target.value } : item))}
                          />
                          <TextField
                            label="Описание"
                            multiline
                            minRows={3}
                            value={selectedGroup.description}
                            onChange={(event) => setGroups((prev) => prev.map((item) => item.id === selectedGroup.id ? { ...item, description: event.target.value } : item))}
                          />
                          <TextField
                            select
                            label="Видимость"
                            value={selectedGroup.visibility}
                            onChange={(event) => setGroups((prev) => prev.map((item) => item.id === selectedGroup.id ? { ...item, visibility: event.target.value as GroupVisibility } : item))}
                          >
                            <MenuItem value="public">Открытая</MenuItem>
                            <MenuItem value="private">Приватная</MenuItem>
                          </TextField>
                          <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1} useFlexGap flexWrap="wrap">
                            <Button
                              variant="contained"
                              onClick={() => void handleUpdateGroup({
                                name: groups.find((item) => item.id === selectedGroup.id)?.name,
                                description: groups.find((item) => item.id === selectedGroup.id)?.description,
                                visibility: groups.find((item) => item.id === selectedGroup.id)?.visibility,
                              })}
                            >
                              Сохранить
                            </Button>
                            <Button variant="outlined" color="error" onClick={() => void handleDeleteGroup()}>
                              Удалить группу
                            </Button>
                          </Stack>
                        </Stack>
                      </Paper>
                    ) : (
                      <Box>
                        <Button variant="outlined" color="warning" onClick={() => void handleLeaveGroup()}>
                          Выйти из группы
                        </Button>
                      </Box>
                    )}
                  </>
                ) : (
                  <Alert severity="info">Выберите группу, чтобы открыть её детали.</Alert>
                )}
              </Stack>
            </Box>
          ) : null}

          {activeTab === 'friends' ? (
            <Stack spacing={2}>
              <Typography variant="h5">Пользователи</Typography>
              <TextField
                label="Поиск пользователей"
                value={friendSearchQuery}
                onChange={(event) => setFriendSearchQuery(event.target.value)}
              />

              <Box sx={{ display: 'grid', gap: 2, gridTemplateColumns: { xs: '1fr', xl: '0.95fr 1.05fr' } }}>
                <Paper sx={{ p: 2, borderRadius: 2 }}>
                  <Typography variant="subtitle1">Пользователи</Typography>
                  <Stack spacing={1.25} sx={{ mt: 1.25 }}>
                    {filteredPeople.map((person) => {
                      const friendship = getFriendshipWith(person.id);
                      return (
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
                            <Button variant="outlined" onClick={() => setSelectedProfile(person)}>
                              Профиль
                            </Button>
                            {!friendship ? (
                              <Button variant="contained" onClick={() => void handleSendFriendRequest(person.id)}>
                                В друзья
                              </Button>
                            ) : friendship.status === 'pending' && friendship.direction === 'incoming' ? (
                              <>
                                <Button variant="contained" onClick={() => void handleFriendAction(friendship.id, 'accept')}>
                                  Принять
                                </Button>
                                <Button variant="outlined" onClick={() => void handleFriendAction(friendship.id, 'decline')}>
                                  Отклонить
                                </Button>
                              </>
                            ) : friendship.status === 'pending' ? (
                              <Button variant="outlined" disabled>
                                Запрос отправлен
                              </Button>
                            ) : friendship.status === 'accepted' ? (
                              <Button variant="outlined" onClick={() => void handleOpenDirectConversation(person.id)}>
                                Открыть чат
                              </Button>
                            ) : null}
                          </Stack>
                        </Stack>
                      </Paper>
                    );})}
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
                            <Typography variant="caption" color="text.secondary">{friendshipStatusLabel(friendship)}</Typography>
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
                      <ListItemText primary={getConversationPeerName(conversation, user?.full_name)} />
                    </ListItemButton>
                  ))}
                </List>
              </Paper>

              <Paper sx={{ p: 2, borderRadius: 2, minHeight: 480, display: 'flex', flexDirection: 'column' }}>
                {selectedConversation ? (
                  <Stack spacing={2} sx={{ height: '100%', minHeight: 0 }}>
                    <Typography variant="h6">
                      {getConversationPeerName(selectedConversation, user?.full_name)}
                    </Typography>
                    <Stack spacing={1.5} sx={{ flex: 1, minHeight: 240, overflowY: 'auto', px: 0.5 }}>
                      {groupMessagesByDate(conversationMessages).map((group) => (
                        <Stack key={group.dateKey} spacing={1}>
                          <Box sx={{ display: 'flex', justifyContent: 'center', py: 0.5 }}>
                            <Typography
                              variant="caption"
                              color="text.secondary"
                              sx={{
                                px: 1.25,
                                py: 0.35,
                                borderRadius: 999,
                                bgcolor: alpha(theme.palette.text.primary, 0.06),
                              }}
                            >
                              {group.label}
                            </Typography>
                          </Box>
                          {group.items.map((message) => {
                            const isOwn = message.sender_id === user?.id;
                            return (
                              <Box
                                key={message.id}
                                sx={{
                                  display: 'flex',
                                  justifyContent: isOwn ? 'flex-end' : 'flex-start',
                                }}
                              >
                                <Box
                                  sx={{
                                    maxWidth: '78%',
                                    px: 1.25,
                                    py: 0.75,
                                    borderRadius: 2,
                                    bgcolor: isOwn
                                      ? alpha(theme.palette.primary.main, 0.12)
                                      : alpha(theme.palette.text.primary, 0.05),
                                    color: 'text.primary',
                                  }}
                                >
                                  <Stack direction="row" spacing={1} alignItems="flex-end" useFlexGap>
                                    <Typography variant="body2" sx={{ whiteSpace: 'pre-wrap', flex: 1 }}>
                                      {message.body}
                                    </Typography>
                                    <Typography
                                      variant="caption"
                                      sx={{
                                        opacity: 0.55,
                                        whiteSpace: 'nowrap',
                                        fontSize: '0.72rem',
                                        lineHeight: 1.2,
                                        pb: 0.1,
                                      }}
                                    >
                                      {formatMessageTime(message.created_at)}
                                    </Typography>
                                  </Stack>
                                </Box>
                              </Box>
                            );
                          })}
                        </Stack>
                      ))}
                    </Stack>
                    <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1}>
                      <TextField
                        fullWidth
                        placeholder="Сообщение"
                        value={messageDraft}
                        onChange={(event) => setMessageDraft(event.target.value)}
                        onKeyDown={(event) => {
                          if (event.key === 'Enter' && !event.shiftKey) {
                            event.preventDefault();
                            void handleSendMessage();
                          }
                        }}
                      />
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
            <Button variant="contained" onClick={() => void handleCreateGroup()} disabled={groupName.trim().length < 2}>
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
            <Button variant="contained" onClick={() => void handleCreateSession()} disabled={!selectedGroupId || !sessionTitle.trim()}>
              Создать сессию
            </Button>
          </Stack>
        </DialogContent>
      </Dialog>

      <Dialog open={membersDialogOpen} onClose={() => setMembersDialogOpen(false)} fullWidth maxWidth="sm">
        <DialogTitle>
          Участники группы
          {selectedGroup ? ` «${selectedGroup.name}»` : ''}
        </DialogTitle>
        <DialogContent>
          <Stack spacing={1} sx={{ pt: 0.5 }}>
            {groupMembers.map((member) => (
              <Stack key={member.user_id} direction="row" justifyContent="space-between" alignItems="center" spacing={1}>
                <Box>
                  <Typography variant="body2" sx={{ fontWeight: 600 }}>
                    {member.full_name}
                    {member.is_owner ? ' · создатель' : ''}
                  </Typography>
                  <Typography variant="caption" color="text.secondary">{member.email || 'Email скрыт'}</Typography>
                </Box>
                {isGroupOwner && !member.is_owner ? (
                  <Button color="error" variant="outlined" onClick={() => void handleRemoveMember(member.user_id)}>
                    Удалить
                  </Button>
                ) : null}
              </Stack>
            ))}
            {!groupMembers.length ? (
              <Typography variant="body2" color="text.secondary">Участников пока нет.</Typography>
            ) : null}
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setMembersDialogOpen(false)}>Закрыть</Button>
        </DialogActions>
      </Dialog>

      <Dialog open={shareDialogOpen} onClose={() => !sharingToFriendId && setShareDialogOpen(false)} fullWidth maxWidth="sm">
        <DialogTitle>Поделиться группой</DialogTitle>
        <DialogContent>
          <Stack spacing={1.5} sx={{ pt: 1 }}>
            {selectedGroup ? (
              <Paper variant="outlined" sx={{ p: 1.5, borderRadius: 2 }}>
                <Typography variant="body2" color="text.secondary">Код для входа в группу</Typography>
                <Typography variant="h6" sx={{ mt: 0.5, letterSpacing: '0.08em' }}>{selectedGroup.invite_key}</Typography>
              </Paper>
            ) : null}
            <Typography variant="body2" color="text.secondary">
              Выберите друга — ему придёт код для входа в личные сообщения.
            </Typography>
            {acceptedFriends.length ? acceptedFriends.map((friendship) => (
              <Button
                key={friendship.id}
                variant="outlined"
                fullWidth
                sx={{ justifyContent: 'flex-start' }}
                disabled={sharingToFriendId !== null}
                onClick={() => void handleShareInviteLink(friendship.user.id)}
              >
                {friendship.user.full_name}
              </Button>
            )) : (
              <Alert severity="info">Добавьте друзей, чтобы отправлять приглашения.</Alert>
            )}
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setShareDialogOpen(false)} disabled={sharingToFriendId !== null}>Закрыть</Button>
        </DialogActions>
      </Dialog>

      <Dialog open={Boolean(selectedProfile)} onClose={() => setSelectedProfile(null)} fullWidth maxWidth="sm">
        <DialogTitle>Профиль пользователя</DialogTitle>
        <DialogContent>
          {selectedProfile ? (
            <Stack spacing={2} sx={{ pt: 1 }}>
              <Typography variant="h6">{selectedProfile.full_name}</Typography>
              <Typography variant="body2" color="text.secondary">{selectedProfile.email || 'Email не указан'}</Typography>
              <Stack direction="row" spacing={1} useFlexGap flexWrap="wrap">
                <Chip label={`Роль: ${roleLabel(selectedProfile.role)}`} />
                <Chip label={selectedProfile.is_online ? 'Сейчас онлайн' : 'Сейчас офлайн'} />
              </Stack>
              <Typography variant="body2">{selectedProfile.current_status}</Typography>
              <Stack spacing={0.75}>
                <Typography variant="subtitle2">Навыки</Typography>
                <Stack direction="row" spacing={1} useFlexGap flexWrap="wrap">
                  {selectedProfile.skills?.length
                    ? selectedProfile.skills.map((skill) => <Chip key={skill} label={skill} size="small" />)
                    : <Typography variant="body2" color="text.secondary">Навыки не указаны.</Typography>}
                </Stack>
              </Stack>
              <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1}>
                {(() => {
                  const friendship = getFriendshipWith(selectedProfile.id);
                  if (!friendship) {
                    return (
                      <Button variant="contained" onClick={() => void handleSendFriendRequest(selectedProfile.id)}>
                        Добавить в друзья
                      </Button>
                    );
                  }
                  if (friendship.status === 'pending' && friendship.direction === 'incoming') {
                    return (
                      <Button variant="contained" onClick={() => void handleFriendAction(friendship.id, 'accept')}>
                        Принять запрос
                      </Button>
                    );
                  }
                  if (friendship.status === 'accepted') {
                    return (
                      <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1} useFlexGap flexWrap="wrap">
                        <Button variant="outlined" onClick={() => void handleOpenDirectConversation(selectedProfile.id)}>
                          Открыть чат
                        </Button>
                        <Button
                          variant="outlined"
                          color="error"
                          onClick={() => {
                            void handleFriendAction(friendship.id, 'remove').then(() => setSelectedProfile(null));
                          }}
                        >
                          Убрать из друзей
                        </Button>
                      </Stack>
                    );
                  }
                  return (
                    <Button variant="outlined" disabled>
                      Запрос отправлен
                    </Button>
                  );
                })()}
              </Stack>
            </Stack>
          ) : null}
        </DialogContent>
      </Dialog>
    </Stack>
  );
}
