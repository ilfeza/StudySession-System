import ArrowBackRoundedIcon from '@mui/icons-material/ArrowBackRounded';
import ChevronRightRoundedIcon from '@mui/icons-material/ChevronRightRounded';
import CloseRoundedIcon from '@mui/icons-material/CloseRounded';
import ForumRoundedIcon from '@mui/icons-material/ForumRounded';
import GroupsRoundedIcon from '@mui/icons-material/GroupsRounded';
import NotificationsRoundedIcon from '@mui/icons-material/NotificationsRounded';
import TuneRoundedIcon from '@mui/icons-material/TuneRounded';
import { Alert, Avatar, Badge, Box, Button, Divider, Drawer, IconButton, Menu, MenuItem, Paper, Snackbar, Stack, Typography, useMediaQuery } from '@mui/material';
import { alpha, useTheme } from '@mui/material/styles';
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

const SHELL_PADDING = '16px';
const SHELL_GAP = '16px';
const OUTER_RADIUS = '28px';
const HEADER_RADIUS = '20px';
const INNER_RADIUS = '20px';
const CARD_RADIUS = '16px';
const HEADER_CONTROL_HEIGHT = '44px';
const HEADER_ICON_SIZE = '44px';
const CHAT_PANEL_WIDTH = 320;

const stageLabels: Record<SessionStage, string> = {
  discussion: 'Обсуждение',
  work: 'Работа',
  summary: 'Итоги',
};

const stageOrder: SessionStage[] = ['discussion', 'work', 'summary'];

const headerControlSx = {
  height: HEADER_CONTROL_HEIGHT,
  minHeight: HEADER_CONTROL_HEIGHT,
  px: '16px',
  py: 0,
  borderRadius: '12px',
  boxSizing: 'border-box',
  flexShrink: 0,
  display: 'inline-flex',
  alignItems: 'center',
  justifyContent: 'center',
  gap: '8px',
} as const;

const headerIconButtonSx = {
  width: HEADER_ICON_SIZE,
  height: HEADER_ICON_SIZE,
  borderRadius: '12px',
  border: '1px solid #e5e7eb',
  bgcolor: '#ffffff',
  boxSizing: 'border-box',
  flexShrink: 0,
} as const;

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
              <Paper key={participant.identity} sx={{ p: 1.5, borderRadius: CARD_RADIUS }}>
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

