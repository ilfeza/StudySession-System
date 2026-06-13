import ArrowBackRoundedIcon from '@mui/icons-material/ArrowBackRounded';
import AssignmentTurnedInRoundedIcon from '@mui/icons-material/AssignmentTurnedInRounded';
import InsightsRoundedIcon from '@mui/icons-material/InsightsRounded';
import ViewKanbanRoundedIcon from '@mui/icons-material/ViewKanbanRounded';
import VideocamRoundedIcon from '@mui/icons-material/VideocamRounded';
import TimelapseRoundedIcon from '@mui/icons-material/TimelapseRounded';
import { useParticipants } from '@livekit/components-react';
import {
  Alert,
  Box,
  Button,
  Chip,
  Divider,
  Drawer,
  Paper,
  Stack,
  Tab,
  Tabs,
  TextField,
  Typography,
  useMediaQuery,
} from '@mui/material';
import { alpha, useTheme } from '@mui/material/styles';
import { useEffect, useMemo, useState, type ReactElement } from 'react';
import type { AudioCaptureOptions, VideoCaptureOptions } from 'livekit-client';

import { api } from '../../api/client';
import { ChatPanel } from '../../components/ChatPanel';
import { assignNextSessionTask } from '../../api/sessionTasks';
import { useSessionTasks } from '../../components/tasks/useSessionTasks';
import { formatMMSS } from '../../components/widgets/pomodoroTime';
import { useWidgetsSocket } from '../../components/widgets/useWidgetsSocket';
import type { ChatMessage, SessionDashboardSnapshot, SessionTask, VideoSessionRoom } from '../../types';
import type { SessionStage } from '../../types/pomodoro';
import { KanbanBoard } from './components/KanbanBoard';
import { VideoControls } from './components/VideoControls';
import { VideoGrid } from './components/VideoGrid';
import { formatRoomName } from './utils';
import type { JoinPreferences } from './types';

type SessionTab = 'video' | 'kanban' | 'stages';

const stageSteps = [
  { key: 'task_creation', label: 'Подготовка' },
  { key: 'task_distribution', label: 'Обсуждение' },
  { key: 'execution', label: 'Выполнение' },
  { key: 'review', label: 'Проверка' },
  { key: 'completion', label: 'Завершение' },
] as const;

function resolveStageIndex(stage: SessionStage | null, dashboard: SessionDashboardSnapshot | null) {
  if (!stage) return 0;
  const idx = stageSteps.findIndex((item) => item.key === stage);
  if (idx >= 0) return idx;
  return dashboard?.metrics.completion_rate === 100 ? stageSteps.length - 1 : 0;
}

function stageChipColor(stage: SessionStage | null) {
  if (stage === 'task_distribution') return { bg: alpha('#f59e0b', 0.12), fg: '#b45309' };
  if (stage === 'execution') return { bg: alpha('#16a34a', 0.12), fg: '#15803d' };
  if (stage === 'review') return { bg: alpha('#7c3aed', 0.12), fg: '#6d28d9' };
  return { bg: alpha('#2563eb', 0.12), fg: '#1d4ed8' };
}

