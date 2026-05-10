import type { ChatMessage, SessionParticipant, SessionTask, SessionTaskStatus } from '../../types';

export type SuggestionAction = 'mark_done' | 'assign_sender' | 'mark_blocked' | 'reassign_task' | 'assign_next';

export interface SessionSuggestion {
  id: string;
  taskId: number | null;
  messageId?: number;
  senderId?: number;
  source: 'chat' | 'engine';
  action: SuggestionAction;
  title: string;
  description: string;
}

export interface SessionNotification {
  id: string;
  message: string;
  severity: 'success' | 'info' | 'warning';
}

export const taskStatusLabels: Record<SessionTaskStatus, string> = {
  backlog: 'Бэклог',
  assigned: 'Назначено',
  in_progress: 'В работе',
  blocked: 'Заблокировано',
  done: 'Готово',
};

export const priorityLabels: Record<SessionTask['priority'], string> = {
  low: 'Низкий',
  medium: 'Средний',
  high: 'Высокий',
  critical: 'Критичный',
};

export function getPriorityColor(priority: SessionTask['priority']) {
  if (priority === 'critical') {
    return '#dc2626';
  }
  if (priority === 'high') {
    return '#ea580c';
  }
  if (priority === 'low') {
    return '#475569';
  }
  return '#2563eb';
}

export function getTaskAgeMinutes(task: SessionTask) {
  return Math.max(0, Math.floor((Date.now() - new Date(task.created_at).getTime()) / 60000));
}

export function getActiveTaskCount(tasks: SessionTask[], participantId: number) {
  return tasks.filter((task) => task.assignee_id === participantId && task.status !== 'done').length;
}

export function chooseBestParticipant(tasks: SessionTask[], participants: SessionParticipant[], requiredSkills: string[] = []) {
  const eligible = participants.filter((participant) => participant.is_online);
  const pool = eligible.length ? eligible : participants;
  if (!pool.length) {
    return null;
  }

  const skillNeedles = requiredSkills.map((item) => item.trim().toLowerCase()).filter(Boolean);
  const scored = pool
    .map((participant) => {
      const workload = getActiveTaskCount(tasks, participant.id);
      const skillBonus = skillNeedles.length
        ? skillNeedles.some((skill) => participant.full_name.toLowerCase().includes(skill))
          ? -1
          : 0
        : 0;
      return { participant, workload, skillBonus };
    })
    .sort((left, right) => left.workload - right.workload || left.skillBonus - right.skillBonus || left.participant.full_name.localeCompare(right.participant.full_name));

  return scored[0]?.participant ?? null;
}

export function buildChatSuggestion(message: ChatMessage, tasks: SessionTask[]): SessionSuggestion | null {
  const text = message.message.trim().toLowerCase();
  if (!text) {
    return null;
  }

  const senderTask = [...tasks].find((task) => task.assignee_id === message.sender_id && task.status !== 'done');
  const backlogTask = [...tasks].find((task) => task.status === 'backlog' && task.assignee_id == null);

  if (/(i finished this|я закончил|я закончила|done|готово|завершил|завершила)/i.test(text) && senderTask) {
    return {
      id: `chat-done-${message.id}-${senderTask.id}`,
      taskId: senderTask.id,
      messageId: message.id,
      senderId: message.sender_id,
      source: 'chat',
      action: 'mark_done',
      title: 'Отметить задачу как завершенную?',
      description: `Подтвердить завершение задачи "${senderTask.title}".`,
    };
  }

  if (/(i'll take this|я возьму|беру это|take this)/i.test(text) && backlogTask) {
    return {
      id: `chat-assign-${message.id}-${backlogTask.id}`,
      taskId: backlogTask.id,
      messageId: message.id,
      senderId: message.sender_id,
      source: 'chat',
      action: 'assign_sender',
      title: 'Назначить автора сообщения?',
      description: `Назначить "${backlogTask.title}" автору сообщения.`,
    };
  }

  if (/(i can't finish|не могу закончить|need help|нужна помощь|blocked|застрял|застряла)/i.test(text) && senderTask) {
    return {
      id: `chat-blocked-${message.id}-${senderTask.id}`,
      taskId: senderTask.id,
      messageId: message.id,
      senderId: message.sender_id,
      source: 'chat',
      action: 'mark_blocked',
      title: 'Пометить как заблокированную',
      description: `Пометить "${senderTask.title}" как заблокированную и предложить помощь.`,
    };
  }

  return null;
}
