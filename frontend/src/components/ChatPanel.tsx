import SendRoundedIcon from '@mui/icons-material/SendRounded';
import { Alert, Box, IconButton, Stack, TextField, Typography } from '@mui/material';
import { alpha, useTheme } from '@mui/material/styles';
import { useEffect, useMemo, useRef, useState } from 'react';

import { api } from '../api/client';
import { useAuth } from '../context/AuthContext';
import type { ChatMessage } from '../types';
import { SessionSidePanel, sessionPanelFieldSx } from '../pages/video-session/components/SessionSidePanel';

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

function groupMessagesByDate(messages: ChatMessage[]) {
  const groups: Array<{ dateKey: string; label: string; items: ChatMessage[] }> = [];

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

interface Props {
  sessionId: number;
  variant?: 'default' | 'session';
  showHeader?: boolean;
  messages?: ChatMessage[];
  onMessagesChange?: (messages: ChatMessage[]) => void;
}

export function ChatPanel({
  sessionId,
  variant = 'default',
  showHeader = true,
  messages: externalMessages,
  onMessagesChange,
}: Props) {
  const theme = useTheme();
  const { user } = useAuth();
  const [messages, setMessages] = useState<ChatMessage[]>(externalMessages ?? []);
  const [value, setValue] = useState('');
  const [error, setError] = useState('');
  const listRef = useRef<HTMLDivElement>(null);
  const isSessionVariant = variant === 'session';

  const wsUrl = useMemo(() => {
    const protocol = window.location.protocol === 'https:' ? 'wss' : 'ws';
    const token = localStorage.getItem('access_token');
    return `${protocol}://${window.location.host}/ws/sessions/${sessionId}/chat?token=${token}`;
  }, [sessionId]);

  useEffect(() => {
    if (externalMessages) {
      setMessages(externalMessages);
    }
  }, [externalMessages]);

  useEffect(() => {
    api.get<ChatMessage[]>(`/chat/history/${sessionId}`).then((response) => {
      setMessages(response.data);
      onMessagesChange?.(response.data);
    });
  }, [sessionId, onMessagesChange]);

  useEffect(() => {
    const socket = new WebSocket(wsUrl);
    socket.onopen = () => setError('');
    socket.onmessage = (event) => {
      const parsed = JSON.parse(event.data);
      if (parsed?.event === 'chat_message') {
        const nextMessage: ChatMessage = {
          id: parsed.payload.id,
          session_id: sessionId,
          sender_id: parsed.payload.sender_id,
          sender_name: parsed.payload.sender_name,
          message: parsed.payload.message,
          created_at: parsed.payload.created_at,
        };
        setMessages((prev) => {
          const next = [...prev, nextMessage];
          onMessagesChange?.(next);
          return next;
        });
      }
    };
    socket.onerror = () => setError('Не удалось подключиться к чату.');
    return () => socket.close();
  }, [sessionId, wsUrl, onMessagesChange]);

  useEffect(() => {
    listRef.current?.scrollTo({ top: listRef.current.scrollHeight, behavior: 'smooth' });
  }, [messages]);

  function send() {
    if (!value.trim()) {
      return;
    }

    api.post('/chat/message', { session_id: sessionId, message: value.trim() })
      .then(() => setValue(''))
      .catch((err: Error) => setError(err.message || 'Не удалось отправить сообщение.'));
  }

  if (isSessionVariant) {
    return (
      <SessionSidePanel
        title="Чат встречи"
        subtitle="Сообщения команды в одном потоке."
        contentRef={listRef}
        footer={(
          <Stack direction="row" spacing={1} alignItems="flex-end">
            <TextField
              fullWidth
              size="small"
              value={value}
              onChange={(event) => setValue(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === 'Enter' && !event.shiftKey) {
                  event.preventDefault();
                  send();
                }
              }}
              multiline
              maxRows={3}
              placeholder="Напишите сообщение..."
              sx={sessionPanelFieldSx}
            />
            <IconButton
              color="primary"
              onClick={send}
              sx={{
                width: 40,
                height: 40,
                flexShrink: 0,
                border: '1px solid',
                borderColor: alpha('#ffffff', 0.14),
                borderRadius: 2,
                backgroundColor: alpha('#2563eb', 0.88),
                color: '#ffffff',
                '&:hover': { backgroundColor: '#1d4ed8' },
              }}
            >
              <SendRoundedIcon fontSize="small" />
            </IconButton>
          </Stack>
        )}
      >
        {error ? <Alert severity="warning" sx={{ mb: 1 }}>{error}</Alert> : null}
        <Stack spacing={1.5}>
          {groupMessagesByDate(messages).map((group) => (
            <Stack key={group.dateKey} spacing={1}>
              <Box sx={{ display: 'flex', justifyContent: 'center', py: 0.5 }}>
                <Typography
                  variant="caption"
                  sx={{
                    px: 1.25,
                    py: 0.35,
                    borderRadius: 999,
                    color: alpha('#f8fafc', 0.65),
                    bgcolor: alpha('#ffffff', 0.08),
                  }}
                >
                  {group.label}
                </Typography>
              </Box>
              {group.items.map((msg) => {
                const isOwn = (msg.sender_id != null && user?.id === msg.sender_id) || user?.full_name === msg.sender_name;

                return (
                  <Stack key={msg.id} alignItems={isOwn ? 'flex-end' : 'flex-start'}>
                    <Box
                      sx={{
                        maxWidth: '85%',
                        px: 1.25,
                        py: 0.75,
                        borderRadius: 2,
                        backgroundColor: isOwn ? alpha('#2563eb', 0.22) : alpha('#ffffff', 0.08),
                        color: '#f8fafc',
                      }}
                    >
                      <Typography variant="caption" fontWeight={700} sx={{ color: alpha('#f8fafc', 0.62), display: 'block', mb: 0.25 }}>
                        {isOwn ? 'Вы' : msg.sender_name}
                      </Typography>
                      <Stack direction="row" spacing={1} alignItems="flex-end" useFlexGap>
                        <Typography variant="body2" sx={{ whiteSpace: 'pre-wrap', color: 'inherit', flex: 1 }}>
                          {msg.message}
                        </Typography>
                        <Typography variant="caption" sx={{ opacity: 0.55, whiteSpace: 'nowrap', fontSize: '0.72rem', lineHeight: 1.2, pb: 0.1 }}>
                          {formatMessageTime(msg.created_at)}
                        </Typography>
                      </Stack>
                    </Box>
                  </Stack>
                );
              })}
            </Stack>
          ))}
        </Stack>
      </SessionSidePanel>
    );
  }

  return (
    <Box
      sx={{
        p: 3,
        height: '100%',
        minHeight: 420,
        display: 'flex',
        flexDirection: 'column',
        gap: 1.5,
        borderRadius: 3,
        bgcolor: 'background.paper',
      }}
    >
      {showHeader ? (
        <Stack spacing={0.5}>
          <Typography variant="h6">Чат сессии</Typography>
          <Typography variant="body2" color="text.secondary">
            Сообщения команды в одном потоке.
          </Typography>
        </Stack>
      ) : null}

      {error ? <Alert severity="warning">{error}</Alert> : null}

      <Box
        ref={listRef}
        sx={{
          flex: 1,
          minHeight: 0,
          overflowY: 'auto',
          border: '1px solid',
          borderColor: 'divider',
          borderRadius: 4,
          px: 1.5,
          py: 1.5,
          backgroundColor: '#f8fafc',
          boxShadow: 'inset 0 1px 2px rgba(15, 23, 42, 0.04)',
        }}
      >
        <Stack spacing={1.5}>
          {groupMessagesByDate(messages).map((group) => (
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
              {group.items.map((msg) => {
                const isOwn = (msg.sender_id != null && user?.id === msg.sender_id) || user?.full_name === msg.sender_name;

                return (
                  <Stack key={msg.id} alignItems={isOwn ? 'flex-end' : 'flex-start'}>
                    <Box
                      sx={{
                        maxWidth: '80%',
                        px: 1.25,
                        py: 0.75,
                        borderRadius: 2,
                        bgcolor: isOwn
                          ? alpha(theme.palette.primary.main, 0.12)
                          : alpha(theme.palette.text.primary, 0.05),
                        color: 'text.primary',
                      }}
                    >
                      <Typography variant="caption" fontWeight={700} color="text.secondary" sx={{ display: 'block', mb: 0.25 }}>
                        {isOwn ? 'Вы' : msg.sender_name}
                      </Typography>
                      <Stack direction="row" spacing={1} alignItems="flex-end" useFlexGap>
                        <Typography variant="body2" sx={{ whiteSpace: 'pre-wrap', flex: 1 }}>
                          {msg.message}
                        </Typography>
                        <Typography variant="caption" sx={{ opacity: 0.55, whiteSpace: 'nowrap', fontSize: '0.72rem', lineHeight: 1.2, pb: 0.1 }}>
                          {formatMessageTime(msg.created_at)}
                        </Typography>
                      </Stack>
                    </Box>
                  </Stack>
                );
              })}
            </Stack>
          ))}
        </Stack>
      </Box>

      <Box sx={{ flexShrink: 0, pt: 1 }}>
        <Stack direction="row" spacing={1} alignItems="flex-end">
          <TextField
            fullWidth
            label="Сообщение"
            value={value}
            onChange={(event) => setValue(event.target.value)}
            multiline
            maxRows={4}
            placeholder="Напишите короткое сообщение"
          />
          <IconButton color="primary" onClick={send} sx={{ width: 44, height: 44, border: '1px solid', borderColor: 'divider', borderRadius: 2, backgroundColor: '#ffffff', boxShadow: '0 8px 20px rgba(15, 23, 42, 0.08)', '&:hover': { backgroundColor: '#f8fafc' } }}>
            <SendRoundedIcon />
          </IconButton>
        </Stack>
      </Box>
    </Box>
  );
}
