import { api } from './client';
import type { SessionSummary, SessionSummaryHistoryItem, SessionTaskStatus } from '../types';

export interface SessionSummaryTaskPayload {
  task_id?: number | null;
  status_at_summary: SessionTaskStatus;
  sort_order: number;
}

export interface SessionSummaryUpsertPayload {
  completed_work: string;
  next_steps: string;
  short_description: string;
  status?: 'draft' | 'completed';
  tasks: SessionSummaryTaskPayload[];
}

export async function getSessionSummary(sessionId: number) {
  const response = await api.get<SessionSummary>(`/sessions/${sessionId}/summary`);
  return response.data;
}

export async function saveSessionSummary(sessionId: number, payload: SessionSummaryUpsertPayload) {
  const response = await api.post<SessionSummary>(`/sessions/${sessionId}/summary`, payload);
  return response.data;
}

export async function updateSessionSummary(sessionId: number, payload: SessionSummaryUpsertPayload) {
  const response = await api.patch<SessionSummary>(`/sessions/${sessionId}/summary`, payload);
  return response.data;
}

export async function skipSessionSummary(sessionId: number, remindAt?: string | null) {
  const response = await api.post<SessionSummary>(`/sessions/${sessionId}/summary/skip`, {
    remind_at: remindAt ?? null,
  });
  return response.data;
}

export async function listGroupSessionHistory(groupId: number) {
  const response = await api.get<SessionSummaryHistoryItem[]>(`/groups/${groupId}/history`);
  return response.data;
}
