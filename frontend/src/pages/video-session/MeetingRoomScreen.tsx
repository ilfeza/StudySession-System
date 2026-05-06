import ArrowBackRoundedIcon from '@mui/icons-material/ArrowBackRounded';
import GroupsRoundedIcon from '@mui/icons-material/GroupsRounded';
import NotificationsRoundedIcon from '@mui/icons-material/NotificationsRounded';
import TuneRoundedIcon from '@mui/icons-material/TuneRounded';
import { Alert, Avatar, Badge, Box, Button, Drawer, IconButton, Menu, MenuItem, Paper, Snackbar, Stack, Typography } from '@mui/material';
import { alpha } from '@mui/material/styles';
import { useParticipants } from '@livekit/components-react';
import { useEffect, useMemo, useState } from 'react';
import type { AudioCaptureOptions, VideoCaptureOptions } from 'livekit-client';

import { api } from '../../api/client';
import { ChatPanel } from '../../components/ChatPanel';
import { useSessionTasks } from '../../components/tasks/useSessionTasks';
import { formatMMSS } from '../../components/widgets/pomodoroTime';
import { useWidgetsSocket } from '../../components/widgets/useWidgetsSocket';
import type { ChatMessage, VideoSessionRoom } from '../../types';
import type { SessionStage } from '../../types/pomodoro';
import { chooseBestParticipant, type SessionNotification, type SessionSuggestion } from './sessionIntelligence';
import { KanbanBoard } from './components/KanbanBoard';
import { TopTabs, type SessionView } from './components/TopTabs';
import { VideoControls } from './components/VideoControls';
import { VideoGrid } from './components/VideoGrid';
import { formatRoomName } from './utils';

const stageLabels: Record<SessionStage, string> = {
  discussion: 'Обсуждение',
  work: 'Работа',
  summary: 'Итоги',
};

const stageOrder: SessionStage[] = ['discussion', 'work', 'summary'];

function getStageTone(stage: SessionStage | null) {
  if (stage === 'discussion') {
    return { background: '#eff6ff', color: '#1d4ed8' };
  }
  if (stage === 'work') {
    return { background: '#ecfdf5', color: '#047857' };
  }
  if (stage === 'summary') {
    return { background: '#fff7ed', color: '#c2410c' };
  }
  return { background: '#f8fafc', color: '#475569' };
}

function ParticipantsDrawer({
  open,
  onClose,
}: {
  open: boolean;
  onClose: () => void;
}) {
  const participants = useParticipants();

  return (
    <Drawer
      anchor="right"
      open={open}
      onClose={onClose}
      PaperProps={{
        sx: {
          width: '100%',
          maxWidth: 360,
          p: 2,
          backgroundColor: '#ffffff',
        },
      }}
    >
      <Stack spacing={2}>
        <Box>
          <Typography variant="h6">Участники</Typography>
          <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
            {participants.length} в комнате
          </Typography>
        </Box>

        <Stack spacing={1}>
          {participants.map((participant) => {
            const displayName = participant.name?.trim() || `Участник ${participant.identity}`;
            return (
              <Paper key={participant.identity} sx={{ p: 1.5, borderRadius: 3 }}>
                <Stack direction="row" spacing={1.25} alignItems="center">
                  <Avatar sx={{ bgcolor: '#e2e8f0', color: '#0f172a' }}>
                    {displayName.slice(0, 1).toUpperCase()}
                  </Avatar>
                  <Box sx={{ minWidth: 0 }}>
                    <Typography variant="subtitle2" noWrap>{displayName}</Typography>
                    <Typography variant="caption" color="text.secondary">
                      {participant.isLocal ? 'Вы' : 'В эфире'}
                    </Typography>
                  </Box>
                </Stack>
              </Paper>
            );
          })}
        </Stack>
      </Stack>
    </Drawer>
  );
}

