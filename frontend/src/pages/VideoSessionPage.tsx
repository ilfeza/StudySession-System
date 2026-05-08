import { Box, Button, Paper, Stack, Typography } from '@mui/material';
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
    const deviceLabel = kind === 'videoinput' ? 'камеру' : kind === 'audioinput' ? 'микрофон' : 'устройство';
    const detail = failure !== undefined ? ` (${failure})` : '';
    setInMeetingMediaWarning(`Не удалось переключить ${deviceLabel}${detail}. Закройте другие вкладки с доступом к устройству и попробуйте снова.`);
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
      <Box sx={{ minHeight: '100vh', display: 'grid', placeItems: 'center', px: 3 }}>
        <Stack spacing={1.25} textAlign="center">
          <Typography variant="h4">Подключаем комнату</Typography>
          <Typography color="text.secondary">
            Загружаем параметры видеосессии и готовим экран проверки устройств.
          </Typography>
        </Stack>
      </Box>
    );
  }

  if (pageError && !tokenData) {
    return (
      <Box sx={{ minHeight: '100vh', display: 'grid', placeItems: 'center', px: 2 }}>
        <Paper sx={{ maxWidth: 520, p: 4, borderRadius: 3 }}>
          <Stack spacing={2}>
            <Typography variant="h4">Не удалось открыть видеосессию</Typography>
            <Typography color="text.secondary">{pageError}</Typography>
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
        joinPreferences={preferences}
        onJoinPreferencesChange={(patch) => setPreferences((prev) => ({ ...prev, ...patch }))}
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
      <SessionSummaryDialog open={summaryOpen} sessionId={Number(sessionId)} autoFocusReminder onClose={() => setSummaryOpen(false)} />
    </>
  );
}