function formatTimeLabel(timestamp: string) {
  return new Date(timestamp).toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' });
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
  const controller = useSessionTasks(sessionId);
  const { state: widgetsState } = useWidgetsSocket(sessionId);
  const [sessionRoom, setSessionRoom] = useState<VideoSessionRoom | null>(null);
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([]);
  const [activeTab, setActiveTab] = useState<SessionTab>('video');
  const [selectedParticipantId, setSelectedParticipantId] = useState<number | null>(null);
  const [selectedTask, setSelectedTask] = useState<SessionTask | null>(null);
  const [chatOpen, setChatOpen] = useState(false);
  const [analyticsOpen, setAnalyticsOpen] = useState(false);
  const [deviceSettingsOpen, setDeviceSettingsOpen] = useState(false);
  const [nowMs, setNowMs] = useState(() => Date.now());
  const [serverOffsetMs, setServerOffsetMs] = useState<number | null>(null);
  const [notification, setNotification] = useState('');

  useEffect(() => {
    const timer = window.setInterval(() => setNowMs(Date.now()), 1000);
    return () => window.clearInterval(timer);
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
  const stageIndex = resolveStageIndex(stage, controller.dashboard);
  const stageElapsed = useMemo(() => {
    const snapshot = widgetsState.stage;
    if (!snapshot) return 0;
    const offset = serverOffsetMs ?? 0;
    const serverNow = nowMs - offset;
    return Math.max(0, Math.floor((serverNow - snapshot.timing.stage_started_at_ms) / 1000));
  }, [nowMs, serverOffsetMs, widgetsState.stage]);

  const dashboard = controller.dashboard;
  const participantsView = dashboard?.participants ?? [];
  const history = dashboard?.history ?? [];
  const lastAssignment = dashboard?.last_assignment ?? null;
  const liveParticipantNames = useMemo(
    () => participants.map((participant) => participant.name?.trim().toLowerCase()).filter(Boolean) as string[],
    [participants],
  );
  const stageColor = stageChipColor(stage);

  const activeTasks = controller.tasks.filter((task) => task.status !== 'done');
  const currentTask =
    selectedTask ??
    (selectedParticipantId
      ? activeTasks.find((task) => task.assignee_id === selectedParticipantId) ?? null
      : activeTasks[0] ?? null);

  const participantTasks = useMemo(() => {
    return controller.tasks.reduce<Record<number, SessionTask>>((acc, task) => {
      if (!task.assignee_id || task.status === 'done') {
        return acc;
      }
      acc[task.assignee_id] = task;
      return acc;
    }, {});
  }, [controller.tasks]);

  const stageColumns = useMemo(() => {
    const columns = stageSteps.map((stageStep) => ({ ...stageStep, tasks: [] as SessionTask[] }));
    for (const task of controller.tasks) {
      if (task.status !== 'done') continue;
      const idx = columns.findIndex((column) => column.key === task.workflow_stage);
      const targetIndex = idx >= 0 ? idx : columns.length - 1;
      columns[targetIndex].tasks.push(task);
    }
    return columns;
  }, [controller.tasks]);

  async function handleNextTask(preferredUserId?: number) {
    const updated = await assignNextSessionTask(sessionId, preferredUserId);
    if (!updated) {
      setNotification('Нет доступных задач для назначения');
      return;
    }
    setNotification(`Задача #${updated.id} назначена ${updated.assignee?.full_name ?? 'участнику'}`);
  }

  async function handleCompleteTask(task: SessionTask | null) {
    if (!task) return;
    await controller.patchTask(task.id, { status: 'done' });
    setSelectedTask(null);
    setNotification(`Задача #${task.id} завершена`);
  }

  const tabs: Array<{ value: SessionTab; label: string; icon: ReactElement }> = [
    { value: 'video', label: 'Видеосессия', icon: <VideocamRoundedIcon fontSize="small" /> },
    { value: 'kanban', label: 'Канбан', icon: <ViewKanbanRoundedIcon fontSize="small" /> },
    { value: 'stages', label: 'Этапы', icon: <AssignmentTurnedInRoundedIcon fontSize="small" /> },
  ];

  return (
    <Box sx={{ minHeight: '100vh', bgcolor: '#eef2f7', p: { xs: 1, md: 2 } }}>
      <Stack spacing={1.25} sx={{ minHeight: 'calc(100vh - 16px)' }}>
        {mediaWarning ? <Alert severity="warning" onClose={onDismissMediaWarning}>{mediaWarning}</Alert> : null}

        <Paper sx={{ px: 2, py: 1.25, borderRadius: 3, zIndex: 1 }}>
          <Stack direction="row" alignItems="center" justifyContent="space-between" spacing={2} flexWrap="wrap">
            <Stack direction="row" alignItems="center" spacing={1.5} sx={{ minWidth: 0 }}>
              <Button startIcon={<ArrowBackRoundedIcon />} onClick={onBack} variant="text">
                Назад
              </Button>
              <Box sx={{ minWidth: 0 }}>
                <Typography variant="h6" sx={{ fontWeight: 800, lineHeight: 1.2 }} noWrap>
                  {sessionRoom?.title || formatRoomName(roomName)}
                </Typography>
                <Typography variant="caption" color="text.secondary" noWrap>
                  Участников: {participantsView.length || participants.length} · {canControlStage ? 'Модератор' : 'Участник'} · {participantName}
                </Typography>
              </Box>
            </Stack>
            <Stack direction="row" spacing={1} flexWrap="wrap" justifyContent="flex-end">
              <Chip icon={<TimelapseRoundedIcon />} label={stage ? `${stageSteps[stageIndex].label} · ${formatMMSS(stageElapsed)}` : 'Этап не определён'} sx={{ bgcolor: stageColor.bg, color: stageColor.fg }} />
              <Chip label="Аналитика" icon={<InsightsRoundedIcon fontSize="small" />} onClick={() => setAnalyticsOpen(true)} clickable />
            </Stack>
          </Stack>
        </Paper>

        <Paper sx={{ px: 1, py: 0.5, borderRadius: 3, zIndex: 1 }}>
          <Tabs
            value={activeTab}
            onChange={(_, next: SessionTab) => setActiveTab(next)}
            variant={isMobile ? 'scrollable' : 'fullWidth'}
            scrollButtons="auto"
            sx={{ minHeight: 44, '& .MuiTabs-indicator': { height: 3, borderRadius: 999 } }}
          >
            {tabs.map((tab) => (
              <Tab key={tab.value} value={tab.value} icon={tab.icon} iconPosition="start" label={tab.label} sx={{ minHeight: 44, fontWeight: 600 }} />
            ))}
          </Tabs>
        </Paper>

        <Box sx={{ flex: 1, minHeight: 0, overflow: 'hidden' }}>
          {activeTab === 'video' ? (
            <Paper sx={{ height: '100%', minHeight: 0, borderRadius: 3, overflow: 'hidden', bgcolor: '#0f172a' }}>
              <Box
                sx={{
                  display: 'grid',
                  gridTemplateColumns: chatOpen && !isMobile ? 'minmax(0, 1fr) 360px' : 'minmax(0, 1fr)',
                  height: '100%',
                  minHeight: 0,
                }}
              >
                <Box sx={{ position: 'relative', minHeight: 0, overflow: 'hidden' }}>
                  <VideoGrid
                    chatOpen={false}
                    participantTasks={Object.fromEntries(
                      Object.entries(participantTasks).map(([userId, task]) => [
                        Number(userId),
                        task ? { title: task.title, description: task.description, status: task.status } : undefined,
                      ]),
                    )}
                    onTaskClick={(userId) => {
                      setSelectedParticipantId(userId);
                      const nextTask = activeTasks.find((task) => task.assignee_id === userId) ?? null;
                      setSelectedTask(nextTask);
                    }}
                  />

                  <Box sx={{ position: 'absolute', left: 16, bottom: 96, zIndex: 2, pointerEvents: 'auto', maxWidth: 360, width: 'calc(100% - 32px)' }}>
                    <Paper
                      onClick={() => setSelectedTask(currentTask)}
                      sx={{
                        p: 1.5,
                        borderRadius: 3,
                        cursor: 'pointer',
                        bgcolor: alpha('#020617', 0.7),
                        color: '#fff',
                        border: '1px solid rgba(255,255,255,0.12)',
                        boxShadow: '0 16px 44px rgba(2,6,23,0.28)',
                      }}
                    >
                      <Stack spacing={0.75}>
                        <Typography variant="caption" sx={{ color: alpha('#fff', 0.75) }}>
                          Текущая задача
                        </Typography>
                        <Typography variant="subtitle1" sx={{ fontWeight: 700 }}>
                          {currentTask?.title ?? 'Пока нет активной задачи'}
                        </Typography>
                        <Typography variant="body2" sx={{ color: alpha('#fff', 0.82), overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                          {currentTask?.assignee?.full_name ? `Исполнитель: ${currentTask.assignee.full_name}` : 'Исполнитель не назначен'}
                        </Typography>
                      </Stack>
                    </Paper>
                  </Box>

                  <Box sx={{ position: 'absolute', left: 0, right: 0, bottom: 0, p: 1.5, zIndex: 2 }}>
                    <VideoControls
                      microphoneCaptureOptions={microphoneCaptureOptions}
                      cameraCaptureOptions={cameraCaptureOptions}
                      onTrackDeviceError={onTrackDeviceError}
                      onParticipantsClick={() => setSelectedParticipantId(participantsView[0]?.id ?? null)}
                      onChatClick={() => setChatOpen((prev) => !prev)}
                      onSettingsClick={() => setDeviceSettingsOpen(true)}
                      isChatOpen={chatOpen}
                    />
                  </Box>
                </Box>

                {chatOpen && !isMobile ? (
                  <Box sx={{ minHeight: 0, borderLeft: '1px solid rgba(255,255,255,0.08)', bgcolor: '#ffffff' }}>
                    <ChatPanel sessionId={sessionId} variant="session" showHeader />
                  </Box>
                ) : null}
              </Box>
            </Paper>
          ) : null}

          {activeTab === 'kanban' ? (
            <Paper sx={{ height: '100%', minHeight: 0, borderRadius: 3, overflow: 'hidden' }}>
              <KanbanBoard
                sessionId={sessionId}
                sessionTitle={sessionRoom?.title ?? formatRoomName(roomName)}
                sessionDescription={sessionRoom?.description ?? ''}
                chatMessages={chatMessages}
                controller={controller}
                isModerator={canControlStage}
                liveParticipantNames={liveParticipantNames}
              />
            </Paper>
          ) : null}

          {activeTab === 'stages' ? (
            <Box sx={{ height: '100%', minHeight: 0, overflow: 'auto' }}>
              <Paper sx={{ p: 2, borderRadius: 3, height: '100%', minHeight: 0, overflow: 'auto' }}>
                <Stack spacing={2}>
                  <Box>
                    <Typography variant="h5" sx={{ fontWeight: 800 }}>
                      Этапы сессии
                    </Typography>
                    <Typography variant="body2" color="text.secondary">
                      Здесь видно, какие задачи были завершены на каждом этапе.
                    </Typography>
                  </Box>
                  <Box
                    sx={{
                      display: 'grid',
                      gap: 1.5,
                      gridTemplateColumns: { xs: '1fr', md: 'repeat(5, minmax(0, 1fr))' },
                      alignItems: 'start',
                    }}
                  >
                    {stageColumns.map((column) => (
                      <Paper key={column.key} sx={{ p: 1.5, borderRadius: 3, bgcolor: '#f8fafc', minHeight: 220 }}>
                        <Stack spacing={1.25}>
                          <Box>
                            <Typography variant="subtitle1" sx={{ fontWeight: 800 }}>
                              {column.label}
                            </Typography>
                            <Typography variant="caption" color="text.secondary">
                              {column.tasks.length} задач
                            </Typography>
                          </Box>
                          <Stack spacing={1}>
                            {column.tasks.length ? column.tasks.map((task) => (
                              <Paper
                                key={task.id}
                                sx={{ p: 1.25, borderRadius: 2, bgcolor: '#ffffff', border: '1px solid', borderColor: 'divider', cursor: 'pointer' }}
                                onClick={() => setSelectedTask(task)}
                              >
                                <Stack spacing={0.5}>
                                  <Typography variant="body2" sx={{ fontWeight: 700 }}>
                                    {task.title}
                                  </Typography>
                                  <Typography variant="caption" color="text.secondary">
                                    {task.assignee?.full_name ?? 'Без исполнителя'}
                                  </Typography>
                                </Stack>
                              </Paper>
                            )) : (
                              <Typography variant="body2" color="text.secondary">
                                Пока нет завершённых задач
                              </Typography>
                            )}
                          </Stack>
                        </Stack>
                      </Paper>
                    ))}
                  </Box>
                </Stack>
              </Paper>
            </Box>
          ) : null}
        </Box>
      </Stack>

      <Drawer
        anchor="right"
        open={Boolean(selectedTask)}
        onClose={() => setSelectedTask(null)}
        PaperProps={{
          sx: {
            width: 'min(100vw - 16px, 420px)',
            m: 1,
            borderRadius: 3,
            overflowY: 'auto',
            zIndex: 1400,
          },
        }}
      >
        <Box sx={{ p: 2 }}>
          <Stack spacing={2}>
            <Box>
              <Typography variant="h6">Задача</Typography>
              <Typography variant="body2" color="text.secondary">
                Подробности задачи и кнопка для выдачи следующей.
              </Typography>
            </Box>
            <Divider />
            {selectedTask ? (
              <Stack spacing={1.5}>
                <Typography variant="subtitle1" sx={{ fontWeight: 700 }}>
                  {selectedTask.title}
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  {selectedTask.description || 'Описание отсутствует.'}
                </Typography>
                <TextField label="Статус" value={selectedTask.status} InputProps={{ readOnly: true }} fullWidth />
                <TextField
                  label="Исполнитель"
                  value={selectedTask.assignee?.full_name ?? 'Не назначен'}
                  InputProps={{ readOnly: true }}
                  fullWidth
                />
                <Stack spacing={1}>
                  {selectedTask.assignee_id ? (
                    <Button variant="contained" onClick={() => void handleNextTask(selectedTask.assignee_id ?? undefined)}>
                      Получить следующую задачу для {selectedTask.assignee?.full_name ?? 'участника'}
                    </Button>
                  ) : (
                    <Button variant="contained" onClick={() => void handleNextTask()}>
                      Получить следующую задачу
                    </Button>
                  )}
                  <Button variant="outlined" onClick={() => void handleCompleteTask(selectedTask)}>
                    Завершить задачу
                  </Button>
                </Stack>
              </Stack>
            ) : null}
          </Stack>
        </Box>
      </Drawer>

      <Drawer
        anchor="right"
        open={analyticsOpen}
        onClose={() => setAnalyticsOpen(false)}
        PaperProps={{
          sx: {
            width: 'min(100vw - 16px, 460px)',
            m: 1,
            borderRadius: 3,
            overflowY: 'auto',
            zIndex: 1450,
          },
        }}
      >
        <Box sx={{ p: 2 }}>
          <Stack spacing={2}>
            <Box>
              <Typography variant="h6">Аналитика</Typography>
              <Typography variant="body2" color="text.secondary">
                Команда, история, последнее назначение и нагрузка участников.
              </Typography>
            </Box>
            <Divider />
            <Stack spacing={1.5}>
              <Typography variant="subtitle2">Последнее назначение</Typography>
              {lastAssignment ? (
                <Paper sx={{ p: 1.5, borderRadius: 2, bgcolor: '#f8fafc' }}>
                  <Stack spacing={0.75}>
                    <Typography variant="body2">Задача: {lastAssignment.task_title}</Typography>
                    <Typography variant="body2">Назначена: {lastAssignment.assignee_name}</Typography>
                    <Stack direction="row" spacing={1} flexWrap="wrap">
                      {lastAssignment.reasons.map((reason) => (
                        <Chip key={reason} size="small" label={reason} />
                      ))}
                    </Stack>
                  </Stack>
                </Paper>
              ) : (
                <Typography variant="body2" color="text.secondary">Пока нет данных.</Typography>
              )}

              <Typography variant="subtitle2">Команда</Typography>
              <Stack spacing={1}>
                {participantsView.map((participant) => (
                  <Paper key={participant.id} sx={{ p: 1.5, borderRadius: 2, bgcolor: '#f8fafc' }}>
                    <Stack spacing={0.75}>
                      <Stack direction="row" justifyContent="space-between" alignItems="center">
                        <Typography variant="body2" sx={{ fontWeight: 600 }}>{participant.full_name}</Typography>
                        <Typography variant="body2">{participant.load_percent}%</Typography>
                      </Stack>
                      <Typography variant="caption" color={participant.is_online ? 'success.main' : 'text.secondary'}>
                        {participant.is_online ? 'Онлайн' : 'Офлайн'}
                      </Typography>
                      <Typography variant="body2" color="text.secondary">
                        Активных: {participant.active_tasks} · Выполнено: {participant.completed_tasks}
                      </Typography>
                    </Stack>
                  </Paper>
                ))}
              </Stack>

              <Typography variant="subtitle2">Нагрузка участников</Typography>
              <Stack spacing={1}>
                {participantsView.map((participant) => (
                  <Paper key={`load-${participant.id}`} sx={{ p: 1.5, borderRadius: 2, bgcolor: '#f8fafc' }}>
                    <Typography variant="body2" sx={{ fontWeight: 600 }}>{participant.full_name}</Typography>
                    <Box sx={{ mt: 1, height: 8, borderRadius: 999, bgcolor: alpha(theme.palette.primary.main, 0.12), overflow: 'hidden' }}>
                      <Box sx={{ width: `${Math.min(100, participant.load_percent)}%`, height: '100%', bgcolor: participant.load_percent > 80 ? '#dc2626' : '#2563eb' }} />
                    </Box>
                  </Paper>
                ))}
              </Stack>

              <Typography variant="subtitle2">История распределения</Typography>
              <Stack spacing={1}>
                {history.length ? history.map((item) => (
                  <Paper key={`${item.timestamp}-${item.task_id}`} sx={{ p: 1.25, borderRadius: 2, bgcolor: '#f8fafc' }}>
                    <Typography variant="caption" color="text.secondary">{formatTimeLabel(item.timestamp)}</Typography>
                    <Typography variant="body2">{item.message}</Typography>
                  </Paper>
                )) : (
                  <Typography variant="body2" color="text.secondary">История появится после первых назначений.</Typography>
                )}
              </Stack>
            </Stack>
          </Stack>
        </Box>
      </Drawer>

      <Drawer
        anchor="right"
        open={deviceSettingsOpen}
        onClose={() => setDeviceSettingsOpen(false)}
        PaperProps={{ sx: { width: 'min(100vw - 16px, 380px)', m: 1, borderRadius: 3, zIndex: 1405, overflowY: 'auto' } }}
      >
        <Box sx={{ p: 2 }}>
          <Typography variant="h6">Настройки устройств</Typography>
          <Stack spacing={1.5} sx={{ mt: 2 }}>
            <Button variant="outlined" onClick={() => onJoinPreferencesChange({ audioEnabled: !joinPreferences.audioEnabled })}>Микрофон: {joinPreferences.audioEnabled ? 'вкл' : 'выкл'}</Button>
            <Button variant="outlined" onClick={() => onJoinPreferencesChange({ videoEnabled: !joinPreferences.videoEnabled })}>Камера: {joinPreferences.videoEnabled ? 'вкл' : 'выкл'}</Button>
          </Stack>
        </Box>
      </Drawer>

      <Alert
        severity="success"
        onClose={() => setNotification('')}
        sx={{
          position: 'fixed',
          bottom: 16,
          left: '50%',
          transform: notification ? 'translateX(-50%)' : 'translate(-50%, 200%)',
          opacity: notification ? 1 : 0,
          pointerEvents: notification ? 'auto' : 'none',
          transition: 'all 180ms ease',
          zIndex: 1600,
        }}
      >
        {notification}
      </Alert>
    </Box>
  );
}
