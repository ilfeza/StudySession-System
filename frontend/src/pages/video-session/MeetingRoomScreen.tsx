import ArrowBackRoundedIcon from '@mui/icons-material/ArrowBackRounded';
import ChatBubbleOutlineRoundedIcon from '@mui/icons-material/ChatBubbleOutlineRounded';
import GroupsRoundedIcon from '@mui/icons-material/GroupsRounded';
import TipsAndUpdatesRoundedIcon from '@mui/icons-material/TipsAndUpdatesRounded';
import { Alert, Avatar, Box, Button, Chip, Drawer, Paper, Snackbar, Stack, Typography } from '@mui/material';
import { alpha } from '@mui/material/styles';
import { useParticipants } from '@livekit/components-react';
import { useEffect, useMemo, useState } from 'react';
import type { AudioCaptureOptions, VideoCaptureOptions } from 'livekit-client';

import { api } from '../../api/client';
import { ChatPanel } from '../../components/ChatPanel';
import { formatMMSS } from '../../components/widgets/pomodoroTime';
import { useWidgetsSocket } from '../../components/widgets/useWidgetsSocket';
import type { ChatMessage, VideoSessionRoom } from '../../types';
import type { SessionStage } from '../../types/pomodoro';
import { KanbanBoard } from './components/KanbanBoard';
import { TabsNavigation, type SessionView } from './components/TabsNavigation';
import { VideoControls } from './components/VideoControls';
import { VideoGrid } from './components/VideoGrid';
import { formatRoomName } from './utils';

type OverlayView = 'participants' | 'chat' | null;

const templateLabels: Record<string, string> = {
  exam_prep: 'Подготовка к экзамену',
  team_project: 'Командный проект',
  topic_review: 'Разбор темы',
};

const stageLabels: Record<SessionStage, string> = {
  discussion: 'Обсуждение',
  work: 'Работа',
  summary: 'Итоги',
};

const stageOrder: SessionStage[] = ['discussion', 'work', 'summary'];

