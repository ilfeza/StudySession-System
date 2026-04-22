import { useEffect, useMemo, useRef, useState } from 'react';

import type { PomodoroStateSnapshot, StageStateSnapshot, WidgetsClientEvent, WidgetsServerEvent } from '../../types/pomodoro';

export interface WidgetsSocketState {
  pomodoro: PomodoroStateSnapshot | null;
  stage: StageStateSnapshot | null;
  lastStartedToast: PomodoroStateSnapshot | null;
  error: string;
  connected: boolean;
}

function safeParse(data: string): WidgetsServerEvent | null {
  try {
    return JSON.parse(data) as WidgetsServerEvent;
  } catch {
    return null;
  }
}

export function useWidgetsSocket(sessionId: number) {
  const wsUrl = useMemo(() => {
    const protocol = window.location.protocol === 'https:' ? 'wss' : 'ws';
    const token = localStorage.getItem('access_token');
    return `${protocol}://${window.location.host}/ws/sessions/${sessionId}/widgets?token=${token}`;
  }, [sessionId]);

  const socketRef = useRef<WebSocket | null>(null);
  const [state, setState] = useState<WidgetsSocketState>({
    pomodoro: null,
    stage: null,
    lastStartedToast: null,
    error: '',
    connected: false,
  });

  useEffect(() => {
    const socket = new WebSocket(wsUrl);
    socketRef.current = socket;

    socket.onopen = () => {
      setState((prev) => ({ ...prev, error: '', connected: true }));
    };

    socket.onmessage = (event) => {
      const parsed = safeParse(event.data);
      if (!parsed) {
        return;
      }

      if (parsed.event === 'pomodoro_state') {
        setState((prev) => ({ ...prev, pomodoro: parsed.payload }));
        return;
      }

      if (parsed.event === 'pomodoro_started') {
        setState((prev) => ({ ...prev, pomodoro: parsed.payload, lastStartedToast: parsed.payload }));
        return;
      }

      if (parsed.event === 'pomodoro_controller_changed') {
        setState((prev) => ({ ...prev, pomodoro: parsed.payload }));
        return;
      }

      if (parsed.event === 'pomodoro_error') {
        setState((prev) => ({ ...prev, error: parsed.payload.message }));
        return;
      }

      if (parsed.event === 'stage_state') {
        setState((prev) => ({ ...prev, stage: parsed.payload }));
        return;
      }

      if (parsed.event === 'stage_changed') {
        setState((prev) => ({ ...prev, stage: parsed.payload }));
        return;
      }

      if (parsed.event === 'stage_error') {
        setState((prev) => ({ ...prev, error: parsed.payload.message }));
      }
    };

    socket.onerror = () => {
      setState((prev) => ({ ...prev, connected: false, error: 'Не удалось подключиться к виджетам комнаты.' }));
    };

    socket.onclose = () => {
      setState((prev) => ({ ...prev, connected: false }));
    };

    return () => {
      socketRef.current = null;
      socket.close();
    };
  }, [wsUrl]);

  const send = (message: WidgetsClientEvent) => {
    const socket = socketRef.current;
    if (!socket || socket.readyState !== WebSocket.OPEN) {
      setState((prev) => ({ ...prev, error: 'Соединение с комнатой ещё не установлено.' }));
      return;
    }
    socket.send(JSON.stringify(message));
  };

  const clearToast = () => setState((prev) => ({ ...prev, lastStartedToast: null }));
  const clearError = () => setState((prev) => ({ ...prev, error: '' }));

  return { state, send, clearToast, clearError };
}

