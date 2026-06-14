import { api } from './client';
import type { SessionDashboardSnapshot, SessionParticipant, SessionTask, SessionTaskStatus } from '../types';

export interface CreateSessionTaskInput {
  room_id: number;
  title: string;
  description?: string;
  assignee_id?: number | null;
  deadline?: string | null;
  status?: SessionTaskStatus;
  priority?: 'low' | 'medium' | 'high' | 'critical';
  required_skills?: string[];
}

export interface UpdateSessionTaskInput {
  title?: string;
  description?: string;
  assignee_id?: number | null;
  deadline?: string | null;
  status?: SessionTaskStatus;
  priority?: 'low' | 'medium' | 'high' | 'critical';
  required_skills?: string[];
}

export async function listSessionTasks(roomId: number) {
  const response = await api.get<SessionTask[]>('/tasks', { params: { roomId } });
  return response.data;
}

export async function createSessionTask(payload: CreateSessionTaskInput) {
  const response = await api.post<SessionTask>('/tasks', payload);
  return response.data;
}

export async function updateSessionTask(taskId: number, payload: UpdateSessionTaskInput) {
  const response = await api.patch<SessionTask>(`/tasks/${taskId}`, payload);
  return response.data;
}

export async function deleteSessionTask(taskId: number) {
  await api.delete(`/tasks/${taskId}`);
}

export async function listSessionParticipants(sessionId: number) {
  const response = await api.get<SessionParticipant[]>(`/sessions/${sessionId}/participants`);
  return response.data;
}

export async function getSessionDashboard(sessionId: number) {
  const response = await api.get<SessionDashboardSnapshot>(`/sessions/${sessionId}/dashboard`);
  return response.data;
}

export async function assignNextSessionTask(sessionId: number, preferredUserId?: number | null) {
  const response = await api.post<SessionTask | null>('/tasks/next', null, {
    params: { roomId: sessionId, ...(preferredUserId ? { preferredUserId } : {}) },
  });
  return response.data;
}

export async function skipSessionTask(taskId: number) {
  const response = await api.post<SessionTask>(`/tasks/${taskId}/skip`);
  return response.data;
}

export async function blockSessionParticipant(sessionId: number, userId: number) {
  await api.post(`/sessions/${sessionId}/participants/${userId}/block`);
}
