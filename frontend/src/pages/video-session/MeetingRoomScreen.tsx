import ArrowBackRoundedIcon from '@mui/icons-material/ArrowBackRounded';
import CloseRoundedIcon from '@mui/icons-material/CloseRounded';
import GroupsRoundedIcon from '@mui/icons-material/GroupsRounded';
import NotificationsRoundedIcon from '@mui/icons-material/NotificationsRounded';
import TaskAltRoundedIcon from '@mui/icons-material/TaskAltRounded';
import TuneRoundedIcon from '@mui/icons-material/TuneRounded';
import { useMediaDevices, useParticipants, useRoomContext } from '@livekit/components-react';
import {
  Alert,
  Badge,
  Box,
  Button,
  Dialog,
  DialogContent,
  DialogTitle,
  Divider,
  Drawer,
  IconButton,
  Menu,
  MenuItem,
  Paper,
  Stack,
  Snackbar,
  TextField,
  Typography,
  useMediaQuery,
} from '@mui/material';
import { alpha, useTheme } from '@mui/material/styles';
import { useEffect, useMemo, useState, type ChangeEvent, type ReactNode } from 'react';
import type { AudioCaptureOptions, VideoCaptureOptions } from 'livekit-client';

import { api } from '../../api/client';
import { ChatPanel } from '../../components/ChatPanel';
import { useSessionTasks } from '../../components/tasks/useSessionTasks';
import { formatMMSS } from '../../components/widgets/pomodoroTime';
import { useWidgetsSocket } from '../../components/widgets/useWidgetsSocket';
import type { ChatMessage, SessionTask, VideoSessionRoom } from '../../types';
import type { SessionStage } from '../../types/pomodoro';
import { chooseBestParticipant, type SessionNotification, type SessionSuggestion } from './sessionIntelligence';
import type { JoinPreferences } from './types';
import { getDeviceLabel, formatRoomName } from './utils';
import { KanbanBoard } from './components/KanbanBoard';
import { TopTabs, type SessionView } from './components/TopTabs';
import { VideoControls } from './components/VideoControls';
import { VideoGrid } from './components/VideoGrid';

const SHELL_PADDING = '16px';
const SHELL_GAP = '16px';
const OUTER_RADIUS = '18px';
const HEADER_RADIUS = '14px';
const INNER_RADIUS = '14px';
const CARD_RADIUS = '10px';
const HEADER_CONTROL_HEIGHT = '40px';
const HEADER_ICON_SIZE = '40px';
const SIDEBAR_WIDTH = 340;

const stageLabels: Record<SessionStage, string> = {
  discussion: 'Обсуждение',
  work: 'Работа',
  summary: 'Итоги',
};

const stageOrder: SessionStage[] = ['discussion', 'work', 'summary'];

const headerControlSx = {
  height: HEADER_CONTROL_HEIGHT,
  minHeight: HEADER_CONTROL_HEIGHT,
  px: '14px',
  py: 0,
  borderRadius: '10px',
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
  borderRadius: '10px',
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

function statusLabel(status: SessionTask['status']) {
  if (status === 'in_progress') {
    return 'В работе';
  }
  if (status === 'blocked') {
    return 'Блокер';
  }
  if (status === 'needs_reassignment') {
    return 'Нужно переназначить';
  }
  if (status === 'done') {
    return 'Готово';
  }
  return 'К выполнению';
}

type SidebarView = 'chat' | 'participants' | 'controls';

function SidebarShell({
  title,
  subtitle,
  onClose,
  children,
}: {
  title: string;
  subtitle: string;
  onClose: () => void;
  children: ReactNode;
}) {
  return (
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
      <Stack direction="row" alignItems="center" justifyContent="space-between" sx={{ px: '16px', py: '12px', minHeight: '62px', boxSizing: 'border-box' }}>
        <Box sx={{ minWidth: 0 }}>
          <Typography variant="subtitle1" fontWeight={700}>{title}</Typography>
          <Typography variant="caption" color="text.secondary">{subtitle}</Typography>
        </Box>
        <IconButton onClick={onClose} aria-label="Закрыть панель" sx={{ ...headerIconButtonSx, width: 36, height: 36 }}>
          <CloseRoundedIcon fontSize="small" />
        </IconButton>
      </Stack>
      <Divider />
      <Box sx={{ flex: 1, minHeight: 0, p: '16px', boxSizing: 'border-box' }}>{children}</Box>
    </Paper>
  );
}

function InlineSidebar({
  open,
  mobile,
  onClose,
  children,
}: {
  open: boolean;
  mobile: boolean;
  onClose: () => void;
  children: ReactNode;
}) {
  if (!open) {
    return null;
  }

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
        {children}
      </Drawer>
    );
  }

  return (
    <Box
      sx={{
        width: `${SIDEBAR_WIDTH}px`,
        flexShrink: 0,
        minHeight: 0,
        height: '100%',
        alignSelf: 'stretch',
      }}
    >
      {children}
    </Box>
  );
}