function InlineChatSidebar({
  sessionId,
  open,
  mobile,
  canControlStage,
  messages,
  onMessagesChange,
  tasks,
  onClose,
  onSuggestionCreate,
  onSuggestionApply,
}: {
  sessionId: number;
  open: boolean;
  mobile: boolean;
  canControlStage: boolean;
  messages: ChatMessage[];
  onMessagesChange: (messages: ChatMessage[]) => void;
  tasks: ReturnType<typeof useSessionTasks>['tasks'];
  onClose: () => void;
  onSuggestionCreate: (suggestion: SessionSuggestion) => void;
  onSuggestionApply: (suggestion: SessionSuggestion) => void;
}) {
  if (!open) {
    return null;
  }

  const content = (
    <Paper
      sx={{
        width: '100%',
        display: 'flex',
        flexDirection: 'column',
        minHeight: 0,
        height: '100%',
        borderRadius: INNER_RADIUS,
        backgroundColor: alpha('#fcfcfd', 0.96),
        backdropFilter: 'blur(16px)',
        border: '1px solid rgba(148, 163, 184, 0.18)',
        boxShadow: '0 18px 46px rgba(15, 23, 42, 0.14)',
        overflow: 'hidden',
        boxSizing: 'border-box',
      }}
    >
      <Stack
        direction="row"
        alignItems="center"
        justifyContent="space-between"
        sx={{ px: '16px', py: '12px', minHeight: '68px', boxSizing: 'border-box' }}
      >
        <Box sx={{ minWidth: 0 }}>
          <Typography variant="subtitle1" fontWeight={700}>Чат</Typography>
          <Typography variant="caption" color="text.secondary">Сообщения прямо внутри звонка</Typography>
        </Box>
        <IconButton onClick={onClose} aria-label="Закрыть чат" sx={{ ...headerIconButtonSx, width: 40, height: 40 }}>
          <CloseRoundedIcon fontSize="small" />
        </IconButton>
      </Stack>
      <Divider />
      <Box sx={{ flex: 1, minHeight: 0, p: '16px', boxSizing: 'border-box' }}>
        <ChatPanel
          sessionId={sessionId}
          variant="session"
          showHeader={false}
          tasks={tasks}
          isModerator={canControlStage}
          messages={messages}
          onMessagesChange={onMessagesChange}
          onSuggestionCreate={onSuggestionCreate}
          onSuggestionApply={(suggestion) => onSuggestionApply(suggestion)}
        />
      </Box>
    </Paper>
  );

  if (mobile) {
    return (
      <Drawer
        anchor="right"
        open={open}
        onClose={onClose}
        PaperProps={{
          sx: {
            width: 'min(100vw - 16px, 360px)',
            m: '8px',
            height: 'calc(100% - 16px)',
            borderRadius: INNER_RADIUS,
            backgroundColor: 'transparent',
            boxShadow: 'none',
            overflow: 'visible',
          },
        }}
      >
        {content}
      </Drawer>
    );
  }

  return (
    <Box
      sx={{
        width: `${CHAT_PANEL_WIDTH}px`,
        flexShrink: 0,
        minHeight: 0,
        height: '100%',
        alignSelf: 'stretch',
      }}
    >
      {content}
    </Box>
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
  const theme = useTheme();
  const isMobileLayout = useMediaQuery(theme.breakpoints.down('lg'));
  const participants = useParticipants();
  const taskController = useSessionTasks(sessionId);
  const [activeView, setActiveView] = useState<SessionView>('video');
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
  const [chatOpen, setChatOpen] = useState(false);
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

  useEffect(() => {
    if (activeView !== 'video') {
      setChatOpen(false);
    }
  }, [activeView]);

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
      pushNotification({ id: `done-${suggestion.id}`, message: `Задача завершена: ${task?.title ?? ''}`, severity: 'success' });
    }

    if (suggestion.action === 'assign_sender' && suggestion.taskId != null && suggestion.senderId != null) {
      await taskController.patchTask(suggestion.taskId, { assignee_id: suggestion.senderId, status: 'in_progress' });
      pushNotification({ id: `assign-${suggestion.id}`, message: `Задача взята из чата: ${task?.title ?? ''}`, severity: 'success' });
    }

    if (suggestion.action === 'mark_blocked' && suggestion.taskId != null) {
      await taskController.patchTask(suggestion.taskId, { status: 'blocked' });
      pushNotification({ id: `blocked-${suggestion.id}`, message: `Задача заблокирована: ${task?.title ?? ''}`, severity: 'warning' });
    }

    if ((suggestion.action === 'reassign_task' || suggestion.action === 'assign_next') && suggestion.taskId != null) {
      const participant = chooseBestParticipant(taskController.tasks, taskController.participants, task?.required_skills ?? []);
      if (participant) {
        await taskController.patchTask(suggestion.taskId, { assignee_id: participant.id, status: 'todo' });
        pushNotification({ id: `reassign-${suggestion.id}`, message: `Задача переназначена: ${participant.full_name}`, severity: 'success' });
      }
    }

    setSuggestions((prev) => prev.filter((item) => item.id !== suggestion.id));
  }

  function handleStageChange(nextStage: SessionStage) {
    sendWidgetEvent({ event: 'stage_set', payload: { stage: nextStage } });
    pushNotification({ id: `stage-${nextStage}-${Date.now()}`, message: `Этап сессии: ${stageLabels[nextStage]}`, severity: 'info' });
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
    pushNotification({ id: `all-${Date.now()}`, message: 'Все доступные задачи переназначены', severity: 'success' });
  }

  return (
    <Box
      sx={{
        height: '100vh',
        width: '100vw',
        overflow: 'hidden',
        display: 'flex',
        flexDirection: 'column',
        background: 'linear-gradient(180deg, #eef2f7 0%, #f8fafc 100%)',
        boxSizing: 'border-box',
      }}
    >
      <Box sx={{ flex: 1, minHeight: 0, p: SHELL_PADDING, overflow: 'hidden', boxSizing: 'border-box' }}>
        <Paper
          sx={{
            height: '100%',
            display: 'flex',
            flexDirection: 'column',
            minHeight: 0,
            overflow: 'hidden',
            p: '8px',
            borderRadius: OUTER_RADIUS,
            boxShadow: '0 20px 60px rgba(15, 23, 42, 0.08)',
            backgroundColor: alpha('#ffffff', 0.86),
            backdropFilter: 'blur(18px)',
            boxSizing: 'border-box',
          }}
        >
          <Stack spacing={SHELL_GAP} sx={{ minHeight: 0, height: '100%' }}>
            {mediaWarning ? (
              <Alert severity="warning" onClose={onDismissMediaWarning} sx={{ borderRadius: CARD_RADIUS }}>
                {mediaWarning}
              </Alert>
            ) : null}

            <Paper
              sx={{
                px: '16px',
                py: '12px',
                borderRadius: HEADER_RADIUS,
                backgroundColor: alpha('#ffffff', 0.88),
                boxShadow: '0 8px 24px rgba(15, 23, 42, 0.06)',
                boxSizing: 'border-box',
              }}
            >
              <Stack direction={{ xs: 'column', lg: 'row' }} justifyContent="space-between" spacing="16px" alignItems={{ xs: 'stretch', lg: 'center' }}>
                <Stack direction="row" spacing="16px" alignItems="center" sx={{ minWidth: 0, flex: 1 }}>
                  <Button onClick={onBack} startIcon={<ArrowBackRoundedIcon />} sx={headerControlSx}>
                    Назад
                  </Button>
                  <Box sx={{ minWidth: 0 }}>
                    <Typography variant="h5" noWrap>{sessionRoom?.title || formatRoomName(roomName)}</Typography>
                    <Stack direction="row" spacing="8px" useFlexGap flexWrap="wrap" sx={{ mt: '8px', alignItems: 'center' }}>
                      <Typography variant="caption" sx={{ px: '10px', py: '4px', borderRadius: '999px', bgcolor: stageTone.background, color: stageTone.color }}>
                        {stage ? stageLabels[stage] : 'Этап не выбран'}
                      </Typography>
                      {stageElapsed !== null ? (
                        <Typography variant="caption" sx={{ px: '10px', py: '4px', borderRadius: '999px', bgcolor: '#ffffff', color: 'text.secondary', border: '1px solid #e5e7eb' }}>
                          {formatMMSS(stageElapsed)}
                        </Typography>
                      ) : null}
                      <Typography variant="caption" sx={{ px: '10px', py: '4px', borderRadius: '999px', bgcolor: '#ffffff', color: 'text.secondary', border: '1px solid #e5e7eb' }}>
                        {participantName}
                      </Typography>
                      <Typography variant="caption" sx={{ px: '10px', py: '4px', borderRadius: '999px', bgcolor: '#ffffff', color: 'text.secondary', border: '1px solid #e5e7eb' }}>
                        {participants.length} участников
                      </Typography>
                    </Stack>
                  </Box>
                </Stack>

                <Stack direction="row" spacing="8px" alignItems="center" useFlexGap flexWrap="wrap" justifyContent={{ xs: 'flex-start', lg: 'flex-end' }} sx={{ flexShrink: 0 }}>
                  <TopTabs value={activeView} onChange={setActiveView} />
                  {activeView === 'video' ? (
                    <Button
                      variant={chatOpen ? 'contained' : 'outlined'}
                      startIcon={<ForumRoundedIcon />}
                      onClick={() => setChatOpen((prev) => !prev)}
                      sx={headerControlSx}
                    >
                      {chatOpen ? 'Скрыть чат' : 'Чат'}
                    </Button>
                  ) : null}
                  <IconButton onClick={() => setParticipantsOpen(true)} sx={headerIconButtonSx}>
                    <GroupsRoundedIcon fontSize="small" />
                  </IconButton>
                  <IconButton onClick={(event) => setNotificationsAnchor(event.currentTarget)} sx={headerIconButtonSx}>
                    <Badge color="primary" variant="dot" invisible={!notifications.length}>
                      <NotificationsRoundedIcon fontSize="small" />
                    </Badge>
                  </IconButton>
                  <Button variant="outlined" startIcon={<TuneRoundedIcon />} onClick={() => setControlsOpen(true)} sx={headerControlSx}>
                    Управление
                  </Button>
                </Stack>
              </Stack>
            </Paper>

            <Box sx={{ flex: 1, minHeight: 0, overflow: 'hidden', boxSizing: 'border-box' }}>
              {activeView === 'board' ? (
                <Paper sx={{ height: '100%', borderRadius: INNER_RADIUS, overflow: 'hidden', boxSizing: 'border-box' }}>
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
                </Paper>
              ) : null}

              {activeView === 'video' ? (
                <Box
                  sx={{
                    display: 'grid',
                    gridTemplateColumns: {
                      xs: 'minmax(0, 1fr)',
                      lg: chatOpen && !isMobileLayout ? `minmax(0, 1fr) ${CHAT_PANEL_WIDTH}px` : 'minmax(0, 1fr)',
                    },
                    gap: SHELL_GAP,
                    height: '100%',
                    minHeight: 0,
                    alignItems: 'stretch',
                  }}
                >
                  <Paper
                    sx={{
                      position: 'relative',
                      minWidth: 0,
                      minHeight: 0,
                      overflow: 'hidden',
                      borderRadius: INNER_RADIUS,
                      background: 'radial-gradient(circle at top, rgba(59, 130, 246, 0.16), transparent 34%), linear-gradient(180deg, #0f172a 0%, #172554 100%)',
                      boxShadow: 'inset 0 1px 0 rgba(255, 255, 255, 0.06), 0 24px 60px rgba(15, 23, 42, 0.18)',
                      boxSizing: 'border-box',
                    }}
                  >
                    <Box sx={{ height: '100%', pb: { xs: '88px', sm: '104px' }, boxSizing: 'border-box' }}>
                      <VideoGrid chatOpen={chatOpen && !isMobileLayout} />
                    </Box>

                    <Box
                      sx={{
                        position: 'absolute',
                        left: '16px',
                        top: '16px',
                        zIndex: 2,
                        p: '12px',
                        borderRadius: CARD_RADIUS,
                        maxWidth: 'calc(100% - 32px)',
                        backgroundColor: alpha('#020617', 0.52),
                        color: '#ffffff',
                        backdropFilter: 'blur(14px)',
                        border: '1px solid rgba(255, 255, 255, 0.1)',
                        boxShadow: '0 14px 36px rgba(15, 23, 42, 0.2)',
                        boxSizing: 'border-box',
                        '& .MuiTypography-root': {
                          color: '#ffffff',
                        },
                        '& .MuiTypography-body2': {
                          color: alpha('#ffffff', 0.76),
                        },
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
                      onChatClick={() => setChatOpen((prev) => !prev)}
                      isChatOpen={chatOpen}
                    />
                  </Paper>

                  <InlineChatSidebar
                    sessionId={sessionId}
                    open={chatOpen}
                    mobile={isMobileLayout}
                    canControlStage={canControlStage}
                    messages={chatMessages}
                    onMessagesChange={setChatMessages}
                    tasks={taskController.tasks}
                    onClose={() => setChatOpen(false)}
                    onSuggestionCreate={handleSuggestionCreate}
                    onSuggestionApply={(suggestion) => void handleSuggestionApply(suggestion)}
                  />
                </Box>
              ) : null}

              {activeView === 'chat' ? (
                <Paper sx={{ height: '100%', borderRadius: INNER_RADIUS, p: '16px', overflow: 'hidden', boxSizing: 'border-box' }}>
                  <Stack spacing="16px" sx={{ height: '100%', minHeight: 0 }}>
                    <Stack direction="row" justifyContent="space-between" alignItems="center">
                      <Box>
                        <Typography variant="h6">Чат встречи</Typography>
                        <Typography variant="body2" color="text.secondary">
                          Полноэкранный режим для общения и AI-подсказок.
                        </Typography>
                      </Box>
                      <Button variant="outlined" endIcon={<ChevronRightRoundedIcon />} onClick={() => setActiveView('video')} sx={headerControlSx}>
                        Вернуться к звонку
                      </Button>
                    </Stack>
                    <Box sx={{ flex: 1, minHeight: 0 }}>
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
                    </Box>
                  </Stack>
                </Paper>
              ) : null}
            </Box>
          </Stack>
        </Paper>
      </Box>

      <ParticipantsDrawer open={participantsOpen} onClose={() => setParticipantsOpen(false)} />

      <Drawer
        anchor="right"
        open={controlsOpen}
        onClose={() => setControlsOpen(false)}
        PaperProps={{ sx: { width: '100%', maxWidth: 380, p: '20px', backgroundColor: '#ffffff', boxSizing: 'border-box' } }}
      >
        <Stack spacing={2}>
          <Box>
            <Typography variant="h6">Управление сессией</Typography>
            <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
              Дополнительные действия вынесены сюда, чтобы не перегружать основной экран звонка.
            </Typography>
          </Box>

          <Stack spacing={1}>
            <Button variant="contained" onClick={() => handleStageChange(stage ?? 'discussion')} disabled={!canControlStage}>
              Запустить этап
            </Button>
            <Button variant="outlined" onClick={handleNextStage} disabled={!canControlStage}>
              Следующий этап
            </Button>
            <Button variant="outlined" onClick={() => void handleReassignAll()} disabled={!canControlStage}>
              Переназначить все
            </Button>
            <Button variant="contained" onClick={() => suggestions.forEach((item) => void handleSuggestionApply(item))} disabled={!canControlStage || !suggestions.length}>
              Подтвердить AI-изменения
            </Button>
            <Button variant="outlined" onClick={() => { setTaskCreateKey((prev) => prev + 1); setActiveView('board'); }}>
              Новая задача
            </Button>
          </Stack>

          <Stack spacing={1}>
            <Typography variant="subtitle2">AI-подсказки</Typography>
            {suggestions.length ? suggestions.map((suggestion) => (
              <MenuItem key={suggestion.id} onClick={() => void handleSuggestionApply(suggestion)} sx={{ border: '1px solid #e5e7eb', borderRadius: CARD_RADIUS, whiteSpace: 'normal', alignItems: 'flex-start' }}>
                <Box>
                  <Typography variant="body2" fontWeight={600}>{suggestion.title}</Typography>
                  <Typography variant="caption" color="text.secondary">{suggestion.description}</Typography>
                </Box>
              </MenuItem>
            )) : (
              <Typography variant="body2" color="text.secondary">
                AI-подсказки появятся здесь.
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
        <Alert severity="success" variant="filled" onClose={clearToast} sx={{ fontWeight: 700, borderRadius: CARD_RADIUS }}>
          {widgetsState.lastStartedToast?.last_started_by?.name
            ? `${widgetsState.lastStartedToast.last_started_by.name} включил Pomodoro`
            : 'Pomodoro включён'}
        </Alert>
      </Snackbar>
    </Box>
  );
}
