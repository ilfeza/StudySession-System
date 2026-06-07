import ArrowBackRoundedIcon from '@mui/icons-material/ArrowBackRounded';
import NotificationsRoundedIcon from '@mui/icons-material/NotificationsRounded';
import SettingsRoundedIcon from '@mui/icons-material/SettingsRounded';
import TaskAltRoundedIcon from '@mui/icons-material/TaskAltRounded';
import { useParticipants } from '@livekit/components-react';
import { Alert, Badge, Box, Button, Dialog, DialogContent, DialogTitle, Drawer, IconButton, Menu, MenuItem, Paper, Stack, TextField, Typography, useMediaQuery } from '@mui/material';
import { alpha, useTheme } from '@mui/material/styles';
import { useEffect, useMemo, useState, type ReactNode } from 'react';
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
import { formatRoomName } from './utils';
import { KanbanBoard } from './components/KanbanBoard';
import { TopTabs, type SessionView } from './components/TopTabs';
import { VideoControls } from './components/VideoControls';
import { VideoGrid } from './components/VideoGrid';

const stageLabels: Record<SessionStage, string> = {
  task_creation: 'Task Creation',
  task_distribution: 'Task Distribution',
  execution: 'Execution',
  review: 'Review',
};

const stageOrder: SessionStage[] = ['task_creation', 'task_distribution', 'execution', 'review'];

function getStageTone(stage: SessionStage | null) {
  if (stage === 'task_creation') {
    return { background: '#eff6ff', color: '#1d4ed8' };
  }
  if (stage === 'task_distribution') {
    return { background: '#fff7ed', color: '#c2410c' };
  }
  if (stage === 'execution') {
    return { background: '#ecfdf5', color: '#047857' };
  }
  if (stage === 'review') {
    return { background: '#f5f3ff', color: '#6d28d9' };
  }
  return { background: '#f8fafc', color: '#475569' };
}

function statusLabel(status: SessionTask['status']) {
  if (status === 'assigned') {
    return 'Назначено';
  }
  if (status === 'in_progress') {
    return 'В работе';
  }
  if (status === 'blocked') {
    return 'Заблокировано';
  }
  if (status === 'done') {
    return 'Готово';
  }
  return 'Бэклог';
}

