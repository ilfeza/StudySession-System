import ArrowBackRoundedIcon from '@mui/icons-material/ArrowBackRounded';
import AssignmentTurnedInRoundedIcon from '@mui/icons-material/AssignmentTurnedInRounded';
import CallEndRoundedIcon from '@mui/icons-material/CallEndRounded';
import ChatRoundedIcon from '@mui/icons-material/ChatRounded';
import DashboardCustomizeRoundedIcon from '@mui/icons-material/DashboardCustomizeRounded';
import LibraryBooksRoundedIcon from '@mui/icons-material/LibraryBooksRounded';
import MicOffRoundedIcon from '@mui/icons-material/MicOffRounded';
import MicRoundedIcon from '@mui/icons-material/MicRounded';
import PeopleRoundedIcon from '@mui/icons-material/PeopleRounded';
import PresentToAllRoundedIcon from '@mui/icons-material/PresentToAllRounded';
import TipsAndUpdatesRoundedIcon from '@mui/icons-material/TipsAndUpdatesRounded';
import VideocamOffRoundedIcon from '@mui/icons-material/VideocamOffRounded';
import VideocamRoundedIcon from '@mui/icons-material/VideocamRounded';
import WidgetsRoundedIcon from '@mui/icons-material/WidgetsRounded';
import {
  Alert,
  Box,
  Button,
  Chip,
  Drawer,
  Paper,
  Snackbar,
  Stack,
  Tab,
  Tabs,
  Typography,
  useMediaQuery,
  useTheme,
} from '@mui/material';
import { alpha } from '@mui/material/styles';
import { useDisconnectButton, useParticipants, useTrackToggle } from '@livekit/components-react';
import { useEffect, useMemo, useState, type ButtonHTMLAttributes, type ReactNode } from 'react';
import type { AudioCaptureOptions, VideoCaptureOptions } from 'livekit-client';
import { Track } from 'livekit-client';

import { api } from '../../api/client';
import { ChatPanel } from '../../components/ChatPanel';
import { VideoGrid } from '../../components/VideoGrid';
import { MaterialsPanel } from '../../components/materials/MaterialsPanel';
import { TaskPanel } from '../../components/tasks/TaskPanel';
import { WidgetsPanel } from '../../components/widgets/WidgetsPanel';
import { formatMMSS } from '../../components/widgets/pomodoroTime';
import { useWidgetsSocket } from '../../components/widgets/useWidgetsSocket';
import type { ChatMessage, SessionTask, VideoSessionRoom } from '../../types';
import type { SessionStage } from '../../types/pomodoro';
import { formatRoomName } from './utils';

type SideTab = 'chat' | 'widgets' | 'materials';
type MainView = 'meeting' | 'kanban';

function CallControlButton({
  icon,
  label,
  buttonProps,
  active = false,
  danger = false,
}: {
  icon: ReactNode;
  label: string;
  buttonProps?: ButtonHTMLAttributes<HTMLButtonElement>;
  active?: boolean;
  danger?: boolean;
}) {
  const backgroundColor = danger
    ? '#ef4444'
    : active
      ? alpha('#3384ff', 0.24)
      : alpha('#ffffff', 0.08);

  return (
    <Box
      component="button"
      type="button"
      {...buttonProps}
      aria-label={label}
      title={label}
      sx={{
        width: 56,
        height: 56,
        borderRadius: 3.5,
        color: '#ffffff',
        backgroundColor,
        border: `1px solid ${danger ? alpha('#ef4444', 0.7) : alpha('#ffffff', 0.08)}`,
        backdropFilter: 'blur(18px)',
        '&:hover': {
          backgroundColor: danger ? '#dc2626' : active ? alpha('#3384ff', 0.34) : alpha('#ffffff', 0.14),
        },
        '&:disabled': {
          color: alpha('#ffffff', 0.4),
          backgroundColor: alpha('#ffffff', 0.04),
        },
      }}
    >
      {icon}
    </Box>
  );
}

