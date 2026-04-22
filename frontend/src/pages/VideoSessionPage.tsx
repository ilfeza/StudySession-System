import { Box, Button, Paper, Stack, Typography } from '@mui/material';
import { alpha } from '@mui/material/styles';
import { LiveKitRoom } from '@livekit/components-react';
import '@livekit/components-styles';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { AudioCaptureOptions, MediaDeviceFailure, VideoCaptureOptions } from 'livekit-client';
import { Navigate, useNavigate, useParams } from 'react-router-dom';

import { api } from '../api/client';
import { DeviceSetupScreen } from './video-session/DeviceSetupScreen';
import { MeetingRoomScreen } from './video-session/MeetingRoomScreen';
import { SessionSummaryDialog } from './video-session/SessionSummaryDialog';
import { defaultJoinPreferences, type JoinPreferences, type TokenResponse } from './video-session/types';
import { getErrorMessage, getLivekitServerUrl, optionalDeviceId } from './video-session/utils';

export function VideoSessionPage() {
  const { sessionId } = useParams();
  const navigate = useNavigate();
  const [tokenData, setTokenData] = useState<TokenResponse | null>(null);
  const [pageError, setPageError] = useState('');
  const [roomError, setRoomError] = useState('');
  const [joinConfig, setJoinConfig] = useState<JoinPreferences | null>(null);
  const [summaryOpen, setSummaryOpen] = useState(false);
  const [preferences, setPreferences] = useState<JoinPreferences>(defaultJoinPreferences);
  const [inMeetingMediaWarning, setInMeetingMediaWarning] = useState('');
  const roomJoinedRef = useRef(false);
  const roomOptions = useMemo(
    () => ({
      adaptiveStream: true,
      dynacast: true,
      /**
       * livekit-client по умолчанию ходит на `/rtc/v1` (singlePeerConnection: true).
       * Образ `livekit/livekit-server:v1.8` отвечает на этом пути 404 (см. nginx: GET /livekit/rtc/v1 -> 404),
       * из-за этого валится сигналинг/ICE и в UI "Предыдущее подключение...".
       * Режим v0 (`/rtc`) включается при singlePeerConnection: false — см. Room.connectSignal -> engine.join(..., !singlePeerConnection).
       */
      singlePeerConnection: false,
    }),
    [],
  );

  const handleLiveKitConnected = useCallback(() => {
    roomJoinedRef.current = true;
  }, []);

  const handleLiveKitDisconnected = useCallback(() => {
    const wasJoined = roomJoinedRef.current;
    roomJoinedRef.current = false;
    setInMeetingMediaWarning('');
    setJoinConfig(null);
    if (wasJoined) {
      setSummaryOpen(true);
    }
  }, []);

  const handleLiveKitError = useCallback((error: unknown) => {
    const message = getErrorMessage(error);
    setRoomError(message);
    if (roomJoinedRef.current) {
      setInMeetingMediaWarning(message);
      return;
    }
    setJoinConfig(null);
  }, []);

  const handleMediaDeviceFailure = useCallback((failure?: MediaDeviceFailure, kind?: MediaDeviceKind) => {
    const deviceLabel = kind === 'videoinput' ? 'камере' : kind === 'audioinput' ? 'микрофоне' : 'устройстве';
    const detail = failure !== undefined ? ` (${failure})` : '';
    setInMeetingMediaWarning(
      `Не удалось переключить ${deviceLabel}${detail}. Закройте другие вкладки с камерой и попробуйте снова.`,
    );
  }, []);

  const handleTrackDeviceError = useCallback((message: string) => {
    setInMeetingMediaWarning(message || 'Не удалось получить доступ к устройству.');
  }, []);

  const microphoneCaptureDefaults = useMemo((): AudioCaptureOptions => {
    const device = optionalDeviceId(joinConfig?.audioDeviceId ?? '');
    return {
      echoCancellation: true,
      noiseSuppression: true,
      ...(device ? { deviceId: device } : {}),
    };
  }, [joinConfig?.audioDeviceId]);

  const cameraCaptureDefaults = useMemo((): VideoCaptureOptions => {
    const device = optionalDeviceId(joinConfig?.videoDeviceId ?? '');
    return device ? { deviceId: device } : {};
  }, [joinConfig?.videoDeviceId]);

  const liveKitAudio = useMemo((): boolean | AudioCaptureOptions => {
    if (!joinConfig?.audioEnabled) {
      return false;
    }
    return microphoneCaptureDefaults;
  }, [joinConfig?.audioEnabled, microphoneCaptureDefaults]);

  /** Для системной камеры — `true`, как в предпросмотре: без жёсткого 1280x720 (на части ноутбуков ломает трек). */
  const liveKitVideo = useMemo((): boolean | VideoCaptureOptions => {
    if (!joinConfig?.videoEnabled) {
      return false;
    }
    if (!joinConfig.videoDeviceId || joinConfig.videoDeviceId === 'default') {
      return true;
    }
    return cameraCaptureDefaults;
  }, [joinConfig?.videoEnabled, joinConfig?.videoDeviceId, cameraCaptureDefaults]);

  useEffect(() => {
    if (!sessionId) {
      return undefined;
    }

    let isActive = true;
    setTokenData(null);
    setPageError('');
    setRoomError('');
    setJoinConfig(null);

    api.get<TokenResponse>(`/sessions/${sessionId}/token`)
      .then((response) => {
        if (isActive) {
          setTokenData(response.data);
        }
      })
      .catch((error: unknown) => {
        if (isActive) {
          setPageError(getErrorMessage(error));
        }
      });

    return () => {
      isActive = false;
    };
  }, [sessionId]);

  if (!sessionId) {
    return <Navigate to="/groups" replace />;
  }

  if (!tokenData && !pageError) {
    return (
      <Box
        sx={{
          minHeight: '100vh',
          display: 'grid',
          placeItems: 'center',
          textAlign: 'center',
          px: 3,
          background: 'radial-gradient(circle at top left, #203868 0%, #08111f 42%, #04070f 100%)',
        }}
      >
        <Stack spacing={1.25}>
          <Typography variant="h4" fontWeight={800} color="#ffffff">
            Подключаем комнату
          </Typography>
          <Typography sx={{ color: alpha('#ffffff', 0.72) }}>
            Загружаем параметры видеосессии и подготавливаем экран проверки устройств.
          </Typography>
        </Stack>
      </Box>
    );
  }

  if (pageError && !tokenData) {
    return (
      <Box
        sx={{
          minHeight: '100vh',
          display: 'grid',
          placeItems: 'center',
          px: 2,
          background: 'radial-gradient(circle at top left, #203868 0%, #08111f 42%, #04070f 100%)',
        }}
      >
        <Paper
          sx={{
            maxWidth: 520,
            p: 3,
            borderRadius: 5,
            color: '#ffffff',
            background: alpha('#08111f', 0.9),
            border: `1px solid ${alpha('#ffffff', 0.08)}`,
          }}
        >
          <Stack spacing={2}>
            <Typography variant="h4" fontWeight={800}>Не удалось открыть видеосессию</Typography>
            <Typography sx={{ color: alpha('#ffffff', 0.76) }}>{pageError}</Typography>
            <Button variant="contained" onClick={() => navigate('/groups')}>
              Вернуться к группам
            </Button>
          </Stack>
        </Paper>
      </Box>
    );
  }

  if (!tokenData) {
    return null;
  }

  return joinConfig ? (
    <LiveKitRoom
      token={tokenData.token}
      serverUrl={getLivekitServerUrl()}
      connect
      audio={liveKitAudio}
      video={liveKitVideo}
      options={roomOptions}
      onConnected={handleLiveKitConnected}
      onDisconnected={handleLiveKitDisconnected}
      onError={handleLiveKitError}
      onMediaDeviceFailure={handleMediaDeviceFailure}
    >
      <MeetingRoomScreen
        sessionId={Number(sessionId)}
        roomName={tokenData.room_name}
        participantName={tokenData.participant_name}
        canControlStage={Boolean(tokenData.can_control_stage)}
        onBack={() => setJoinConfig(null)}
        mediaWarning={inMeetingMediaWarning}
        onDismissMediaWarning={() => setInMeetingMediaWarning('')}
        microphoneCaptureOptions={microphoneCaptureDefaults}
        cameraCaptureOptions={cameraCaptureDefaults}
        onTrackDeviceError={handleTrackDeviceError}
      />
    </LiveKitRoom>
  ) : (
    <>
      <DeviceSetupScreen
        tokenData={tokenData}
        roomError={roomError}
        preferences={preferences}
        onPreferencesChange={(patch) => setPreferences((prev) => ({ ...prev, ...patch }))}
        onJoin={(config) => {
          setRoomError('');
          setInMeetingMediaWarning('');
          setSummaryOpen(false);
          setJoinConfig(config);
        }}
        onBack={() => navigate('/groups')}
      />
      <SessionSummaryDialog
        open={summaryOpen}
        sessionId={Number(sessionId)}
        autoFocusReminder
        onClose={() => setSummaryOpen(false)}
      />
    </>
  );
}