function SidebarShell({ title, subtitle, children }: { title: string; subtitle: string; children: ReactNode }) {
  return (
    <Paper sx={{ width: '100%', height: '100%', p: 2, borderRadius: 3, display: 'flex', flexDirection: 'column', gap: 2 }}>
      <Box>
        <Typography variant="h6">{title}</Typography>
        <Typography variant="body2" color="text.secondary">{subtitle}</Typography>
      </Box>
      <Box sx={{ flex: 1, minHeight: 0 }}>{children}</Box>
    </Paper>
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
  return (
    <Dialog open={open} onClose={onClose} fullWidth maxWidth="sm">
      <DialogTitle>Настройки устройств</DialogTitle>
      <DialogContent>
        <Stack spacing={2} sx={{ pt: 1 }}>
          <TextField label="ID микрофона" value={preferences.audioDeviceId} onChange={(event) => onPreferencesChange({ audioDeviceId: event.target.value })} />
          <TextField label="ID камеры" value={preferences.videoDeviceId} onChange={(event) => onPreferencesChange({ videoDeviceId: event.target.value })} />
          <Alert severity="info">Если ID устройств пустые, будет использовано устройство по умолчанию в браузере.</Alert>
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
  const isMobile = useMediaQuery(theme.breakpoints.down('lg'));
  const participants = useParticipants();
  const taskController = useSessionTasks(sessionId);
  const { state: widgetsState, send: sendWidgetEvent, clearToast } = useWidgetsSocket(sessionId);
  const [activeView, setActiveView] = useState<SessionView>('video');
  const [sessionRoom, setSessionRoom] = useState<VideoSessionRoom | null>(null);
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([]);
  const [notifications, setNotifications] = useState<SessionNotification[]>([]);
  const [unreadNotifications, setUnreadNotifications] = useState(0);
  const [notificationsAnchor, setNotificationsAnchor] = useState<HTMLElement | null>(null);
  const [sidebar, setSidebar] = useState<'chat' | 'controls' | null>(null);
  const [suggestions, setSuggestions] = useState<SessionSuggestion[]>([]);
  const [taskCreateKey, setTaskCreateKey] = useState(0);
  const [selectedTask, setSelectedTask] = useState<SessionTask | null>(null);
  const [nowMs, setNowMs] = useState(() => Date.now());
  const [serverOffsetMs, setServerOffsetMs] = useState<number | null>(null);
  const [deviceSettingsOpen, setDeviceSettingsOpen] = useState(false);

  useEffect(() => {
    const id = window.setInterval(() => setNowMs(Date.now()), 500);
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

  const participantTasks = useMemo(() => {
    return taskController.tasks.reduce<Record<number, SessionTask>>((acc, task) => {
      if (!task.assignee_id || task.status === 'done') {
        return acc;
      }
      acc[task.assignee_id] = task;
      return acc;
    }, {});
  }, [taskController.tasks]);

  function pushNotification(notification: SessionNotification) {
    setNotifications((prev) => [...prev.filter((item) => item.id !== notification.id), notification].slice(-10));
    if (!notificationsAnchor) {
      setUnreadNotifications((prev) => prev + 1);
    }
  }

  async function handleSuggestionApply(suggestion: SessionSuggestion) {
    const task = taskController.tasks.find((item) => item.id === suggestion.taskId);
    if (!task || suggestion.taskId == null) {
      return;
    }

    if (suggestion.action === 'mark_done') {
      await taskController.patchTask(suggestion.taskId, { status: 'done' });
    } else if (suggestion.action === 'assign_sender' && suggestion.senderId != null) {
      await taskController.patchTask(suggestion.taskId, { assignee_id: suggestion.senderId, status: 'assigned' });
    } else if (suggestion.action === 'mark_blocked') {
      await taskController.patchTask(suggestion.taskId, { status: 'blocked' });
    } else {
      const participant = chooseBestParticipant(taskController.tasks, taskController.participants, task.required_skills);
      if (participant) {
        await taskController.patchTask(suggestion.taskId, { assignee_id: participant.id, status: 'assigned' });
      }
    }

    pushNotification({ id: `suggestion-${suggestion.id}`, message: `Обновлена задача: ${task.title}`, severity: 'success' });
    setSuggestions((prev) => prev.filter((item) => item.id !== suggestion.id));
  }

  async function handleReassignAll() {
    const candidates = taskController.tasks.filter((task) => task.status === 'backlog' || task.status === 'blocked');
    for (const task of candidates) {
      const participant = chooseBestParticipant(taskController.tasks, taskController.participants, task.required_skills);
      if (participant) {
        await taskController.patchTask(task.id, { assignee_id: participant.id, status: 'assigned' });
      }
    }
    pushNotification({ id: `reassign-all-${Date.now()}`, message: 'Доступные задачи перераспределены', severity: 'success' });
  }

  function openTaskDetails(userId: number) {
    const task = participantTasks[userId];
    if (task) {
      setSelectedTask(task);
    }
  }

  const sidebarContent = sidebar === 'chat' ? (
    <SidebarShell title="Чат сессии" subtitle="Общий чат команды">
      <ChatPanel
        sessionId={sessionId}
        variant="session"
        showHeader={false}
        tasks={taskController.tasks}
        isModerator={canControlStage}
        messages={chatMessages}
        onMessagesChange={setChatMessages}
        onSuggestionCreate={(suggestion) => setSuggestions((prev) => (prev.some((item) => item.id === suggestion.id) ? prev : [...prev, suggestion].slice(-10)))}
        onSuggestionApply={(suggestion) => void handleSuggestionApply(suggestion)}
      />
    </SidebarShell>
  ) : (
    <SidebarShell title="Управление сессией" subtitle="Стадии работы и действия по распределению">
      <Stack spacing={2}>
        <Stack direction="row" spacing={1} useFlexGap flexWrap="wrap">
          {stageOrder.map((item) => (
            <Button key={item} variant={stage === item ? 'contained' : 'outlined'} onClick={() => sendWidgetEvent({ event: 'stage_set', payload: { stage: item } })} disabled={!canControlStage}>
              {stageLabels[item]}
            </Button>
          ))}
        </Stack>
        <Button variant="outlined" onClick={() => void handleReassignAll()} disabled={!canControlStage}>
          Перераспределить задачи
        </Button>
        <Button variant="contained" onClick={() => setTaskCreateKey((prev) => prev + 1)}>
          Создать задачу
        </Button>
        <Stack spacing={1}>
          {suggestions.map((suggestion) => (
            <Paper key={suggestion.id} sx={{ p: 1.5, borderRadius: 2 }}>
              <Typography variant="subtitle2">{suggestion.title}</Typography>
              <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>{suggestion.description}</Typography>
              <Button size="small" variant="outlined" onClick={() => void handleSuggestionApply(suggestion)}>Apply</Button>
            </Paper>
          ))}
          {!suggestions.length ? <Alert severity="info">Подсказки по задачам появятся здесь по мере развития сессии.</Alert> : null}
        </Stack>
      </Stack>
    </SidebarShell>
  );

  return (
    <Box sx={{ minHeight: '100vh', background: 'linear-gradient(180deg, #eef2f7 0%, #f8fafc 100%)', p: 2 }}>
      <Stack spacing={2} sx={{ minHeight: 'calc(100vh - 32px)' }}>
        {mediaWarning ? <Alert severity="warning" onClose={onDismissMediaWarning}>{mediaWarning}</Alert> : null}

        <Paper sx={{ p: 2, borderRadius: 3 }}>
          <Stack direction={{ xs: 'column', lg: 'row' }} spacing={2} justifyContent="space-between" alignItems={{ xs: 'stretch', lg: 'center' }}>
            <Stack direction="row" spacing={2} alignItems="center">
              <Button startIcon={<ArrowBackRoundedIcon />} onClick={onBack}>Назад</Button>
              <Box>
                <Typography variant="h5">{sessionRoom?.title || formatRoomName(roomName)}</Typography>
                <Stack direction="row" spacing={1} useFlexGap flexWrap="wrap" sx={{ mt: 1 }}>
                  <Typography variant="caption" sx={{ px: 1.5, py: 0.5, borderRadius: 999, bgcolor: stageTone.background, color: stageTone.color }}>
                    {stage ? stageLabels[stage] : 'Стадия ожидается'}
                  </Typography>
                  <Typography variant="caption" sx={{ px: 1.5, py: 0.5, borderRadius: 999, bgcolor: '#ffffff', border: '1px solid #e5e7eb' }}>
                    {stageElapsed != null ? formatMMSS(stageElapsed) : '00:00'}
                  </Typography>
                  <Typography variant="caption" sx={{ px: 1.5, py: 0.5, borderRadius: 999, bgcolor: '#ffffff', border: '1px solid #e5e7eb' }}>
                    {participantName}
                  </Typography>
                </Stack>
              </Box>
            </Stack>

            <Stack direction="row" spacing={1} alignItems="center" useFlexGap flexWrap="wrap">
              <TopTabs value={activeView} onChange={setActiveView} />
              <IconButton onClick={() => setSidebar((prev) => (prev === 'chat' ? null : 'chat'))}>
                <TaskAltRoundedIcon />
              </IconButton>
              <IconButton onClick={() => setSidebar((prev) => (prev === 'controls' ? null : 'controls'))}>
                <SettingsRoundedIcon />
              </IconButton>
              <IconButton onClick={(event) => { setNotificationsAnchor(event.currentTarget); setUnreadNotifications(0); }}>
                <Badge color="primary" variant="dot" invisible={!unreadNotifications}>
                  <NotificationsRoundedIcon />
                </Badge>
              </IconButton>
            </Stack>
          </Stack>
        </Paper>

        <Box sx={{ flex: 1, minHeight: 0, display: 'grid', gridTemplateColumns: activeView === 'video' && sidebar && !isMobile ? 'minmax(0, 1fr) 360px' : 'minmax(0, 1fr)', gap: 2 }}>
          <Paper sx={{ minHeight: 0, borderRadius: 3, overflow: 'hidden', position: 'relative', bgcolor: activeView === 'video' ? '#0f172a' : '#ffffff' }}>
            {activeView === 'board' ? (
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
                onEngineSuggestionsChange={(items) => setSuggestions(items)}
              />
            ) : (
              <>
                <Box sx={{ height: '100%', pb: '92px' }}>
                  <VideoGrid
                    chatOpen={sidebar === 'chat' && !isMobile}
                    participantTasks={Object.fromEntries(
                      Object.entries(participantTasks).map(([userId, task]) => [
                        Number(userId),
                        task ? { title: task.title, description: task.description, status: statusLabel(task.status) } : undefined,
                      ]),
                    )}
                    onTaskClick={openTaskDetails}
                  />
                </Box>
                <VideoControls
                  microphoneCaptureOptions={microphoneCaptureOptions}
                  cameraCaptureOptions={cameraCaptureOptions}
                  onTrackDeviceError={onTrackDeviceError}
                  onParticipantsClick={() => setSidebar((prev) => (prev === 'controls' ? null : 'controls'))}
                  onChatClick={() => setSidebar((prev) => (prev === 'chat' ? null : 'chat'))}
                  onSettingsClick={() => setDeviceSettingsOpen(true)}
                  isChatOpen={sidebar === 'chat'}
                />
              </>
            )}
          </Paper>

          {activeView === 'video' && sidebar ? (
            isMobile ? (
              <Drawer anchor="right" open onClose={() => setSidebar(null)} PaperProps={{ sx: { width: 'min(100vw - 16px, 360px)', m: 1, height: 'calc(100% - 16px)', borderRadius: 3 } }}>
                {sidebarContent}
              </Drawer>
            ) : (
              sidebarContent
            )
          ) : null}
        </Box>
      </Stack>

      <Dialog open={Boolean(selectedTask)} onClose={() => setSelectedTask(null)} fullWidth maxWidth="sm">
        <DialogTitle>Детали задачи</DialogTitle>
        <DialogContent>
          {selectedTask ? (
            <Stack spacing={1.5} sx={{ pt: 1 }}>
              <Typography variant="h6">{selectedTask.title}</Typography>
              <Typography variant="body2" color="text.secondary">Статус: {statusLabel(selectedTask.status)}</Typography>
              <Typography variant="body2" color="text.secondary">Исполнитель: {selectedTask.assignee?.full_name ?? 'Не назначен'}</Typography>
              <Typography variant="body1">{selectedTask.description || 'Описание пока не добавлено.'}</Typography>
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

      <DeviceSettingsDialog open={deviceSettingsOpen} preferences={joinPreferences} onPreferencesChange={onJoinPreferencesChange} onClose={() => setDeviceSettingsOpen(false)} />

      <Alert
        severity="success"
        onClose={clearToast}
        sx={{
          position: 'fixed',
          bottom: 16,
          left: '50%',
          transform: widgetsState.lastStartedToast ? 'translateX(-50%)' : 'translate(-50%, 200%)',
          opacity: widgetsState.lastStartedToast ? 1 : 0,
          pointerEvents: widgetsState.lastStartedToast ? 'auto' : 'none',
          transition: 'all 180ms ease',
        }}
      >
        {widgetsState.lastStartedToast?.last_started_by?.name
          ? `${widgetsState.lastStartedToast.last_started_by.name} запустил(а) Pomodoro`
          : 'Pomodoro запущен'}
      </Alert>
    </Box>
  );
}
