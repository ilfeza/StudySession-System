import { useEffect, useMemo, useState } from 'react';

import {
  createSessionTask,
  deleteSessionTask,
  getSessionDashboard,
  listSessionParticipants,
  listSessionTasks,
  updateSessionTask,
  type CreateSessionTaskInput,
  type UpdateSessionTaskInput,
} from '../../api/sessionTasks';
import type { SessionDashboardSnapshot, SessionParticipant, SessionTask } from '../../types';

function upsertTask(tasks: SessionTask[], nextTask: SessionTask) {
  const filtered = tasks.filter((task) => task.id !== nextTask.id);
  return [nextTask, ...filtered].sort((left, right) => right.id - left.id);
}

export function useSessionTasks(sessionId: number) {
  const [tasks, setTasks] = useState<SessionTask[]>([]);
  const [participants, setParticipants] = useState<SessionParticipant[]>([]);
  const [dashboard, setDashboard] = useState<SessionDashboardSnapshot | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const wsUrl = useMemo(() => {
    const protocol = window.location.protocol === 'https:' ? 'wss' : 'ws';
    const token = localStorage.getItem('access_token');
    return `${protocol}://${window.location.host}/ws/sessions/${sessionId}/tasks?token=${token}`;
  }, [sessionId]);

  async function refreshParticipants() {
    const items = await listSessionParticipants(sessionId);
    setParticipants(items);
    return items;
  }

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError('');

    Promise.all([listSessionTasks(sessionId), listSessionParticipants(sessionId), getSessionDashboard(sessionId)])
      .then(([taskItems, participantItems, dashboardSnapshot]) => {
        if (cancelled) {
          return;
        }
        setTasks(taskItems);
        setParticipants(participantItems);
        setDashboard(dashboardSnapshot);
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
        void getSessionDashboard(sessionId).then(setDashboard).catch(() => null);
      }
      if (parsed?.event === 'task_deleted') {
        setTasks((prev) => prev.filter((task) => task.id !== parsed.payload.id));
        void getSessionDashboard(sessionId).then(setDashboard).catch(() => null);
      }
    };
    socket.onerror = () => setError('Не удалось подключить обновления задач в реальном времени.');
    return () => socket.close();
  }, [wsUrl]);

  async function createTask(payload: Omit<CreateSessionTaskInput, 'room_id'>) {
    setError('');
    try {
      await createSessionTask({ room_id: sessionId, ...payload });
      await Promise.all([listSessionTasks(sessionId), getSessionDashboard(sessionId)]).then(([taskItems, dashboardSnapshot]) => {
        setTasks(taskItems);
        setDashboard(dashboardSnapshot);
      });
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
      void getSessionDashboard(sessionId).then(setDashboard).catch(() => null);
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
      void getSessionDashboard(sessionId).then(setDashboard).catch(() => null);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Не удалось удалить задачу.';
      setError(message);
      throw err;
    }
  }

  return {
    tasks,
    participants,
    dashboard,
    loading,
    error,
    createTask,
    patchTask,
    removeTask,
    refreshParticipants,
  };
}

export type SessionTasksController = ReturnType<typeof useSessionTasks>;