export function MeetingRoomScreen({
  sessionId,
  roomName,
  participantName,
  canControlStage,
  onBack,
  mediaWarning,
  onDismissMediaWarning,
  microphoneCaptureOptions,
  cameraCaptureOptions,
  onTrackDeviceError,
}: {
  sessionId: number;
  roomName: string;
  participantName: string;
  canControlStage: boolean;
  onBack: () => void;
  mediaWarning: string;
  onDismissMediaWarning: () => void;
  microphoneCaptureOptions: AudioCaptureOptions;
  cameraCaptureOptions: VideoCaptureOptions;
  onTrackDeviceError: (message: string) => void;
}) {
  const participants = useParticipants();
  const taskController = useSessionTasks(sessionId);
  const [activeView, setActiveView] = useState<SessionView>('board');
  const [participantsOpen, setParticipantsOpen] = useState(false);
  const [controlsOpen, setControlsOpen] = useState(false);
  const [notificationsAnchor, setNotificationsAnchor] = useState<HTMLElement | null>(null);
  const [sessionRoom, setSessionRoom] = useState<VideoSessionRoom | null>(null);
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([]);
  const [taskCreateKey, setTaskCreateKey] = useState(0);
  const [nowMs, setNowMs] = useState(() => Date.now());
  const [serverOffsetMs, setServerOffsetMs] = useState<number | null>(null);
  const [suggestions, setSuggestions] = useState<SessionSuggestion[]>([]);
  const [notifications, setNotifications] = useState<SessionNotification[]>([]);
  const { state: widgetsState, send: sendWidgetEvent, clearToast } = useWidgetsSocket(sessionId);

  useEffect(() => {
    const id = window.setInterval(() => setNowMs(Date.now()), 250);
    return () => window.clearInterval(id);
  }, []);

  useEffect(() => {
    api.get<VideoSessionRoom>(`/sessions/${sessionId}`).then((response) => setSessionRoom(response.data)).catch(() => null);
    api.get<ChatMessage[]>(`/chat/history/${sessionId}`).then((response) => setChatMessages(response.data)).catch(() => null);
  }, [sessionId]);

  useEffect(() => {
    const serverTimeMs = widgetsState.stage?.timing.server_time_ms;
    if (serverTimeMs) {
      setServerOffsetMs(Date.now() - serverTimeMs);
    }
  }, [widgetsState.stage?.timing.server_time_ms]);

  const stage = widgetsState.stage?.current_stage ?? null;
  const stageTone = getStageTone(stage);

  const stageElapsed = useMemo(() => {
    const snapshot = widgetsState.stage;
    if (!snapshot) {
      return null;
    }
    const offset = serverOffsetMs ?? 0;
    const serverNow = nowMs - offset;
    return Math.max(0, Math.floor((serverNow - snapshot.timing.stage_started_at_ms) / 1000));
  }, [nowMs, serverOffsetMs, widgetsState.stage]);

  const liveParticipantNames = useMemo(
    () => participants.map((participant) => participant.name?.trim().toLowerCase()).filter(Boolean) as string[],
    [participants],
  );

  function pushNotification(notification: SessionNotification) {
    setNotifications((prev) => [...prev.filter((item) => item.id !== notification.id), notification].slice(-8));
  }

  function handleSuggestionCreate(suggestion: SessionSuggestion) {
    setSuggestions((prev) => (prev.some((item) => item.id === suggestion.id) ? prev : [...prev, suggestion].slice(-10)));
  }

  async function handleSuggestionApply(suggestion: SessionSuggestion) {
    const task = taskController.tasks.find((item) => item.id === suggestion.taskId);
    if (suggestion.action === 'mark_done' && suggestion.taskId != null) {
      await taskController.patchTask(suggestion.taskId, { status: 'done' });
      pushNotification({ id: `done-${suggestion.id}`, message: `Task marked done: ${task?.title ?? ''}`, severity: 'success' });
    }

    if (suggestion.action === 'assign_sender' && suggestion.taskId != null && suggestion.senderId != null) {
      await taskController.patchTask(suggestion.taskId, { assignee_id: suggestion.senderId, status: 'in_progress' });
      pushNotification({ id: `assign-${suggestion.id}`, message: `Task taken from chat: ${task?.title ?? ''}`, severity: 'success' });
    }

    if (suggestion.action === 'mark_blocked' && suggestion.taskId != null) {
      await taskController.patchTask(suggestion.taskId, { status: 'blocked' });
      pushNotification({ id: `blocked-${suggestion.id}`, message: `Task blocked: ${task?.title ?? ''}`, severity: 'warning' });
    }

    if ((suggestion.action === 'reassign_task' || suggestion.action === 'assign_next') && suggestion.taskId != null) {
      const participant = chooseBestParticipant(taskController.tasks, taskController.participants, task?.required_skills ?? []);
      if (participant) {
        await taskController.patchTask(suggestion.taskId, { assignee_id: participant.id, status: 'todo' });
        pushNotification({ id: `reassign-${suggestion.id}`, message: `Task reassigned to ${participant.full_name}`, severity: 'success' });
      }
    }

    setSuggestions((prev) => prev.filter((item) => item.id !== suggestion.id));
  }

  function handleStageChange(nextStage: SessionStage) {
    sendWidgetEvent({ event: 'stage_set', payload: { stage: nextStage } });
    pushNotification({ id: `stage-${nextStage}-${Date.now()}`, message: `Session phase: ${stageLabels[nextStage]}`, severity: 'info' });
  }

  function handleNextStage() {
    const currentIndex = stage ? stageOrder.indexOf(stage) : -1;
    const nextStage = stageOrder[Math.min(currentIndex + 1, stageOrder.length - 1)];
    handleStageChange(nextStage);
  }

  async function handleReassignAll() {
    const candidates = taskController.tasks.filter((task) => task.status !== 'done' && (task.assignee_id == null || task.status === 'needs_reassignment'));
    for (const task of candidates) {
      const participant = chooseBestParticipant(taskController.tasks, taskController.participants, task.required_skills);
      if (participant) {
        await taskController.patchTask(task.id, { assignee_id: participant.id, status: 'todo' });
      }
    }
    pushNotification({ id: `all-${Date.now()}`, message: 'All available tasks reassigned', severity: 'success' });
  }

  return (
    <Box sx={{ minHeight: '100vh', backgroundColor: '#f8fafc', px: { xs: 2, md: 3 }, py: { xs: 2, md: 3 } }}>
      <Stack spacing={2}>
        {mediaWarning ? (
          <Alert severity="warning" onClose={onDismissMediaWarning}>
            {mediaWarning}
          </Alert>
        ) : null}

        <Paper sx={{ p: { xs: 2, md: 2.5 }, borderRadius: 4, boxShadow: '0 20px 50px rgba(15, 23, 42, 0.05)' }}>
          <Stack spacing={2}>
            <Stack direction={{ xs: 'column', lg: 'row' }} justifyContent="space-between" spacing={1.5} alignItems={{ xs: 'stretch', lg: 'center' }}>
              <Stack spacing={1}>
                <Button onClick={onBack} startIcon={<ArrowBackRoundedIcon />} sx={{ alignSelf: 'flex-start', px: 0, minHeight: 0 }}>
                  Вернуться
                </Button>
                <Box>
                  <Typography variant="h5">{sessionRoom?.title || formatRoomName(roomName)}</Typography>
                  <Stack direction="row" spacing={1} useFlexGap flexWrap="wrap" sx={{ mt: 1 }}>
                    <Typography variant="caption" sx={{ px: 1.25, py: 0.5, borderRadius: 999, bgcolor: stageTone.background, color: stageTone.color }}>
                      {stage ? stageLabels[stage] : 'Этап не выбран'}
                    </Typography>
                    {stageElapsed !== null ? (
                      <Typography variant="caption" sx={{ px: 1.25, py: 0.5, borderRadius: 999, bgcolor: '#ffffff', color: 'text.secondary', border: '1px solid #e5e7eb' }}>
                        {formatMMSS(stageElapsed)}
                      </Typography>
                    ) : null}
                    <Typography variant="caption" sx={{ px: 1.25, py: 0.5, borderRadius: 999, bgcolor: '#ffffff', color: 'text.secondary', border: '1px solid #e5e7eb' }}>
                      {participantName}
                    </Typography>
                  </Stack>
                </Box>
              </Stack>

              <Stack direction={{ xs: 'column', md: 'row' }} spacing={1} alignItems={{ xs: 'stretch', md: 'center' }}>
                <TopTabs value={activeView} onChange={setActiveView} />
                <Stack direction="row" spacing={0.5}>
                  <IconButton onClick={() => setParticipantsOpen(true)} sx={{ border: '1px solid #e5e7eb', bgcolor: '#ffffff' }}>
                    <GroupsRoundedIcon fontSize="small" />
                  </IconButton>
                  <IconButton onClick={(event) => setNotificationsAnchor(event.currentTarget)} sx={{ border: '1px solid #e5e7eb', bgcolor: '#ffffff' }}>
                    <Badge color="primary" variant="dot" invisible={!notifications.length}>
                      <NotificationsRoundedIcon fontSize="small" />
                    </Badge>
                  </IconButton>
                  <Button variant="outlined" startIcon={<TuneRoundedIcon />} onClick={() => setControlsOpen(true)}>
                    Session controls
                  </Button>
                </Stack>
              </Stack>
            </Stack>

            {activeView === 'board' ? (
              <Box sx={{ minHeight: 'calc(100vh - 230px)' }}>
                <KanbanBoard
                  sessionId={sessionId}
                  openCreateKey={taskCreateKey}
                  sessionTitle={sessionRoom?.title ?? formatRoomName(roomName)}
                  sessionDescription={sessionRoom?.description ?? ''}
                  chatMessages={chatMessages}
                  controller={taskController}
                  isModerator={canControlStage}
                  liveParticipantNames={liveParticipantNames}
                  onNotify={pushNotification}
                  onEngineSuggestionsChange={(items) => items.forEach(handleSuggestionCreate)}
                />
              </Box>
            ) : null}

            {activeView === 'video' ? (
              <Paper
                sx={{
                  position: 'relative',
                  minHeight: { xs: 460, md: 'calc(100vh - 250px)' },
                  overflow: 'hidden',
                  borderRadius: 5,
                  background: 'linear-gradient(180deg, #f8fafc 0%, #eef2f7 100%)',
                }}
              >
                <VideoGrid />
                <Box
                  sx={{
                    position: 'absolute',
                    left: { xs: 16, md: 24 },
                    top: { xs: 16, md: 24 },
                    p: 1.5,
                    borderRadius: 3,
                    backgroundColor: alpha('#ffffff', 0.9),
                    backdropFilter: 'blur(12px)',
                    boxShadow: '0 14px 36px rgba(15, 23, 42, 0.08)',
                  }}
                >
                  <Typography variant="subtitle2">Комната</Typography>
                  <Typography variant="body2" color="text.secondary">
                    {sessionRoom?.title || formatRoomName(roomName)}
                  </Typography>
                </Box>
                <VideoControls
                  microphoneCaptureOptions={microphoneCaptureOptions}
                  cameraCaptureOptions={cameraCaptureOptions}
                  onTrackDeviceError={onTrackDeviceError}
                  onParticipantsClick={() => setParticipantsOpen(true)}
                  onChatClick={() => setActiveView('chat')}
                />
              </Paper>
            ) : null}

            {activeView === 'chat' ? (
              <Paper sx={{ p: 2, borderRadius: 4, minHeight: 'calc(100vh - 230px)' }}>
                <ChatPanel
                  sessionId={sessionId}
                  variant="session"
                  tasks={taskController.tasks}
                  isModerator={canControlStage}
                  messages={chatMessages}
                  onMessagesChange={setChatMessages}
                  onSuggestionCreate={handleSuggestionCreate}
                  onSuggestionApply={(suggestion) => void handleSuggestionApply(suggestion)}
                />
              </Paper>
            ) : null}
          </Stack>
        </Paper>

        <ParticipantsDrawer open={participantsOpen} onClose={() => setParticipantsOpen(false)} />

        <Drawer
          anchor="right"
          open={controlsOpen}
          onClose={() => setControlsOpen(false)}
          PaperProps={{ sx: { width: '100%', maxWidth: 380, p: 2.5, backgroundColor: '#ffffff' } }}
        >
          <Stack spacing={2}>
            <Box>
              <Typography variant="h6">Session controls</Typography>
              <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
                Вторичные действия скрыты здесь, чтобы не мешать работе с доской.
              </Typography>
            </Box>

            <Stack spacing={1}>
              <Button variant="contained" onClick={() => handleStageChange(stage ?? 'discussion')} disabled={!canControlStage}>
                Start phase
              </Button>
              <Button variant="outlined" onClick={handleNextStage} disabled={!canControlStage}>
                Next phase
              </Button>
              <Button variant="outlined" onClick={() => void handleReassignAll()} disabled={!canControlStage}>
                Reassign all
              </Button>
              <Button variant="contained" onClick={() => suggestions.forEach((item) => void handleSuggestionApply(item))} disabled={!canControlStage || !suggestions.length}>
                Confirm AI changes
              </Button>
              <Button variant="outlined" onClick={() => { setTaskCreateKey((prev) => prev + 1); setActiveView('board'); }}>
                Новая задача
              </Button>
            </Stack>

            <Stack spacing={1}>
              <Typography variant="subtitle2">AI suggestions</Typography>
              {suggestions.length ? suggestions.map((suggestion) => (
                <MenuItem key={suggestion.id} onClick={() => void handleSuggestionApply(suggestion)} sx={{ border: '1px solid #e5e7eb', borderRadius: 2, whiteSpace: 'normal', alignItems: 'flex-start' }}>
                  <Box>
                    <Typography variant="body2" fontWeight={600}>{suggestion.title}</Typography>
                    <Typography variant="caption" color="text.secondary">{suggestion.description}</Typography>
                  </Box>
                </MenuItem>
              )) : (
                <Typography variant="body2" color="text.secondary">
                  AI suggestions will appear here.
                </Typography>
              )}
            </Stack>
          </Stack>
        </Drawer>

        <Menu anchorEl={notificationsAnchor} open={Boolean(notificationsAnchor)} onClose={() => setNotificationsAnchor(null)}>
          {notifications.length ? notifications.slice().reverse().map((notification) => (
            <MenuItem key={notification.id} onClick={() => setNotificationsAnchor(null)}>
              {notification.message}
            </MenuItem>
          )) : (
            <MenuItem disabled>Уведомлений пока нет</MenuItem>
          )}
        </Menu>

        <Snackbar open={Boolean(widgetsState.lastStartedToast)} autoHideDuration={4500} onClose={clearToast} anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}>
          <Alert severity="success" variant="filled" onClose={clearToast} sx={{ fontWeight: 700 }}>
            {widgetsState.lastStartedToast?.last_started_by?.name
              ? `${widgetsState.lastStartedToast.last_started_by.name} включил Pomodoro`
              : 'Pomodoro включён'}
          </Alert>
        </Snackbar>
      </Stack>
    </Box>
  );
}