function getStageTone(stage: SessionStage | null) {
  if (stage === 'discussion') {
    return { background: '#eff6ff', color: '#1d4ed8', border: '#bfdbfe' };
  }
  if (stage === 'work') {
    return { background: '#ecfdf5', color: '#047857', border: '#a7f3d0' };
  }
  if (stage === 'summary') {
    return { background: '#fff7ed', color: '#c2410c', border: '#fed7aa' };
  }
  return { background: '#f8fafc', color: '#475569', border: '#e2e8f0' };
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
            В комнате сейчас {participants.length} {participants.length === 1 ? 'человек' : 'участника'}.
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
  const [activeView, setActiveView] = useState<SessionView>('video');
  const [overlayView, setOverlayView] = useState<OverlayView>(null);
  const [sessionRoom, setSessionRoom] = useState<VideoSessionRoom | null>(null);
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([]);
  const [taskCreateKey, setTaskCreateKey] = useState(0);
  const [nowMs, setNowMs] = useState(() => Date.now());
  const [serverOffsetMs, setServerOffsetMs] = useState<number | null>(null);
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

  const sessionDurationMinutes = useMemo(() => {
    if (!sessionRoom?.starts_at) {
      return 0;
    }
    return Math.max(0, Math.floor((Date.now() - new Date(sessionRoom.starts_at).getTime()) / 60000));
  }, [nowMs, sessionRoom?.starts_at]);

  const summaryHintVisible = sessionDurationMinutes > 60 && stage !== 'summary';

  function handleChangeView(nextView: SessionView) {
    setActiveView(nextView);
    if (nextView !== 'video') {
      setOverlayView(null);
    }
  }

  function handleStageChange(nextStage: SessionStage) {
    sendWidgetEvent({ event: 'stage_set', payload: { stage: nextStage } });
  }

  function handleFinishStage() {
    if (stage === 'summary') {
      handleStageChange('summary');
      return;
    }

    const currentIndex = stage ? stageOrder.indexOf(stage) : -1;
    const nextStage = stageOrder[Math.min(currentIndex + 1, stageOrder.length - 1)];
    handleStageChange(nextStage);
  }

  return (
    <Box sx={{ minHeight: '100vh', backgroundColor: '#f8fafc', px: { xs: 2, md: 3 }, py: { xs: 2, md: 3 } }}>
      <Stack spacing={2.5}>
        {mediaWarning ? (
          <Alert severity="warning" onClose={onDismissMediaWarning}>
            {mediaWarning}
          </Alert>
        ) : null}

        {summaryHintVisible ? (
          <Alert
            severity="info"
            icon={<TipsAndUpdatesRoundedIcon />}
            action={<Button color="inherit" size="small" onClick={handleFinishStage}>Перейти к итогам</Button>}
          >
            Сессия идёт больше часа. Самое время зафиксировать результаты и договориться о следующих шагах.
          </Alert>
        ) : null}

        <Paper sx={{ p: { xs: 2, md: 2.5 }, borderRadius: 4 }}>
          <Stack spacing={2}>
            <Stack direction={{ xs: 'column', lg: 'row' }} justifyContent="space-between" spacing={2} alignItems={{ xs: 'stretch', lg: 'center' }}>
              <Stack spacing={1}>
                <Button
                  onClick={onBack}
                  startIcon={<ArrowBackRoundedIcon />}
                  sx={{ alignSelf: 'flex-start', px: 0, minHeight: 0 }}
                >
                  Вернуться к подготовке
                </Button>
                <Box>
                  <Typography variant="h4">
                    {sessionRoom?.title || formatRoomName(roomName)}
                  </Typography>
                  <Typography variant="body1" color="text.secondary" sx={{ mt: 0.75 }}>
                    Спокойный рабочий интерфейс без боковых панелей: видео, доска и чат доступны по вкладкам.
                  </Typography>
                </Box>
              </Stack>

              <TabsNavigation value={activeView} onChange={handleChangeView} />
            </Stack>

            <Stack direction={{ xs: 'column', xl: 'row' }} spacing={1.25} justifyContent="space-between" alignItems={{ xs: 'stretch', xl: 'center' }}>
              <Stack direction="row" spacing={1} useFlexGap flexWrap="wrap">
                <Chip label={`${participants.length} в комнате`} />
                <Chip label={`Вы как ${participantName}`} />
                {sessionRoom?.template_key ? (
                  <Chip label={templateLabels[sessionRoom.template_key] ?? sessionRoom.template_key} />
                ) : null}
                <Chip
                  label={stage ? stageLabels[stage] : 'Этап не выбран'}
                  sx={{
                    backgroundColor: stageTone.background,
                    color: stageTone.color,
                    borderColor: stageTone.border,
                  }}
                />
                {stageElapsed !== null ? <Chip label={`Этап: ${formatMMSS(stageElapsed)}`} /> : null}
              </Stack>

              {canControlStage ? (
                <Stack direction="row" spacing={1} useFlexGap flexWrap="wrap">
                  {stageOrder.map((item) => (
                    <Button
                      key={item}
                      variant={stage === item ? 'contained' : 'outlined'}
                      onClick={() => handleStageChange(item)}
                    >
                      {stageLabels[item]}
                    </Button>
                  ))}
                </Stack>
              ) : null}
            </Stack>
          </Stack>
        </Paper>

        {activeView === 'video' ? (
          <Stack spacing={2}>
            <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1} justifyContent="space-between" alignItems={{ xs: 'stretch', sm: 'center' }}>
              <Stack spacing={0.5}>
                <Typography variant="h6">Видеосессия</Typography>
                <Typography variant="body2" color="text.secondary">
                  Максимум пространства под участников, быстрые действия вынесены вниз.
                </Typography>
              </Stack>

              <Stack direction="row" spacing={1} useFlexGap flexWrap="wrap">
                <Button startIcon={<GroupsRoundedIcon />} variant="outlined" onClick={() => setOverlayView('participants')}>
                  Участники
                </Button>
                <Button startIcon={<ChatBubbleOutlineRoundedIcon />} variant="outlined" onClick={() => setOverlayView('chat')}>
                  Чат
                </Button>
                <Button
                  variant="contained"
                  onClick={() => {
                    setTaskCreateKey((prev) => prev + 1);
                    setActiveView('kanban');
                  }}
                >
                  Новая задача
                </Button>
              </Stack>
            </Stack>

            <Paper
              sx={{
                position: 'relative',
                minHeight: { xs: 480, md: 'calc(100vh - 300px)' },
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
                  maxWidth: 320,
                  p: 1.5,
                  borderRadius: 3,
                  backgroundColor: alpha('#ffffff', 0.9),
                  backdropFilter: 'blur(12px)',
                  boxShadow: '0 14px 36px rgba(15, 23, 42, 0.08)',
                }}
              >
                <Typography variant="subtitle2">Комната</Typography>
                <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
                  {sessionRoom?.title || formatRoomName(roomName)}
                </Typography>
              </Box>

              <VideoControls
                microphoneCaptureOptions={microphoneCaptureOptions}
                cameraCaptureOptions={cameraCaptureOptions}
                onTrackDeviceError={onTrackDeviceError}
                onParticipantsClick={() => setOverlayView('participants')}
                onChatClick={() => setOverlayView('chat')}
              />
            </Paper>
          </Stack>
        ) : null}

        {activeView === 'kanban' ? (
          <Box sx={{ minHeight: 'calc(100vh - 260px)' }}>
            <KanbanBoard
              sessionId={sessionId}
              openCreateKey={taskCreateKey}
              sessionTitle={sessionRoom?.title ?? formatRoomName(roomName)}
              sessionDescription={sessionRoom?.description ?? ''}
              chatMessages={chatMessages}
            />
          </Box>
        ) : null}

        {activeView === 'chat' ? (
          <Paper sx={{ p: { xs: 2, md: 2.5 }, borderRadius: 4, minHeight: 'calc(100vh - 260px)' }}>
            <ChatPanel sessionId={sessionId} variant="session" />
          </Paper>
        ) : null}

        <ParticipantsDrawer open={overlayView === 'participants'} onClose={() => setOverlayView(null)} />

        <Drawer
          anchor="right"
          open={overlayView === 'chat'}
          onClose={() => setOverlayView(null)}
          PaperProps={{
            sx: {
              width: '100%',
              maxWidth: 400,
              p: 2,
              backgroundColor: '#ffffff',
            },
          }}
        >
          <Paper sx={{ p: 2, borderRadius: 4, height: '100%', minHeight: 0 }}>
            <ChatPanel sessionId={sessionId} variant="session" showHeader={false} />
          </Paper>
        </Drawer>

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
