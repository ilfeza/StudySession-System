import SendRoundedIcon from '@mui/icons-material/SendRounded';
import { Alert, Box, IconButton, Paper, Stack, TextField, Typography } from '@mui/material';
import { useEffect, useMemo, useRef, useState } from 'react';

import { api } from '../api/client';
import { ChatMessage } from '../types';

interface Props {
  sessionId: number;
  variant?: 'default' | 'session';
}

export function ChatPanel({ sessionId, variant = 'default' }: Props) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
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
    api.get<ChatMessage[]>(`/chat/history/${sessionId}`).then((response) => setMessages(response.data));
  }, [sessionId]);

  useEffect(() => {
    const socket = new WebSocket(wsUrl);
    socket.onopen = () => setError('');
    socket.onmessage = (event) => {
      const parsed = JSON.parse(event.data);
      if (parsed?.event === 'chat_message') {
        setMessages((prev) => [
          ...prev,
          {
            id: parsed.payload.id,
            session_id: sessionId,
            sender_name: parsed.payload.sender_name,
            message: parsed.payload.message,
            created_at: parsed.payload.created_at,
          },
        ]);
      }
    };
    socket.onerror = () => setError('Не удалось подключиться к чату.');
    return () => socket.close();
  }, [sessionId, wsUrl]);

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
        height: isSessionVariant ? '100%' : 420,
        minHeight: 0,
        display: 'flex',
        flexDirection: 'column',
        gap: 1.5,
        borderRadius: 0,
        border: 'none',
        boxShadow: 'none',
        backgroundColor: 'transparent',
      }}
    >
      <Stack spacing={0.5}>
        <Typography variant="h6">{isSessionVariant ? 'Чат встречи' : 'Чат сессии'}</Typography>
        <Typography variant="body2" color="text.secondary">
          Короткие сообщения команды в одном потоке.
        </Typography>
      </Stack>
      {error ? <Alert severity="warning">{error}</Alert> : null}
      <Box
        ref={listRef}
        sx={{
          flex: 1,
          minHeight: 0,
          overflowY: 'auto',
          border: '1px solid',
          borderColor: 'divider',
          borderRadius: 3,
          p: 1.5,
          backgroundColor: '#f9fafb',
        }}
      >
        <Stack spacing={1}>
          {messages.map((msg) => (
            <Box
              key={msg.id}
              sx={{
                p: 1.5,
                borderRadius: 2,
                backgroundColor: '#ffffff',
                border: '1px solid',
                borderColor: 'divider',
              }}
            >
              <Typography variant="caption" fontWeight={700} color="text.secondary">
                {msg.sender_name}
              </Typography>
              <Typography variant="body2" sx={{ mt: 0.5, whiteSpace: 'pre-wrap' }}>
                {msg.message}
              </Typography>
            </Box>
          ))}
        </Stack>
      </Box>
      <Stack direction="row" spacing={1} alignItems="flex-end">
        <TextField
          fullWidth
          label="Сообщение"
          value={value}
          onChange={(event) => setValue(event.target.value)}
          multiline
          maxRows={4}
        />
        <IconButton color="primary" onClick={send} sx={{ width: 44, height: 44, border: '1px solid', borderColor: 'divider', borderRadius: 2 }}>
          <SendRoundedIcon />
        </IconButton>
      </Stack>
    </Paper>
  );
}
