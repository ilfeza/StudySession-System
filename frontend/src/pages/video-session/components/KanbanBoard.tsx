import { TaskPanel } from '../../../components/tasks/TaskPanel';
import type { ChatMessage } from '../../../types';

export function KanbanBoard({
  sessionId,
  openCreateKey,
  sessionTitle,
  sessionDescription,
  chatMessages,
}: {
  sessionId: number;
  openCreateKey?: number;
  sessionTitle?: string;
  sessionDescription?: string;
  chatMessages?: ChatMessage[];
}) {
  return (
    <TaskPanel
      sessionId={sessionId}
      fullscreen
      openCreateKey={openCreateKey}
      sessionTitle={sessionTitle}
      sessionDescription={sessionDescription}
      chatMessages={chatMessages}
    />
  );
}
