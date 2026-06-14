import ArrowBackRoundedIcon from '@mui/icons-material/ArrowBackRounded';
import AssignmentTurnedInRoundedIcon from '@mui/icons-material/AssignmentTurnedInRounded';
import InsightsRoundedIcon from '@mui/icons-material/InsightsRounded';
import ViewKanbanRoundedIcon from '@mui/icons-material/ViewKanbanRounded';
import VideocamRoundedIcon from '@mui/icons-material/VideocamRounded';
import TimelapseRoundedIcon from '@mui/icons-material/TimelapseRounded';
import StopCircleRoundedIcon from '@mui/icons-material/StopCircleRounded';
import { useParticipants, useRoomContext } from '@livekit/components-react';
import {
  Alert,
  Box,
  Button,
  Chip,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
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
import { assignNextSessionTask, blockSessionParticipant, skipSessionTask } from '../../api/sessionTasks';
import { useSessionTasks } from '../../components/tasks/useSessionTasks';
import { useAuth } from '../../context/AuthContext';
import { formatMMSS } from '../../components/widgets/pomodoroTime';
import { useWidgetsSocket } from '../../components/widgets/useWidgetsSocket';
import type { ChatMessage, SessionDashboardSnapshot, SessionTask, VideoSessionRoom } from '../../types';
import type { SessionStage } from '../../types/pomodoro';
import { taskStatusLabels } from './sessionIntelligence';
import { DeviceSettingsPanel } from './components/DeviceSettingsPanel';
import { KanbanBoard } from './components/KanbanBoard';
import { ParticipantsPanel } from './components/ParticipantsPanel';
import { SessionStageDurationLabel, SessionStageSwitcher } from './components/SessionStageSwitcher';
import { VideoControls } from './components/VideoControls';
import { VideoGrid } from './components/VideoGrid';
import { formatRoomName, formatShortName } from './utils';
import type { JoinPreferences } from './types';

type SessionTab = 'video' | 'kanban' | 'stages';
type VideoSidePanel = 'chat' | 'participants' | 'settings';

const stageSteps = [
  { key: 'task_creation', label: 'Подготовка' },
  { key: 'task_distribution', label: 'Обсуждение' },
  { key: 'execution', label: 'Выполнение' },
  { key: 'review', label: 'Завершение' },
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
  const room = useRoomContext();
  const { user } = useAuth();
  const participants = useParticipants();
  const controller = useSessionTasks(sessionId);
  const { state: widgetsState, send: sendWidgetEvent, clearError } = useWidgetsSocket(sessionId);
  const [sessionRoom, setSessionRoom] = useState<VideoSessionRoom | null>(null);
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([]);
  const [activeTab, setActiveTab] = useState<SessionTab>('video');
  const [selectedTask, setSelectedTask] = useState<SessionTask | null>(null);
  const [sidePanel, setSidePanel] = useState<VideoSidePanel | null>(null);
  const [analyticsOpen, setAnalyticsOpen] = useState(false);
  const [nowMs, setNowMs] = useState(() => Date.now());
  const [serverOffsetMs, setServerOffsetMs] = useState<number | null>(null);
  const [notification, setNotification] = useState('');
  const [endSessionOpen, setEndSessionOpen] = useState(false);

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
  const liveParticipantNames = useMemo(
    () => participants.map((participant) => participant.name?.trim().toLowerCase()).filter(Boolean) as string[],
    [participants],
  );
  const stageColor = stageChipColor(stage);

  const activeTasks = controller.tasks.filter((task) => task.status !== 'done');

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
      const stageKey = task.created_in_stage || task.workflow_stage || 'task_creation';
      const idx = columns.findIndex((column) => column.key === stageKey);
      const targetIndex = idx >= 0 ? idx : 0;
      columns[targetIndex].tasks.push(task);
    }
    return columns;
  }, [controller.tasks]);

  const stageDurations = useMemo(() => {
    const snapshot = widgetsState.stage;
    if (!snapshot) {
      return {} as Record<string, number>;
    }

    const durations = { ...(snapshot.stage_durations ?? {}) };
    if (!stage) {
      return durations;
    }

    const snapshotElapsed = snapshot.timing.elapsed_s ?? 0;
    durations[stage] = Math.max(0, (durations[stage] ?? 0) - snapshotElapsed + stageElapsed);
    return durations;
  }, [stage, stageElapsed, widgetsState.stage]);

  function handleStageChange(nextStage: SessionStage) {
    if (!canControlStage) {
      return;
    }
    clearError();
    sendWidgetEvent({ event: 'stage_set', payload: { stage: nextStage } });
  }

  async function handleCompleteAndNext(task: SessionTask) {
    const assigneeId = task.assignee_id ?? undefined;
    await controller.patchTask(task.id, { status: 'done' });
    const updated = await assignNextSessionTask(sessionId, assigneeId);
    if (!updated) {
      setSelectedTask(null);
      setNotification('Задача завершена. Новых задач для назначения нет.');
      return;
    }
    setSelectedTask(updated);
    setNotification(`Задача завершена. Следующая: «${updated.title}»`);
  }

  async function handleCompleteTask(task: SessionTask | null) {
    if (!task) return;
    await controller.patchTask(task.id, { status: 'done' });
    setSelectedTask(null);
    setNotification(`Задача «${task.title}» завершена`);
  }

  async function handleSkipTask(task: SessionTask | null) {
    if (!task) return;
    await skipSessionTask(task.id);
    await controller.refreshDashboard();
    setSelectedTask(null);
    setNotification(`Задача «${task.title}» пропущена. Надёжность участника снижена.`);
  }

  async function handleBlockParticipant(participantId: number) {
    await blockSessionParticipant(sessionId, participantId);
    await controller.refreshParticipants();
    await controller.refreshDashboard();
    setNotification('Участник заблокирован в сессии');
  }

  function handleEndSession() {
    setEndSessionOpen(false);
    void room.disconnect();
  }

  const isSessionCreator = sessionRoom?.created_by_id === user?.id;

  const tabs: Array<{ value: SessionTab; label: string; icon: ReactElement }> = [
    { value: 'video', label: 'Видеосессия', icon: <VideocamRoundedIcon fontSize="small" /> },
    { value: 'kanban', label: 'Канбан', icon: <ViewKanbanRoundedIcon fontSize="small" /> },
    { value: 'stages', label: 'Этапы', icon: <AssignmentTurnedInRoundedIcon fontSize="small" /> },
  ];

  function toggleSidePanel(panel: VideoSidePanel) {
    setSidePanel((prev) => (prev === panel ? null : panel));
  }

  const sidePanelOpen = sidePanel !== null && !isMobile;

  return (
    <Box sx={{ height: '100%', display: 'flex', flexDirection: 'column', overflow: 'hidden', bgcolor: '#eef2f7', p: { xs: 1, md: 2 } }}>
      <Stack spacing={1.25} sx={{ flex: 1, minHeight: 0, overflow: 'hidden' }}>
        {mediaWarning ? <Alert severity="warning" onClose={onDismissMediaWarning}>{mediaWarning}</Alert> : null}
        {widgetsState.error ? <Alert severity="error" onClose={clearError}>{widgetsState.error}</Alert> : null}

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
            <Stack direction="row" spacing={1} flexWrap="wrap" justifyContent="flex-end" alignItems="center">
              <Chip label="Аналитика" icon={<InsightsRoundedIcon fontSize="small" />} onClick={() => setAnalyticsOpen(true)} clickable />
              {isSessionCreator ? (
                <Chip
                  label="Завершить сессию"
                  icon={<StopCircleRoundedIcon fontSize="small" />}
                  onClick={() => setEndSessionOpen(true)}
                  clickable
                  sx={{ borderColor: 'error.main', color: 'error.main' }}
                  variant="outlined"
                />
              ) : null}
              <Chip icon={<TimelapseRoundedIcon />} label={stage ? `${stageSteps[stageIndex].label} · ${formatMMSS(stageElapsed)}` : 'Этап не определён'} sx={{ bgcolor: stageColor.bg, color: stageColor.fg }} />
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
                  gridTemplateColumns: sidePanelOpen ? 'minmax(0, 1fr) 360px' : 'minmax(0, 1fr)',
                  height: '100%',
                  minHeight: 0,
                }}
              >
                <Box sx={{ position: 'relative', minHeight: 0, overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
                  <Box sx={{ flex: 1, minHeight: 0, overflow: 'hidden' }}>
                    <VideoGrid
                      chatOpen={sidePanelOpen}
                      participantTasks={Object.fromEntries(
                        Object.entries(participantTasks).map(([userId, task]) => [
                          Number(userId),
                          task ? { title: task.title, description: task.description, status: task.status, deadline: task.deadline ?? null } : undefined,
                        ]),
                      )}
                      onTaskClick={(userId) => {
                        const nextTask = activeTasks.find((task) => task.assignee_id === userId) ?? null;
                        setSelectedTask(nextTask);
                      }}
                    />
                  </Box>

                  <Box sx={{ flexShrink: 0, p: 1.5, zIndex: 2 }}>
                    <VideoControls
                      microphoneCaptureOptions={microphoneCaptureOptions}
                      cameraCaptureOptions={cameraCaptureOptions}
                      onTrackDeviceError={onTrackDeviceError}
                      onParticipantsClick={() => toggleSidePanel('participants')}
                      onChatClick={() => toggleSidePanel('chat')}
                      onSettingsClick={() => toggleSidePanel('settings')}
                      activeSidePanel={sidePanel}
                    />
                  </Box>
                </Box>

                {sidePanelOpen ? (
                  <Box sx={{ minHeight: 0, display: 'flex', flexDirection: 'column', borderLeft: '1px solid rgba(255,255,255,0.08)', bgcolor: '#0f172a' }}>
                    {sidePanel === 'chat' ? <ChatPanel sessionId={sessionId} variant="session" showHeader /> : null}
                    {sidePanel === 'participants' ? (
                      <ParticipantsPanel
                        participants={participantsView}
                        participantTasks={participantTasks}
                        canBlockParticipants={isSessionCreator}
                        currentUserId={user?.id}
                        onParticipantClick={(participantId) => {
                          const nextTask = activeTasks.find((task) => task.assignee_id === participantId) ?? null;
                          setSelectedTask(nextTask);
                        }}
                        onBlockParticipant={(participantId) => void handleBlockParticipant(participantId)}
                      />
                    ) : null}
                    {sidePanel === 'settings' ? (
                      <DeviceSettingsPanel
                        joinPreferences={joinPreferences}
                        onJoinPreferencesChange={onJoinPreferencesChange}
                      />
                    ) : null}
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
                  </Box>
                  <SessionStageSwitcher currentStage={stage} onStageChange={handleStageChange} disabled={!canControlStage} />
                  <Box
                    sx={{
                      display: 'grid',
                      gap: 1.5,
                      gridTemplateColumns: { xs: '1fr', md: 'repeat(4, minmax(0, 1fr))' },
                      alignItems: 'start',
                    }}
                  >
                    {stageColumns.map((column) => (
                      <Paper
                        key={column.key}
                        sx={{
                          p: 1.5,
                          borderRadius: 3,
                          bgcolor: stage === column.key ? alpha('#2563eb', 0.06) : '#f8fafc',
                          minHeight: 220,
                          border: '1px solid',
                          borderColor: stage === column.key ? alpha('#2563eb', 0.24) : 'transparent',
                        }}
                      >
                        <Stack spacing={1.25}>
                          <Box>
                            <SessionStageDurationLabel seconds={stageDurations[column.key] ?? 0} />
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
                                    {task.assignee?.full_name ?? 'Без исполнителя'} · {taskStatusLabels[task.status]}
                                  </Typography>
                                </Stack>
                              </Paper>
                            )) : (
                              <Typography variant="body2" color="text.secondary">
                                Пока нет задач
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
                <TextField label="Статус" value={taskStatusLabels[selectedTask.status]} InputProps={{ readOnly: true }} fullWidth />
                <TextField
                  label="Исполнитель"
                  value={selectedTask.assignee?.full_name ?? 'Не назначен'}
                  InputProps={{ readOnly: true }}
                  fullWidth
                />
                <Stack spacing={1}>
                  <Button
                    variant="contained"
                    fullWidth
                    onClick={() => void handleCompleteAndNext(selectedTask)}
                    sx={{ py: 1.1, textTransform: 'none' }}
                  >
                    <Stack spacing={0.25}>
                      <span>Получить следующую задачу</span>
                      {selectedTask.assignee?.full_name ? (
                        <Typography component="span" variant="caption" sx={{ opacity: 0.9 }}>
                          {formatShortName(selectedTask.assignee.full_name)}
                        </Typography>
                      ) : null}
                    </Stack>
                  </Button>
                  <Button variant="outlined" fullWidth onClick={() => void handleCompleteTask(selectedTask)}>
                    Завершить задачу
                  </Button>
                  <Button variant="outlined" color="warning" fullWidth onClick={() => void handleSkipTask(selectedTask)} disabled={selectedTask.assignee_id !== user?.id}>
                    Пропустить
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
            </Box>
            <Divider />
            <Stack spacing={1.5}>
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

              <Typography variant="subtitle2">Надёжность участников</Typography>
              <Stack spacing={1}>
                {participantsView.map((participant) => (
                  <Paper key={`reliability-${participant.id}`} sx={{ p: 1.5, borderRadius: 2, bgcolor: '#f8fafc' }}>
                    <Stack direction="row" justifyContent="space-between" alignItems="center">
                      <Typography variant="body2" sx={{ fontWeight: 600 }}>{participant.full_name}</Typography>
                      <Typography variant="body2" sx={{ fontWeight: 700 }}>
                        {Math.round(participant.reliability_score * 100)}%
                      </Typography>
                    </Stack>
                    <Box sx={{ mt: 1, height: 8, borderRadius: 999, bgcolor: alpha('#16a34a', 0.12), overflow: 'hidden' }}>
                      <Box
                        sx={{
                          width: `${Math.min(100, Math.round(participant.reliability_score * 100))}%`,
                          height: '100%',
                          bgcolor: participant.reliability_score >= 0.7 ? '#16a34a' : participant.reliability_score >= 0.5 ? '#f59e0b' : '#dc2626',
                        }}
                      />
                    </Box>
                  </Paper>
                ))}
              </Stack>

              <Typography variant="subtitle2">История</Typography>
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

      <Dialog open={endSessionOpen} onClose={() => setEndSessionOpen(false)} maxWidth="xs" fullWidth>
        <DialogTitle>Завершить сессию?</DialogTitle>
        <DialogContent>
          <Typography variant="body2" color="text.secondary">
            Сессия будет завершена для всех участников. После этого откроется форма итогов.
          </Typography>
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2 }}>
          <Button onClick={() => setEndSessionOpen(false)}>Отмена</Button>
          <Button variant="contained" color="error" onClick={handleEndSession}>
            Завершить сессию
          </Button>
        </DialogActions>
      </Dialog>

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
