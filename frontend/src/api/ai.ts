import { api } from './client';
import type { AiTaskSuggestion, ChatMessage } from '../types';

interface GenerateTasksInput {
  roomId: number;
  roomTitle: string;
  description?: string;
  messages: ChatMessage[];
}

export async function generateAiTasks(payload: GenerateTasksInput) {
  const response = await api.post<AiTaskSuggestion[]>('/ai/generate-tasks', {
    roomId: payload.roomId,
    roomTitle: payload.roomTitle,
    description: payload.description ?? '',
    messages: payload.messages.map((message) => ({
      senderName: message.sender_name,
      message: message.message,
    })),
  });
  return response.data;
}
