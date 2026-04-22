import { useEffect, useMemo, useState } from 'react';

import {
  createSessionTask,
  deleteSessionTask,
  listSessionParticipants,
  listSessionTasks,
  updateSessionTask,
  type CreateSessionTaskInput,
  type UpdateSessionTaskInput,
} from '../../api/sessionTasks';
import type { SessionParticipant, SessionTask } from '../../types';

function upsertTask(tasks: SessionTask[], nextTask: SessionTask) {
  const filtered = tasks.filter((task) => task.id !== nextTask.id);
  return [nextTask, ...filtered].sort((left, right) => right.id - left.id);
}

export function useSessionTasks(sessionId: number) {
  const [tasks, setTasks] = useState<SessionTask[]>([]);
  const [participants, setParticipants] = useState<SessionParticipant[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const wsUrl = useMemo(() => {
    const protocol = window.location.protocol === 'https:' ? 'wss' : 'ws';
    const token = localStorage.getItem('access_token');
    return `${protocol}://${window.location.host}/ws/sessions/${sessionId}/tasks?token=${token}`;
  }, [sessionId]);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError('');

    Promise.all([listSessionTasks(sessionId), listSessionParticipants(sessionId)])
      .then(([taskItems, participantItems]) => {
        if (cancelled) {
          return;
        }
        setTasks(taskItems);
        setParticipants(participantItems);
      })
      .catch((err: Error) => {
        if (!cancelled) {
          setError(err.message || 'Не удалось загрузить задачи видеосессии.');
        }
      })
      .finally(() => {
        if (!cancelled) {
          setLoading(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [sessionId]);

  useEffect(() => {
    const socket = new WebSocket(wsUrl);
    socket.onopen = () => setError('');
    socket.onmessage = (event) => {
      const parsed = JSON.parse(event.data);
      if (parsed?.event === 'task_created' || parsed?.event === 'task_updated') {
        setTasks((prev) => upsertTask(prev, parsed.payload as SessionTask));
      }
      if (parsed?.event === 'task_deleted') {
        setTasks((prev) => prev.filter((task) => task.id !== parsed.payload.id));
      }
    };
    socket.onerror = () => setError('Не удалось подключить обновления задач в реальном времени.');
    return () => socket.close();
  }, [wsUrl]);

  async function createTask(payload: Omit<CreateSessionTaskInput, 'room_id'>) {
    setError('');
    try {
      await createSessionTask({ room_id: sessionId, ...payload });
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Не удалось создать задачу.';
      setError(message);
      throw err;
    }
  }

  async function patchTask(taskId: number, payload: UpdateSessionTaskInput) {
    setError('');
    try {
      const updated = await updateSessionTask(taskId, payload);
      setTasks((prev) => upsertTask(prev, updated));
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Не удалось обновить задачу.';
      setError(message);
      throw err;
    }
  }

  async function removeTask(taskId: number) {
    setError('');
    try {
      await deleteSessionTask(taskId);
      setTasks((prev) => prev.filter((task) => task.id !== taskId));
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Не удалось удалить задачу.';
      setError(message);
      throw err;
    }
  }

  return {
    tasks,
    participants,
    loading,
    error,
    createTask,
    patchTask,
    removeTask,
  };
}