function MeetingParticipantsDrawer({ open, onClose }: { open: boolean; onClose: () => void }) {
  const participants = useParticipants();

  return (
    <Drawer
      anchor="right"
      open={open}
      onClose={onClose}
      PaperProps={{
        sx: {
          width: '100%',
          maxWidth: 380,
          p: 2,
          background: '#08111f',
          color: '#f8fbff',
        },
      }}
    >
      <Typography variant="h6" fontWeight={800} sx={{ mb: 2 }}>
        Все участники ({participants.length})
      </Typography>
      <Stack spacing={1.25}>
        {participants.map((participant) => (
          <Paper
            key={participant.identity}
            sx={{
              p: 1.5,
              borderRadius: 3,
              background: alpha('#162744', 0.92),
              border: `1px solid ${alpha('#ffffff', 0.08)}`,
              color: '#ffffff',
            }}
          >
            <Typography fontWeight={700}>
              {participant.name && participant.name.trim() ? participant.name : `Участник ${participant.identity}`}
            </Typography>
            {participant.isLocal ? (
              <Typography variant="caption" sx={{ color: alpha('#ffffff', 0.65) }}>
                Вы
              </Typography>
            ) : null}
          </Paper>
        ))}
      </Stack>
    </Drawer>
  );
}

function MeetingControls({
  chatOpen,
  onChatToggle,
  onWidgetsToggle,
  materialsOpen,
  onMaterialsToggle,
  participantsOpen,
  onParticipantsToggle,
  microphoneCaptureOptions,
  cameraCaptureOptions,
  onTrackDeviceError,
}: {
  chatOpen: boolean;
  onChatToggle: () => void;
  onWidgetsToggle: () => void;
  materialsOpen: boolean;
  onMaterialsToggle: () => void;
  participantsOpen: boolean;
  onParticipantsToggle: () => void;
  microphoneCaptureOptions: AudioCaptureOptions;
  cameraCaptureOptions: VideoCaptureOptions;
  onTrackDeviceError: (message: string) => void;
}) {
  const microphone = useTrackToggle({
    source: Track.Source.Microphone,
    captureOptions: microphoneCaptureOptions,
    onDeviceError: (error) => onTrackDeviceError(error.message),
  });
  const camera = useTrackToggle({
    source: Track.Source.Camera,
    captureOptions: cameraCaptureOptions,
    onDeviceError: (error) => onTrackDeviceError(error.message),
  });
  const screenShare = useTrackToggle({ source: Track.Source.ScreenShare });
  const { buttonProps: leaveButtonProps } = useDisconnectButton({ stopTracks: true });

  return (
    <Stack
      direction="row"
      spacing={1.25}
      sx={{
        position: 'absolute',
        left: '50%',
        bottom: { xs: 16, md: 24 },
        transform: 'translateX(-50%)',
        p: 1.25,
        borderRadius: 5,
        background: alpha('#050913', 0.72),
        border: `1px solid ${alpha('#ffffff', 0.08)}`,
        backdropFilter: 'blur(20px)',
        boxShadow: '0 18px 40px rgba(0, 0, 0, 0.34)',
      }}
    >
      <CallControlButton icon={microphone.enabled ? <MicRoundedIcon /> : <MicOffRoundedIcon />} label="Микрофон" buttonProps={microphone.buttonProps} active={microphone.enabled} />
      <CallControlButton icon={camera.enabled ? <VideocamRoundedIcon /> : <VideocamOffRoundedIcon />} label="Камера" buttonProps={camera.buttonProps} active={camera.enabled} />
      <CallControlButton icon={<PresentToAllRoundedIcon />} label="Показ экрана" buttonProps={screenShare.buttonProps} active={screenShare.enabled} />
      <CallControlButton icon={<PeopleRoundedIcon />} label="Участники" buttonProps={{ onClick: onParticipantsToggle }} active={participantsOpen} />
      <CallControlButton icon={<ChatRoundedIcon />} label="Чат" buttonProps={{ onClick: onChatToggle }} active={chatOpen} />
      <CallControlButton icon={<WidgetsRoundedIcon />} label="Виджеты" buttonProps={{ onClick: onWidgetsToggle }} />
      <CallControlButton icon={<LibraryBooksRoundedIcon />} label="Материалы" buttonProps={{ onClick: onMaterialsToggle }} active={materialsOpen} />
      <CallControlButton icon={<CallEndRoundedIcon />} label="Покинуть встречу" buttonProps={leaveButtonProps} danger />
    </Stack>
  );
}