function ParticipantsPanel({ onClose }: { onClose: () => void }) {
  const participants = useParticipants();

  return (
    <SidebarShell title="Участники" subtitle={`${participants.length} в комнате`} onClose={onClose}>
      <Stack spacing={1}>
        {participants.map((participant) => {
          const displayName = participant.name?.trim() || `Участник ${participant.identity}`;
          return (
            <Paper key={participant.identity} sx={{ p: 1.5, borderRadius: 1.5 }}>
              <Stack spacing={0.5}>
                <Typography variant="subtitle2" noWrap>{displayName}</Typography>
                <Typography variant="caption" color="text.secondary">
                  {participant.isLocal ? 'Вы' : 'В эфире'}
                </Typography>
              </Stack>
            </Paper>
          );
        })}
      </Stack>
    </SidebarShell>
  );
}

function SessionControlsPanel({
  canControlStage,
  stage,
  suggestions,
  onClose,
  onStageChange,
  onReassignAll,
  onApplyAllSuggestions,
  onCreateTask,
  onApplySuggestion,
}: {
  canControlStage: boolean;
  stage: SessionStage | null;
  suggestions: SessionSuggestion[];
  onClose: () => void;
  onStageChange: (nextStage: SessionStage) => void;
  onReassignAll: () => void;
  onApplyAllSuggestions: () => void;
  onCreateTask: () => void;
  onApplySuggestion: (suggestion: SessionSuggestion) => void;
}) {
  return (
    <SidebarShell title="Управление сессией" subtitle="Этапы, задачи и быстрые действия" onClose={onClose}>
      <Stack spacing={2}>
        <Stack spacing={1}>
          <Typography variant="subtitle2">Этап сессии</Typography>
          <Stack direction="row" spacing={1} useFlexGap flexWrap="wrap">
            {stageOrder.map((item) => (
              <Button
                key={item}
                variant={stage === item ? 'contained' : 'outlined'}
                onClick={() => onStageChange(item)}
                disabled={!canControlStage}
                sx={{ minHeight: 38, px: 1.5 }}
              >
                {stageLabels[item]}
              </Button>
            ))}
          </Stack>
        </Stack>

        <Stack spacing={1}>
          <Button variant="outlined" onClick={onReassignAll} disabled={!canControlStage}>
            Перераспределить задачи
          </Button>
          <Button variant="contained" onClick={onApplyAllSuggestions} disabled={!canControlStage || !suggestions.length}>
            Применить AI-подсказки
          </Button>
          <Button variant="outlined" onClick={onCreateTask}>
            Новая задача
          </Button>
        </Stack>

        <Stack spacing={1}>
          <Typography variant="subtitle2">AI-подсказки</Typography>
          {suggestions.length ? suggestions.map((suggestion) => (
            <MenuItem key={suggestion.id} onClick={() => onApplySuggestion(suggestion)} sx={{ border: '1px solid #e5e7eb', borderRadius: 1.5, whiteSpace: 'normal', alignItems: 'flex-start' }}>
              <Box>
                <Typography variant="body2" fontWeight={600}>{suggestion.title}</Typography>
                <Typography variant="caption" color="text.secondary">{suggestion.description}</Typography>
              </Box>
            </MenuItem>
          )) : (
            <Typography variant="body2" color="text.secondary">
              Подсказки появятся здесь по ходу сессии.
            </Typography>
          )}
        </Stack>
      </Stack>
    </SidebarShell>
  );
}

