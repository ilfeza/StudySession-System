import { TaskPanel } from '../../../components/tasks/TaskPanel';
import type { SessionTasksController } from '../../../components/tasks/useSessionTasks';
import type { SessionNotification, SessionSuggestion } from '../sessionIntelligence';
import type { ChatMessage } from '../../../types';

export function KanbanBoard({
  sessionId,
  openCreateKey,
  sessionTitle,
  sessionDescription,
  chatMessages,
  controller,
  isModerator,
  liveParticipantNames,
  onNotify,
  onEngineSuggestionsChange,
}: {
  sessionId: number;
  openCreateKey?: number;
  sessionTitle?: string;
  sessionDescription?: string;
  chatMessages?: ChatMessage[];
  controller?: SessionTasksController;
  isModerator?: boolean;
  liveParticipantNames?: string[];
  onNotify?: (notification: SessionNotification) => void;
  onEngineSuggestionsChange?: (suggestions: SessionSuggestion[]) => void;
}) {
  return (
    <TaskPanel
      sessionId={sessionId}
      fullscreen
      openCreateKey={openCreateKey}
      sessionTitle={sessionTitle}
      sessionDescription={sessionDescription}
      chatMessages={chatMessages}
      controller={controller}
      isModerator={isModerator}
      liveParticipantNames={liveParticipantNames}
      onNotify={onNotify}
      onEngineSuggestionsChange={onEngineSuggestionsChange}
    />
  );
}
