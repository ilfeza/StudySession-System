import SendRoundedIcon from '@mui/icons-material/SendRounded';
import { Alert, Box, IconButton, Paper, Stack, TextField, Typography } from '@mui/material';
import { alpha } from '@mui/material/styles';
import { useEffect, useMemo, useRef, useState } from 'react';

import { api } from '../api/client';
import { useAuth } from '../context/AuthContext';
import type { ChatMessage } from '../types';

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

  return (
    <Paper
      sx={{
        p: isSessionVariant ? 0 : 3,
        height: '100%',
        minHeight: isSessionVariant ? 0 : 420,
        display: 'flex',
        flexDirection: 'column',
        gap: 1.5,
        borderRadius: isSessionVariant ? 0 : 3,
        border: 'none',
        boxShadow: 'none',
        backgroundColor: 'transparent',
      }}
    >
      {showHeader ? (
        <Stack spacing={0.5}>
          <Typography variant="h6">{isSessionVariant ? 'Чат встречи' : 'Чат сессии'}</Typography>
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
          borderRadius: isSessionVariant ? 3 : 4,
          px: 1.5,
          py: 1.5,
          backgroundColor: '#f8fafc',
          boxShadow: 'inset 0 1px 2px rgba(15, 23, 42, 0.04)',
        }}
      >
        <Stack spacing={1}>
          {messages.map((msg) => {
            const isOwn = (msg.sender_id != null && user?.id === msg.sender_id) || user?.full_name === msg.sender_name;

            return (
              <Stack key={msg.id} alignItems={isOwn ? 'flex-end' : 'flex-start'}>
                <Box
                  sx={{
                    maxWidth: '80%',
                    p: 1.5,
                    borderRadius: 3,
                    backgroundColor: isOwn ? '#111827' : '#ffffff',
                    color: isOwn ? '#ffffff' : '#111827',
                    border: '1px solid',
                    borderColor: isOwn ? '#111827' : 'divider',
                    boxShadow: '0 1px 2px rgba(15, 23, 42, 0.04)',
                  }}
                >
                  <Typography variant="caption" fontWeight={700} sx={{ color: isOwn ? 'rgba(255,255,255,0.72)' : 'text.secondary' }}>
                    {isOwn ? 'Вы' : msg.sender_name}
                  </Typography>
                  <Typography variant="body2" sx={{ mt: 0.5, whiteSpace: 'pre-wrap', color: 'inherit' }}>
                    {msg.message}
                  </Typography>
                </Box>
              </Stack>
            );
          })}
        </Stack>
      </Box>

      <Box
        sx={{
          flexShrink: 0,
          pt: 1,
          borderTop: '1px solid',
          borderColor: isSessionVariant ? alpha('#cbd5e1', 0.7) : 'transparent',
        }}
      >
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
    </Paper>
  );
}