function DeviceSettingsDialog({
  open,
  preferences,
  onClose,
  onPreferencesChange,
}: {
  open: boolean;
  preferences: JoinPreferences;
  onClose: () => void;
  onPreferencesChange: (patch: Partial<JoinPreferences>) => void;
}) {
  const room = useRoomContext();
  const audioDevices = useMediaDevices({ kind: 'audioinput' });
  const videoDevices = useMediaDevices({ kind: 'videoinput' });
  const [deviceError, setDeviceError] = useState('');

  async function handleAudioChange(deviceId: string) {
    onPreferencesChange({ audioDeviceId: deviceId });
    setDeviceError('');
    try {
      await room.switchActiveDevice('audioinput', deviceId);
    } catch (error) {
      setDeviceError(error instanceof Error ? error.message : 'Не удалось переключить микрофон.');
    }
  }

  async function handleVideoChange(deviceId: string) {
    onPreferencesChange({ videoDeviceId: deviceId });
    setDeviceError('');
    try {
      await room.switchActiveDevice('videoinput', deviceId);
    } catch (error) {
      setDeviceError(error instanceof Error ? error.message : 'Не удалось переключить камеру.');
    }
  }

  return (
    <Dialog open={open} onClose={onClose} fullWidth maxWidth="sm">
      <DialogTitle>Настройки камеры и микрофона</DialogTitle>
      <DialogContent>
        <Stack spacing={2} sx={{ pt: 1 }}>
          <Typography variant="body2" color="text.secondary">
            Здесь можно выбрать устройства прямо во время сессии и сразу проверить их в комнате.
          </Typography>

          <TextField
            select
            label="Микрофон"
            value={preferences.audioDeviceId}
            onChange={(event: ChangeEvent<HTMLInputElement>) => void handleAudioChange(event.target.value)}
          >
            {audioDevices.map((device, index) => (
              <MenuItem key={device.deviceId || `audio-${index}`} value={device.deviceId || 'default'}>
                {getDeviceLabel(device, 'Микрофон', index)}
              </MenuItem>
            ))}
          </TextField>

          <TextField
            select
            label="Камера"
            value={preferences.videoDeviceId}
            onChange={(event: ChangeEvent<HTMLInputElement>) => void handleVideoChange(event.target.value)}
          >
            {videoDevices.map((device, index) => (
              <MenuItem key={device.deviceId || `video-${index}`} value={device.deviceId || 'default'}>
                {getDeviceLabel(device, 'Камера', index)}
              </MenuItem>
            ))}
          </TextField>

          <Paper sx={{ p: 1.5, borderRadius: 1.5, bgcolor: '#f8fafc' }}>
            <Typography variant="subtitle2">Проверка</Typography>
            <Typography variant="body2" color="text.secondary" sx={{ mt: 0.75 }}>
              После выбора можно сразу включить и выключить камеру или микрофон кнопками под видео.
            </Typography>
          </Paper>

          {deviceError ? <Alert severity="warning">{deviceError}</Alert> : null}
        </Stack>
      </DialogContent>
    </Dialog>
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
  joinPreferences,
  onJoinPreferencesChange,
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
  joinPreferences: JoinPreferences;
  onJoinPreferencesChange: (patch: Partial<JoinPreferences>) => void;
  onTrackDeviceError: (message: string) => void;
}) {
  const theme = useTheme();
  const isMobileLayout = useMediaQuery(theme.breakpoints.down('lg'));
  const participants = useParticipants();
  const taskController = useSessionTasks(sessionId);
  const [activeView, setActiveView] = useState<SessionView>('video');
  const [sidebarView, setSidebarView] = useState<SidebarView | null>(null);
  const [notificationsAnchor, setNotificationsAnchor] = useState<HTMLElement | null>(null);
  const [sessionRoom, setSessionRoom] = useState<VideoSessionRoom | null>(null);
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([]);
  const [taskCreateKey, setTaskCreateKey] = useState(0);
  const [selectedTask, setSelectedTask] = useState<SessionTask | null>(null);
  const [nowMs, setNowMs] = useState(() => Date.now());
  const [serverOffsetMs, setServerOffsetMs] = useState<number | null>(null);
  const [suggestions, setSuggestions] = useState<SessionSuggestion[]>([]);
  const [notifications, setNotifications] = useState<SessionNotification[]>([]);
  const [unreadNotifications, setUnreadNotifications] = useState(0);
  const [deviceSettingsOpen, setDeviceSettingsOpen] = useState(false);
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
      setSidebarView(null);
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

  const participantTasks = useMemo(() => {
    const priorityOrder: Record<string, number> = {
      in_progress: 0,
      todo: 1,
      blocked: 2,
      needs_reassignment: 3,
      done: 4,
    };

    return taskController.tasks.reduce<Record<number, SessionTask>>((acc, task) => {
      if (!task.assignee_id || task.status === 'done') {
        return acc;
      }
      const existing = acc[task.assignee_id];
      if (!existing) {
        acc[task.assignee_id] = task;
        return acc;
      }
      const currentWeight = priorityOrder[task.status] ?? 99;
      const existingWeight = priorityOrder[existing.status] ?? 99;
      if (currentWeight < existingWeight || (currentWeight === existingWeight && task.id > existing.id)) {
        acc[task.assignee_id] = task;
      }
      return acc;
    }, {});
  }, [taskController.tasks]);

  function pushNotification(notification: SessionNotification) {
    setNotifications((prev) => [...prev.filter((item) => item.id !== notification.id), notification].slice(-8));
    if (!notificationsAnchor) {
      setUnreadNotifications((prev) => prev + 1);
    }
  }

  function toggleSidebar(view: SidebarView) {
    setSidebarView((prev) => (prev === view ? null : view));
  }

  function openNotifications(anchor: HTMLElement) {
    setNotificationsAnchor(anchor);
    setUnreadNotifications(0);
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
      pushNotification({ id: `blocked-${suggestion.id}`, message: `Задача отмечена как заблокированная: ${task?.title ?? ''}`, severity: 'warning' });
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

  async function handleReassignAll() {
    const candidates = taskController.tasks.filter((task) => task.status !== 'done' && (task.assignee_id == null || task.status === 'needs_reassignment'));
    for (const task of candidates) {
      const participant = chooseBestParticipant(taskController.tasks, taskController.participants, task.required_skills);
      if (participant) {
        await taskController.patchTask(task.id, { assignee_id: participant.id, status: 'todo' });
      }
    }
    pushNotification({ id: `all-${Date.now()}`, message: 'Доступные задачи перераспределены', severity: 'success' });
  }

  function openTaskDetails(userId: number) {
    const task = participantTasks[userId];
    if (task) {
      setSelectedTask(task);
    }
  }

  const sidebarContent = sidebarView === 'chat' ? (
    <SidebarShell title="Чат" subtitle="Сообщения прямо внутри звонка" onClose={() => setSidebarView(null)}>
      <ChatPanel
        sessionId={sessionId}
        variant="session"
        showHeader={false}
        tasks={taskController.tasks}
        isModerator={canControlStage}
        messages={chatMessages}
        onMessagesChange={setChatMessages}
        onSuggestionCreate={handleSuggestionCreate}
        onSuggestionApply={(suggestion) => void handleSuggestionApply(suggestion)}
      />
    </SidebarShell>
  ) : sidebarView === 'participants' ? (
    <ParticipantsPanel onClose={() => setSidebarView(null)} />
  ) : sidebarView === 'controls' ? (
    <SessionControlsPanel
      canControlStage={canControlStage}
      stage={stage}
      suggestions={suggestions}
      onClose={() => setSidebarView(null)}
      onStageChange={handleStageChange}
      onReassignAll={() => void handleReassignAll()}
      onApplyAllSuggestions={() => suggestions.forEach((item) => void handleSuggestionApply(item))}
      onCreateTask={() => {
        setTaskCreateKey((prev) => prev + 1);
        setActiveView('board');
      }}
      onApplySuggestion={(suggestion) => void handleSuggestionApply(suggestion)}
    />
  ) : null;

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
                    <>
                      <IconButton onClick={() => toggleSidebar('participants')} sx={headerIconButtonSx}>
                        <GroupsRoundedIcon fontSize="small" />
                      </IconButton>
                      <IconButton onClick={(event) => openNotifications(event.currentTarget)} sx={headerIconButtonSx}>
                        <Badge color="primary" variant="dot" invisible={!unreadNotifications}>
                          <NotificationsRoundedIcon fontSize="small" />
                        </Badge>
                      </IconButton>
                      <Button variant={sidebarView === 'controls' ? 'contained' : 'outlined'} startIcon={<TuneRoundedIcon />} onClick={() => toggleSidebar('controls')} sx={headerControlSx}>
                        Управление
                      </Button>
                    </>
                  ) : null}
                </Stack>
              </Stack>
            </Paper>

            <Box sx={{ flex: 1, minHeight: 0, overflow: 'hidden', boxSizing: 'border-box' }}>
              {activeView === 'board' ? (
                <Paper sx={{ height: '100%', borderRadius: INNER_RADIUS, overflow: 'hidden', boxSizing: 'border-box', boxShadow: 'none', border: 'none', bgcolor: 'transparent' }}>
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
                      lg: sidebarView && !isMobileLayout ? `minmax(0, 1fr) ${SIDEBAR_WIDTH}px` : 'minmax(0, 1fr)',
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
                    <Box sx={{ height: '100%', pb: { xs: '84px', sm: '92px' }, boxSizing: 'border-box' }}>
                      <VideoGrid
                        chatOpen={sidebarView === 'chat' && !isMobileLayout}
                        participantTasks={Object.fromEntries(
                          Object.entries(participantTasks).map(([userId, task]) => [
                            Number(userId),
                            task
                              ? {
                                  title: task.title,
                                  description: task.description,
                                  status: statusLabel(task.status),
                                }
                              : undefined,
                          ]),
                        )}
                        onTaskClick={openTaskDetails}
                      />
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
                      }}
                    >
                      <Typography variant="subtitle2">Комната</Typography>
                      <Typography variant="body2" sx={{ color: alpha('#ffffff', 0.76) }}>
                        {sessionRoom?.title || formatRoomName(roomName)}
                      </Typography>
                    </Box>

                    <VideoControls
                      microphoneCaptureOptions={microphoneCaptureOptions}
                      cameraCaptureOptions={cameraCaptureOptions}
                      onTrackDeviceError={onTrackDeviceError}
                      onParticipantsClick={() => toggleSidebar('participants')}
                      onChatClick={() => toggleSidebar('chat')}
                      onSettingsClick={() => setDeviceSettingsOpen(true)}
                      isChatOpen={sidebarView === 'chat'}
                    />
                  </Paper>

                  <InlineSidebar open={Boolean(sidebarView)} mobile={isMobileLayout} onClose={() => setSidebarView(null)}>
                    {sidebarContent}
                  </InlineSidebar>
                </Box>
              ) : null}
            </Box>
          </Stack>
        </Paper>
      </Box>

      <DeviceSettingsDialog
        open={deviceSettingsOpen}
        preferences={joinPreferences}
        onPreferencesChange={onJoinPreferencesChange}
        onClose={() => setDeviceSettingsOpen(false)}
      />

      <Dialog open={Boolean(selectedTask)} onClose={() => setSelectedTask(null)} fullWidth maxWidth="sm">
        <DialogTitle sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <TaskAltRoundedIcon fontSize="small" />
          Подробности задачи
        </DialogTitle>
        <DialogContent>
          {selectedTask ? (
            <Stack spacing={1.5} sx={{ pt: 1 }}>
              <Typography variant="h6">{selectedTask.title}</Typography>
              <Typography variant="body2" color="text.secondary">
                Статус: {statusLabel(selectedTask.status)}
              </Typography>
              <Typography variant="body2" color="text.secondary">
                Исполнитель: {selectedTask.assignee?.full_name ?? 'Не назначен'}
              </Typography>
              <Typography variant="body1">
                {selectedTask.description || 'Описание пока не добавлено.'}
              </Typography>
            </Stack>
          ) : null}
        </DialogContent>
      </Dialog>

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
