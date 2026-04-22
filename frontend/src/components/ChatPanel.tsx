import SendRoundedIcon from '@mui/icons-material/SendRounded';
import { Box, IconButton, Paper, Stack, TextField, Typography } from '@mui/material';
import { alpha } from '@mui/material/styles';
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
        p: isSessionVariant ? 2.5 : 2,
        height: isSessionVariant ? '100%' : 420,
        minHeight: 0,
        display: 'flex',
        flexDirection: 'column',
        gap: 1.5,
        borderRadius: isSessionVariant ? 4 : undefined,
        background: isSessionVariant ? alpha('#08111f', 0.9) : undefined,
        color: isSessionVariant ? '#f8fbff' : undefined,
        border: isSessionVariant ? `1px solid ${alpha('#ffffff', 0.08)}` : undefined,
        boxShadow: isSessionVariant ? '0 24px 60px rgba(0, 0, 0, 0.35)' : undefined,
        backdropFilter: isSessionVariant ? 'blur(16px)' : undefined,
      }}
    >
      <Typography variant="h6" fontWeight={800}>
        {isSessionVariant ? 'Чат встречи' : 'Чат сессии'}
      </Typography>
      {error && <Typography color={isSessionVariant ? '#ffb4b4' : 'error'}>{error}</Typography>}
      <Box
        ref={listRef}
        sx={{
          flex: 1,
          minHeight: 0,
          overflowY: 'auto',
          border: isSessionVariant ? `1px solid ${alpha('#ffffff', 0.06)}` : '1px solid #e8edf6',
          borderRadius: 3,
          p: 1,
          background: isSessionVariant ? alpha('#0f1b31', 0.72) : undefined,
        }}
      >
        <Stack spacing={1}>
          {messages.map((msg) => (
            <Box
              key={msg.id}
              sx={{
                p: 1.25,
                backgroundColor: isSessionVariant ? alpha('#162744', 0.92) : '#f5f8ff',
                borderRadius: 2,
              }}
            >
              <Typography variant="caption" fontWeight={700} color={isSessionVariant ? '#8fb8ff' : undefined}>
                {msg.sender_name}
              </Typography>
              <Typography variant="body2">{msg.message}</Typography>
            </Box>
          ))}
        </Stack>
      </Box>
      <Stack direction="row" spacing={1}>
        <TextField
          fullWidth
          label="Написать сообщение"
          value={value}
          onChange={(event) => setValue(event.target.value)}
          sx={isSessionVariant ? {
            '& .MuiOutlinedInput-root': {
              color: '#f8fbff',
              borderRadius: 3,
              backgroundColor: alpha('#ffffff', 0.03),
            },
            '& .MuiOutlinedInput-notchedOutline': {
              borderColor: alpha('#ffffff', 0.12),
            },
            '& .MuiInputLabel-root': {
              color: alpha('#f8fbff', 0.7),
            },
          } : undefined}
        />
        <IconButton
          color="primary"
          onClick={send}
          sx={isSessionVariant ? {
            alignSelf: 'center',
            width: 48,
            height: 48,
            borderRadius: 2.5,
            background: 'linear-gradient(135deg, #3384ff 0%, #1d6eff 100%)',
            color: '#ffffff',
            '&:hover': {
              background: 'linear-gradient(135deg, #4a93ff 0%, #2f78ff 100%)',
            },
          } : undefined}
        >
          <SendRoundedIcon />
        </IconButton>
      </Stack>
    </Paper>
  );
}