const templateLabels: Record<string, string> = {
  exam_prep: 'Подготовка к экзамену',
  team_project: 'Командный проект',
  topic_review: 'Разбор темы',
};

const stageOrder: SessionStage[] = ['discussion', 'work', 'summary'];

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
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('lg'));
  const [sidePanelOpen, setSidePanelOpen] = useState(false);
  const [sideTab, setSideTab] = useState<SideTab>('chat');
  const [participantsOpen, setParticipantsOpen] = useState(false);
  const [mainView, setMainView] = useState<MainView>('meeting');
  const [sessionRoom, setSessionRoom] = useState<VideoSessionRoom | null>(null);
  const [tasks, setTasks] = useState<SessionTask[]>([]);
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([]);
  const [taskCreateKey, setTaskCreateKey] = useState(0);
  const { state: widgetsState, send: sendWidgetEvent, clearToast } = useWidgetsSocket(sessionId);
  const stage = widgetsState.stage?.current_stage;
  const [nowMs, setNowMs] = useState(() => Date.now());
  const [serverOffsetMs, setServerOffsetMs] = useState<number | null>(null);

  useEffect(() => {
    const id = window.setInterval(() => setNowMs(Date.now()), 250);
    return () => window.clearInterval(id);
  }, []);

  useEffect(() => {
    api.get<VideoSessionRoom>(`/sessions/${sessionId}`).then((response) => setSessionRoom(response.data)).catch(() => null);
    api.get<SessionTask[]>(`/tasks?roomId=${sessionId}`).then((response) => setTasks(response.data)).catch(() => null);
    api.get<ChatMessage[]>(`/chat/history/${sessionId}`).then((response) => setChatMessages(response.data)).catch(() => null);
  }, [sessionId, taskCreateKey, mainView]);

  useEffect(() => {
    const serverTimeMs = widgetsState.stage?.timing.server_time_ms;
    if (!serverTimeMs) {
      return;
    }
    setServerOffsetMs(Date.now() - serverTimeMs);
  }, [widgetsState.stage?.timing.server_time_ms]);

  const stageElapsed = useMemo(() => {
    const snapshot = widgetsState.stage;
    if (!snapshot) {
      return null;
    }
    const offset = serverOffsetMs ?? 0;
    const serverNow = nowMs - offset;
    return Math.max(0, Math.floor((serverNow - snapshot.timing.stage_started_at_ms) / 1000));
  }, [nowMs, serverOffsetMs, widgetsState.stage]);

  const stageUi = useMemo(() => {
    const value: SessionStage | null = stage ?? null;
    if (value === 'discussion') {
      return { label: 'Обсуждение', color: '#9ec3ff', bg: alpha('#3384ff', 0.16), border: alpha('#3384ff', 0.28) };
    }
    if (value === 'work') {
      return { label: 'Работа', color: '#92f2ba', bg: alpha('#22c55e', 0.14), border: alpha('#22c55e', 0.26) };
    }
    if (value === 'summary') {
      return { label: 'Подведение итогов', color: '#ffd38a', bg: alpha('#f59e0b', 0.14), border: alpha('#f59e0b', 0.26) };
    }
    return { label: 'Этап не задан', color: alpha('#ffffff', 0.72), bg: alpha('#ffffff', 0.06), border: alpha('#ffffff', 0.12) };
  }, [stage]);

  const sessionDurationMinutes = useMemo(() => {
    if (!sessionRoom?.starts_at) {
      return 0;
    }
    return Math.max(0, Math.floor((Date.now() - new Date(sessionRoom.starts_at).getTime()) / 60000));
  }, [sessionRoom?.starts_at, nowMs]);

  const summaryHintVisible = sessionDurationMinutes > 60 && stage !== 'summary';
  const emptyTasksHintVisible = tasks.length === 0;

  function openSideTab(tab: SideTab) {
    setMainView('meeting');
    setParticipantsOpen(false);
    setSideTab(tab);
    setSidePanelOpen((prev) => (sideTab === tab ? !prev : true));
  }

  function handleQuickCreateTask() {
    setMainView('kanban');
    setParticipantsOpen(false);
    setSidePanelOpen(false);
    setTaskCreateKey((prev) => prev + 1);
  }

  function handleQuickAddMaterial() {
    openSideTab('materials');
  }

  function handleFinishStage() {
    if (stage === 'summary') {
      sendWidgetEvent({ event: 'stage_set', payload: { stage: 'summary' } });
      return;
    }
    const currentIndex = stage ? stageOrder.indexOf(stage) : -1;
    const nextStage = stageOrder[Math.min(currentIndex + 1, stageOrder.length - 1)];
    sendWidgetEvent({ event: 'stage_set', payload: { stage: nextStage } });
  }

  return (
    <Box
      sx={{
        minHeight: '100vh',
        px: { xs: 2, md: 3 },
        py: { xs: 2, md: 3 },
        background: 'radial-gradient(circle at top left, #203868 0%, #08111f 38%, #04070f 100%)',
      }}
    >
      <Stack spacing={2.5}>
        {mediaWarning ? (
          <Alert severity="warning" onClose={onDismissMediaWarning} sx={{ borderRadius: 3 }}>
            {mediaWarning}
          </Alert>
        ) : null}

        {summaryHintVisible ? (
          <Alert
            severity="info"
            icon={<TipsAndUpdatesRoundedIcon />}
            action={<Button color="inherit" size="small" onClick={handleFinishStage}>Перейти к итогам</Button>}
            sx={{ borderRadius: 3 }}
          >
            Сессия идёт больше 60 минут. Рекомендуем подвести итоги и зафиксировать следующие шаги.
          </Alert>
        ) : null}

        <Button
          onClick={onBack}
          startIcon={<ArrowBackRoundedIcon />}
          sx={{
            alignSelf: 'flex-start',
            color: '#dce8ff',
            px: 0,
            '&:hover': { backgroundColor: 'transparent', color: '#ffffff' },
          }}
        >
          Вернуться к подготовке
        </Button>

        <Box
          sx={{
            display: 'grid',
            gap: 2.5,
            alignItems: 'stretch',
            gridTemplateColumns: mainView === 'meeting'
              ? { xs: '1fr', lg: 'minmax(0, 1.5fr) minmax(320px, 420px)' }
              : '1fr',
          }}
        >
          <Stack spacing={2}>
            <Paper
              sx={{
                position: 'relative',
                minHeight: { xs: 420, md: 620 },
                overflow: 'hidden',
                borderRadius: 6,
                background: 'linear-gradient(160deg, #162237 0%, #08111f 55%, #050913 100%)',
                border: `1px solid ${alpha('#ffffff', 0.08)}`,
                boxShadow: '0 32px 80px rgba(0, 0, 0, 0.42)',
              }}
            >
              {mainView === 'meeting' ? (
                <>
                  <VideoGrid />
                  <Box
                    sx={{
                      position: 'absolute',
                      inset: 0,
                      background: 'linear-gradient(180deg, rgba(4, 7, 15, 0.02) 0%, rgba(4, 7, 15, 0.42) 100%)',
                      pointerEvents: 'none',
                    }}
                  />
                  <Stack
                    spacing={0.5}
                    sx={{
                      position: 'absolute',
                      left: 20,
                      right: 20,
                      bottom: 104,
                      p: 2,
                      borderRadius: 4,
                      color: '#ffffff',
                      background: alpha('#050913', 0.72),
                      border: `1px solid ${alpha('#ffffff', 0.08)}`,
                      backdropFilter: 'blur(18px)',
                      pointerEvents: 'none',
                    }}
                  >
                    <Typography variant="caption" sx={{ color: alpha('#ffffff', 0.65) }}>
                      Видеосессия
                    </Typography>
                    <Typography variant="h6" fontWeight={800}>
                      {sessionRoom?.title || formatRoomName(roomName)}
                    </Typography>
                    <Typography variant="body2" sx={{ color: alpha('#ffffff', 0.78) }}>
                      Вы в комнате как {participantName}
                    </Typography>
                  </Stack>

                  <MeetingControls
                    chatOpen={sidePanelOpen && sideTab === 'chat'}
                    onChatToggle={() => openSideTab('chat')}
                    onWidgetsToggle={() => openSideTab('widgets')}
                    materialsOpen={sidePanelOpen && sideTab === 'materials'}
                    onMaterialsToggle={() => openSideTab('materials')}
                    participantsOpen={participantsOpen}
                    onParticipantsToggle={() => {
                      setParticipantsOpen((prev) => !prev);
                      setSidePanelOpen(false);
                    }}
                    microphoneCaptureOptions={microphoneCaptureOptions}
                    cameraCaptureOptions={cameraCaptureOptions}
                    onTrackDeviceError={onTrackDeviceError}
                  />
                </>
              ) : (
                <Box
                  sx={{
                    height: '100%',
                    p: { xs: 1, md: 1.5 },
                    background: 'linear-gradient(180deg, rgba(6, 12, 22, 0.94) 0%, rgba(3, 8, 15, 0.98) 100%)',
                  }}
                >
                  <Stack spacing={1.5} sx={{ height: '100%' }}>
                    <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1} alignItems={{ xs: 'stretch', sm: 'center' }} justifyContent="space-between">
                      <Stack spacing={0.35}>
                        <Typography variant="h5" fontWeight={900} color="#ffffff">
                          Канбан-доска
                        </Typography>
                        <Typography variant="body2" sx={{ color: alpha('#ffffff', 0.68) }}>
                          Рабочий план видеосессии с быстрым созданием и обновлением задач.
                        </Typography>
                      </Stack>

                      <Button
                        variant="contained"
                        startIcon={<DashboardCustomizeRoundedIcon />}
                        onClick={() => setMainView('meeting')}
                        sx={{
                          alignSelf: { xs: 'stretch', sm: 'center' },
                          borderRadius: 999,
                          fontWeight: 900,
                          textTransform: 'none',
                          color: '#08111f',
                          background: 'linear-gradient(135deg, #7dd3fc 0%, #a7f3d0 100%)',
                        }}
                      >
                        Обратно к видеосессии
                      </Button>
                    </Stack>

                    <Box sx={{ flex: 1, minHeight: 0 }}>
                      <TaskPanel
                        sessionId={sessionId}
                        fullscreen
                        openCreateKey={taskCreateKey}
                        sessionTitle={sessionRoom?.title ?? formatRoomName(roomName)}
                        sessionDescription={sessionRoom?.description ?? ''}
                        chatMessages={chatMessages}
                      />
                    </Box>
                  </Stack>
                </Box>
              )}
            </Paper>
          </Stack>

          {mainView === 'meeting' ? (
            <Paper
              sx={{
                p: 2.25,
                borderRadius: 6,
                color: '#ffffff',
                background: alpha('#08111f', 0.88),
                border: `1px solid ${alpha('#ffffff', 0.08)}`,
                boxShadow: '0 24px 60px rgba(0, 0, 0, 0.28)',
              }}
            >
              <Stack spacing={2}>
                <Box>
                  <Typography variant="overline" sx={{ letterSpacing: 1.2, color: alpha('#ffffff', 0.52) }}>
                    Сессия
                  </Typography>
                  <Typography variant="h5" fontWeight={800}>
                    {sessionRoom?.title || formatRoomName(roomName)}
                  </Typography>
                  <Typography sx={{ mt: 0.75, color: alpha('#ffffff', 0.72) }}>
                    Всё в одной логике с экраном предпросмотра: слева видео, справа управление комнатой.
                  </Typography>
                </Box>

                <Stack direction="row" spacing={1} useFlexGap flexWrap="wrap">
                  {sessionRoom?.template_key ? (
                    <Chip label={templateLabels[sessionRoom.template_key] ?? sessionRoom.template_key} />
                  ) : null}
                  <Chip
                    label={stageUi.label}
                    size="small"
                    sx={{
                      borderRadius: 999,
                      color: stageUi.color,
                      backgroundColor: stageUi.bg,
                      border: `1px solid ${stageUi.border}`,
                      fontWeight: 900,
                    }}
                  />
                </Stack>

                <Paper
                  sx={{
                    p: 1.75,
                    borderRadius: 4,
                    background: alpha('#ffffff', 0.04),
                    border: `1px solid ${alpha('#ffffff', 0.08)}`,
                    color: '#ffffff',
                  }}
                >
                  <Stack spacing={1.25}>
                    <Stack direction="row" justifyContent="space-between" alignItems="center">
                      <Typography fontWeight={700}>Участников в комнате</Typography>
                      <Typography variant="body2" sx={{ color: alpha('#ffffff', 0.72) }}>
                        {participants.length}
                      </Typography>
                    </Stack>
                    <Stack direction="row" justifyContent="space-between" alignItems="center">
                      <Typography fontWeight={700}>Текущий этап</Typography>
                      <Typography variant="body2" sx={{ color: alpha('#ffffff', 0.72) }}>
                        {stageUi.label}
                      </Typography>
                    </Stack>
                    {stageElapsed !== null ? (
                      <Stack direction="row" justifyContent="space-between" alignItems="center">
                        <Typography fontWeight={700}>Длительность этапа</Typography>
                        <Typography variant="body2" sx={{ color: alpha('#ffffff', 0.72) }}>
                          {formatMMSS(stageElapsed)}
                        </Typography>
                      </Stack>
                    ) : null}
                    <Typography variant="body2" sx={{ color: alpha('#ffffff', 0.72) }}>
                      Вы в комнате как {participantName}
                    </Typography>
                  </Stack>
                </Paper>

                <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1.25}>
                  <Button
                    fullWidth
                    variant={mainView === 'meeting' ? 'contained' : 'outlined'}
                    startIcon={<VideocamRoundedIcon />}
                    onClick={() => setMainView('meeting')}
                    sx={{
                      py: 1.2,
                      borderRadius: 4,
                      color: '#ffffff',
                      borderColor: alpha('#ffffff', 0.12),
                      background: mainView === 'meeting'
                        ? 'linear-gradient(135deg, #3384ff 0%, #1d6eff 100%)'
                        : alpha('#ffffff', 0.04),
                    }}
                  >
                    Видеосессия
                  </Button>
                  <Button
                    fullWidth
                    variant={mainView === 'kanban' ? 'contained' : 'outlined'}
                    startIcon={<AssignmentTurnedInRoundedIcon />}
                    onClick={() => {
                      setMainView('kanban');
                      setParticipantsOpen(false);
                      setSidePanelOpen(false);
                    }}
                    sx={{
                      py: 1.2,
                      borderRadius: 4,
                      color: mainView === 'kanban' ? '#08111f' : '#ffffff',
                      borderColor: alpha('#ffffff', 0.12),
                      background: mainView === 'kanban'
                        ? 'linear-gradient(135deg, #a7f3d0 0%, #67e8f9 100%)'
                        : alpha('#ffffff', 0.04),
                    }}
                  >
                    Канбан
                  </Button>
                </Stack>

                <Stack spacing={1}>
                  <Button variant="outlined" onClick={() => openSideTab('chat')} sx={{ justifyContent: 'flex-start', borderRadius: 4, color: '#ffffff', borderColor: alpha('#ffffff', 0.12) }}>
                    Открыть чат
                  </Button>
                  <Button variant="outlined" onClick={() => openSideTab('widgets')} sx={{ justifyContent: 'flex-start', borderRadius: 4, color: '#ffffff', borderColor: alpha('#ffffff', 0.12) }}>
                    Открыть виджеты
                  </Button>
                  <Button variant="outlined" onClick={() => openSideTab('materials')} sx={{ justifyContent: 'flex-start', borderRadius: 4, color: '#ffffff', borderColor: alpha('#ffffff', 0.12) }}>
                    Открыть материалы
                  </Button>
                  <Button variant="outlined" onClick={handleQuickCreateTask} sx={{ justifyContent: 'flex-start', borderRadius: 4, color: '#ffffff', borderColor: alpha('#ffffff', 0.12) }}>
                    Создать задачу
                  </Button>
                  <Button variant="outlined" onClick={handleQuickAddMaterial} sx={{ justifyContent: 'flex-start', borderRadius: 4, color: '#ffffff', borderColor: alpha('#ffffff', 0.12) }}>
                    Добавить материал
                  </Button>
                </Stack>

                <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1}>
                  <Button variant={stage === 'discussion' ? 'contained' : 'outlined'} disabled={!canControlStage} onClick={() => sendWidgetEvent({ event: 'stage_set', payload: { stage: 'discussion' } })} sx={{ borderRadius: 3, fontWeight: 900, ...(stage === 'discussion' ? { background: 'linear-gradient(135deg, #3384ff 0%, #1d6eff 100%)' } : { color: '#ffffff', borderColor: alpha('#ffffff', 0.18), background: alpha('#ffffff', 0.03) }) }}>
                    К обсуждению
                  </Button>
                  <Button variant={stage === 'work' ? 'contained' : 'outlined'} disabled={!canControlStage} onClick={() => sendWidgetEvent({ event: 'stage_set', payload: { stage: 'work' } })} sx={{ borderRadius: 3, fontWeight: 900, ...(stage === 'work' ? { background: 'linear-gradient(135deg, #22c55e 0%, #16a34a 100%)' } : { color: '#ffffff', borderColor: alpha('#ffffff', 0.18), background: alpha('#ffffff', 0.03) }) }}>
                    К работе
                  </Button>
                  <Button variant={stage === 'summary' ? 'contained' : 'outlined'} disabled={!canControlStage} onClick={() => sendWidgetEvent({ event: 'stage_set', payload: { stage: 'summary' } })} sx={{ borderRadius: 3, fontWeight: 900, ...(stage === 'summary' ? { background: 'linear-gradient(135deg, #f59e0b 0%, #d97706 100%)' } : { color: '#ffffff', borderColor: alpha('#ffffff', 0.18), background: alpha('#ffffff', 0.03) }) }}>
                    К итогам
                  </Button>
                </Stack>

                <Button
                  fullWidth
                  variant="contained"
                  disabled={!canControlStage}
                  onClick={handleFinishStage}
                  sx={{
                    py: 1.4,
                    borderRadius: 4.5,
                    fontWeight: 800,
                    background: 'linear-gradient(135deg, #3384ff 0%, #1d6eff 100%)',
                    boxShadow: '0 16px 30px rgba(29, 110, 255, 0.35)',
                  }}
                >
                  Завершить этап
                </Button>

                {emptyTasksHintVisible ? (
                  <Typography variant="body2" sx={{ color: alpha('#ffffff', 0.72) }}>
                    В сессии пока нет задач. Добавьте карточки, чтобы распределить работу команды.
                  </Typography>
                ) : null}
              </Stack>
            </Paper>
          ) : null}
        </Box>

        {!isMobile && mainView === 'meeting' && sidePanelOpen ? (
          <Box sx={{ maxWidth: 420, ml: 'auto', width: '100%' }}>
            <Paper
              sx={{
                p: 1.25,
                borderRadius: 6,
                background: alpha('#050913', 0.85),
                border: `1px solid ${alpha('#ffffff', 0.08)}`,
              }}
            >
              <Tabs
                value={sideTab}
                onChange={(_, next) => setSideTab(next)}
                textColor="inherit"
                indicatorColor="primary"
                sx={{
                  mb: 1.25,
                  '& .MuiTab-root': { color: alpha('#ffffff', 0.75), fontWeight: 900, textTransform: 'none' },
                  '& .Mui-selected': { color: '#ffffff' },
                }}
              >
                <Tab value="chat" label="Чат" />
                <Tab value="widgets" label="Виджеты" />
                <Tab value="materials" label="Материалы" />
              </Tabs>

              {sideTab === 'chat' ? <ChatPanel sessionId={sessionId} variant="session" /> : null}
              {sideTab === 'widgets' ? <WidgetsPanel snapshot={widgetsState.pomodoro} localUserName={participantName} send={sendWidgetEvent} /> : null}
              {sideTab === 'materials' && sessionRoom ? <MaterialsPanel groupId={sessionRoom.group_id} compact /> : null}
            </Paper>
          </Box>
        ) : null}

        <Drawer
          anchor="right"
          open={isMobile && mainView === 'meeting' && sidePanelOpen}
          onClose={() => setSidePanelOpen(false)}
          PaperProps={{ sx: { width: '100%', maxWidth: 380, p: 1.5, background: '#050913' } }}
        >
          <Paper
            sx={{
              height: '100%',
              p: 1.25,
              borderRadius: 6,
              background: alpha('#050913', 0.85),
              border: `1px solid ${alpha('#ffffff', 0.08)}`,
            }}
          >
            <Tabs
              value={sideTab}
              onChange={(_, next) => setSideTab(next)}
              textColor="inherit"
              indicatorColor="primary"
              sx={{
                mb: 1.25,
                '& .MuiTab-root': { color: alpha('#ffffff', 0.75), fontWeight: 900, textTransform: 'none' },
                '& .Mui-selected': { color: '#ffffff' },
              }}
            >
              <Tab value="chat" label="Чат" />
              <Tab value="widgets" label="Виджеты" />
              <Tab value="materials" label="Материалы" />
            </Tabs>

            {sideTab === 'chat' ? <ChatPanel sessionId={sessionId} variant="session" /> : null}
            {sideTab === 'widgets' ? <WidgetsPanel snapshot={widgetsState.pomodoro} localUserName={participantName} send={sendWidgetEvent} /> : null}
            {sideTab === 'materials' && sessionRoom ? <MaterialsPanel groupId={sessionRoom.group_id} compact /> : null}
          </Paper>
        </Drawer>

        <MeetingParticipantsDrawer open={participantsOpen} onClose={() => setParticipantsOpen(false)} />

        <Snackbar open={Boolean(widgetsState.lastStartedToast)} autoHideDuration={4500} onClose={clearToast} anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}>
          <Alert severity="success" variant="filled" onClose={clearToast} sx={{ borderRadius: 3, fontWeight: 800 }}>
            {widgetsState.lastStartedToast?.last_started_by?.name
              ? `${widgetsState.lastStartedToast.last_started_by.name} включил Pomodoro`
              : 'Pomodoro включён'}
          </Alert>
        </Snackbar>
      </Stack>
    </Box>
  );
}
