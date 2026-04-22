import ArrowBackRoundedIcon from '@mui/icons-material/ArrowBackRounded';
import CallEndRoundedIcon from '@mui/icons-material/CallEndRounded';
import ChatRoundedIcon from '@mui/icons-material/ChatRounded';
import WidgetsRoundedIcon from '@mui/icons-material/WidgetsRounded';
import MicOffRoundedIcon from '@mui/icons-material/MicOffRounded';
import MicRoundedIcon from '@mui/icons-material/MicRounded';
import PeopleRoundedIcon from '@mui/icons-material/PeopleRounded';
import PresentToAllRoundedIcon from '@mui/icons-material/PresentToAllRounded';
import VideocamOffRoundedIcon from '@mui/icons-material/VideocamOffRounded';
import VideocamRoundedIcon from '@mui/icons-material/VideocamRounded';
import {
  Alert,
  Box,
  Button,
  Chip,
  Drawer,
  MenuItem,
  Paper,
  Snackbar,
  Stack,
  Tab,
  Tabs,
  TextField,
  Typography,
  useMediaQuery,
  useTheme,
} from '@mui/material';
import { alpha } from '@mui/material/styles';
import {
  LiveKitRoom,
  ParticipantTile,
  RoomAudioRenderer,
  useDisconnectButton,
  useMediaDevices,
  useParticipants,
  useTrackToggle,
  useTracks,
} from '@livekit/components-react';
import '@livekit/components-styles';
import type { ButtonHTMLAttributes, ReactNode } from 'react';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { AudioCaptureOptions, MediaDeviceFailure, VideoCaptureOptions } from 'livekit-client';
import { Track } from 'livekit-client';
import { Navigate, useNavigate, useParams } from 'react-router-dom';

import { api } from '../api/client';
import { ChatPanel } from '../components/ChatPanel';
import { WidgetsPanel } from '../components/widgets/WidgetsPanel';
import { useWidgetsSocket } from '../components/widgets/useWidgetsSocket';
import { PomodoroTile } from '../components/widgets/PomodoroTile';
import type { PomodoroStateSnapshot } from '../types/pomodoro';
import type { SessionStage } from '../types/pomodoro';
import { formatMMSS } from '../components/widgets/pomodoroTime';

interface TokenResponse {
  room_name: string;
  participant_name: string;
  token: string;
  can_control_stage?: boolean;
}

interface JoinPreferences {
  audioEnabled: boolean;
  videoEnabled: boolean;
  audioDeviceId: string;
  videoDeviceId: string;
}

const defaultJoinPreferences: JoinPreferences = {
  audioEnabled: true,
  videoEnabled: true,
  audioDeviceId: 'default',
  videoDeviceId: 'default',
};

function getMediaAccessIssue() {
  if (typeof window === 'undefined' || typeof navigator === 'undefined') {
    return '';
  }

  const hasMediaApi = typeof navigator.mediaDevices?.getUserMedia === 'function';
  if (hasMediaApi) {
    return '';
  }

  if (window.location.hostname === '0.0.0.0') {
    return 'Откройте приложение через http://localhost, а не через http://0.0.0.0. Для камеры и микрофона браузер считает localhost защищённым адресом, а 0.0.0.0 — нет.';
  }

  if (!window.isSecureContext) {
    return 'Браузер разрешает доступ к камере и микрофону только на localhost или по HTTPS.';
  }

  return 'В этом браузере недоступен API для камеры и микрофона.';
}

function getErrorMessage(error: unknown) {
  if (error instanceof Error && error.message) {
    return error.message;
  }
  return 'Не удалось подключиться к видеосессии.';
}

function getDeviceLabel(device: MediaDeviceInfo, fallback: string, index: number) {
  if (device.label) {
    return device.label;
  }
  if (device.deviceId === 'default') {
    return `Системный ${fallback.toLowerCase()}`;
  }
  return `${fallback} ${index + 1}`;
}

function formatRoomName(roomName: string) {
  return roomName.replace(/[_-]+/g, ' ').trim();
}

/** Для системного устройства не передаём deviceId — браузер сам выберет default. */
function optionalDeviceId(deviceId: string): ConstrainDOMString | undefined {
  if (!deviceId || deviceId === 'default') {
    return undefined;
  }
  return { ideal: deviceId };
}

function isLoopbackHost(hostname: string) {
  return hostname === 'localhost' || hostname === '127.0.0.1' || hostname === '0.0.0.0';
}

function getLivekitServerUrl() {
  const configuredUrl = import.meta.env.VITE_LIVEKIT_URL?.trim();

  if (typeof window === 'undefined') {
    return configuredUrl && configuredUrl !== 'auto' ? configuredUrl : 'ws://localhost/livekit';
  }

  const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
  const sameHostUrl = `${protocol}//${window.location.host}/livekit`;

  if (!configuredUrl || configuredUrl === 'auto') {
    return sameHostUrl;
  }

  try {
    const resolvedUrl = new URL(configuredUrl, window.location.href);
    if (isLoopbackHost(resolvedUrl.hostname) && !isLoopbackHost(window.location.hostname)) {
      return sameHostUrl;
    }
  } catch {
    return sameHostUrl;
  }

  return configuredUrl;
}

/** Предпросмотр через getUserMedia: корректно пересоздаёт поток при вкл/выкл камеры и смене устройства. */
function usePreviewMediaStream(preferences: JoinPreferences, canUseMediaApi: boolean) {
  const [stream, setStream] = useState<MediaStream | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!canUseMediaApi) {
      setStream(null);
      setError(null);
      return undefined;
    }

    const needVideo = preferences.videoEnabled;
    const needAudio = preferences.audioEnabled;
    if (!needVideo && !needAudio) {
      setStream(null);
      setError(null);
      return undefined;
    }

    let cancelled = false;
    let active: MediaStream | null = null;

    async function acquire() {
      try {
        const videoConstraints: boolean | MediaTrackConstraints = !needVideo
          ? false
          : preferences.videoDeviceId === 'default'
            ? true
            : { deviceId: { exact: preferences.videoDeviceId } };
        const audioConstraints: boolean | MediaTrackConstraints = !needAudio
          ? false
          : preferences.audioDeviceId === 'default'
            ? true
            : { deviceId: { exact: preferences.audioDeviceId } };

        const next = await navigator.mediaDevices.getUserMedia({
          video: videoConstraints,
          audio: audioConstraints,
        });
        if (cancelled) {
          next.getTracks().forEach((t) => t.stop());
          return;
        }
        active = next;
        setStream(next);
        setError(null);
      } catch (err) {
        if (!cancelled) {
          setStream(null);
          setError(err instanceof Error ? err.message : 'Не удалось получить доступ к устройствам');
        }
      }
    }

    void acquire();

    return () => {
      cancelled = true;
      if (active) {
        active.getTracks().forEach((t) => t.stop());
      }
      setStream(null);
    };
  }, [
    canUseMediaApi,
    preferences.audioDeviceId,
    preferences.audioEnabled,
    preferences.videoDeviceId,
    preferences.videoEnabled,
  ]);

  return { stream, error };
}

function useAudioAnalyserLevel(stream: MediaStream | null, active: boolean): number {
  const [level, setLevel] = useState(0);

  useEffect(() => {
    if (!stream || !active) {
      setLevel(0);
      return undefined;
    }

    if (!stream.getAudioTracks().length) {
      setLevel(0);
      return undefined;
    }

    const context = new AudioContext();
    const source = context.createMediaStreamSource(stream);
    const analyser = context.createAnalyser();
    analyser.fftSize = 512;
    analyser.smoothingTimeConstant = 0.45;
    source.connect(analyser);

    const data = new Uint8Array(analyser.frequencyBinCount);
    let raf = 0;

    const tick = () => {
      analyser.getByteFrequencyData(data);
      let energy = 0;
      for (let i = 0; i < data.length; i += 1) {
        energy += data[i] ?? 0;
      }
      const normalized = Math.min(1, (energy / data.length / 255) * 3.2);
      setLevel(normalized);
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);

    return () => {
      cancelAnimationFrame(raf);
      source.disconnect();
      void context.close();
    };
  }, [stream, active]);

  return level;
}

function MicrophoneMeter({ level, enabled }: { level: number; enabled: boolean }) {
  return (
    <Stack direction="row" spacing={0.5} alignItems="flex-end" sx={{ height: 28 }}>
      {Array.from({ length: 8 }, (_, index) => {
        const threshold = (index + 1) / 9;
        const boosted = Math.min(1, level * 2.4);
        const isActive = enabled && boosted >= threshold;

        return (
          <Box
            key={index}
            sx={{
              width: 5,
              height: 8 + index * 2,
              borderRadius: 99,
              background: isActive ? 'linear-gradient(180deg, #7fd7ff 0%, #3384ff 100%)' : alpha('#ffffff', 0.12),
              transition: 'background-color 120ms ease, transform 120ms ease',
              transform: isActive ? 'translateY(-1px)' : 'none',
            }}
          />
        );
      })}
    </Stack>
  );
}

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

function DeviceSetupScreen({
  tokenData,
  roomError,
  preferences,
  onPreferencesChange,
  onJoin,
  onBack,
}: {
  tokenData: TokenResponse;
  roomError: string;
  preferences: JoinPreferences;
  onPreferencesChange: (patch: Partial<JoinPreferences>) => void;
  onJoin: (config: JoinPreferences) => void;
  onBack: () => void;
}) {
  const mediaAccessIssue = getMediaAccessIssue();
  const canUseMediaApi = !mediaAccessIssue;
  const videoDevices = useMediaDevices({ kind: 'videoinput' });
  const audioDevices = useMediaDevices({ kind: 'audioinput' });
  const { stream: previewStream, error: previewMediaError } = usePreviewMediaStream(preferences, canUseMediaApi);
  const videoRef = useRef<HTMLVideoElement>(null);
  const previewFailure = previewMediaError ? new Error(previewMediaError) : null;
  const videoError = mediaAccessIssue ? new Error(mediaAccessIssue) : preferences.videoEnabled ? previewFailure : null;
  const audioError = mediaAccessIssue ? new Error(mediaAccessIssue) : preferences.audioEnabled ? previewFailure : null;
  const micLevel = useAudioAnalyserLevel(previewStream, preferences.audioEnabled && !audioError);

  useEffect(() => {
    const element = videoRef.current;
    if (!element || !previewStream || !preferences.videoEnabled) {
      if (element) {
        element.srcObject = null;
      }
      return undefined;
    }
    element.srcObject = previewStream;
    return () => {
      element.srcObject = null;
    };
  }, [previewStream, preferences.videoEnabled]);

  const hasLiveVideo = Boolean(
    previewStream?.getVideoTracks().some((t) => t.readyState === 'live'),
  );
  const canShowVideo = preferences.videoEnabled && !videoError && hasLiveVideo;
  const videoStatus = !preferences.videoEnabled
    ? 'Камера выключена перед входом'
    : videoError
      ? 'Нет доступа к камере'
      : 'Камера готова';
  const audioStatus = !preferences.audioEnabled
    ? 'Микрофон выключен перед входом'
    : audioError
      ? 'Нет доступа к микрофону'
      : 'Микрофон готов';

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
          К группам
        </Button>

        <Box
          sx={{
            display: 'grid',
            gap: 2.5,
            alignItems: 'stretch',
            gridTemplateColumns: { xs: '1fr', lg: 'minmax(0, 1.5fr) minmax(320px, 420px)' },
          }}
        >
          <Stack spacing={2}>
            <Paper
              sx={{
                position: 'relative',
                minHeight: { xs: 360, md: 560 },
                overflow: 'hidden',
                borderRadius: 6,
                background: 'linear-gradient(160deg, #162237 0%, #08111f 55%, #050913 100%)',
                border: `1px solid ${alpha('#ffffff', 0.08)}`,
                boxShadow: '0 32px 80px rgba(0, 0, 0, 0.42)',
              }}
            >
              {canShowVideo ? (
                <video
                  ref={videoRef}
                  autoPlay
                  playsInline
                  muted
                  style={{
                    width: '100%',
                    height: '100%',
                    objectFit: 'cover',
                    transform: 'scaleX(-1)',
                  }}
                />
              ) : (
                <Stack
                  spacing={2}
                  alignItems="center"
                  justifyContent="center"
                  sx={{
                    height: '100%',
                    px: 3,
                    textAlign: 'center',
                    color: '#dce8ff',
                  }}
                >
                  <Box
                    sx={{
                      width: 96,
                      height: 96,
                      display: 'grid',
                      placeItems: 'center',
                      borderRadius: '50%',
                      background: 'linear-gradient(135deg, #3384ff 0%, #77b6ff 100%)',
                      color: '#ffffff',
                    }}
                  >
                    <VideocamOffRoundedIcon sx={{ fontSize: 42 }} />
                  </Box>
                  <Typography variant="h5" fontWeight={800}>Проверка устройств</Typography>
                  <Typography sx={{ maxWidth: 420, color: alpha('#ffffff', 0.72) }}>
                    Перед входом можно настроить камеру и микрофон. Экран собран по логике Телемоста:
                    сначала предпросмотр и проверка устройств, потом вход в комнату.
                  </Typography>
                </Stack>
              )}

              <Box
                sx={{
                  position: 'absolute',
                  inset: 0,
                  background: 'linear-gradient(180deg, rgba(4, 7, 15, 0.02) 0%, rgba(4, 7, 15, 0.55) 100%)',
                  pointerEvents: 'none',
                }}
              />

              <Stack
                spacing={0.5}
                sx={{
                  position: 'absolute',
                  left: 20,
                  right: 20,
                  bottom: 20,
                  p: 2,
                  borderRadius: 4,
                  color: '#ffffff',
                  background: alpha('#050913', 0.72),
                  border: `1px solid ${alpha('#ffffff', 0.08)}`,
                  backdropFilter: 'blur(18px)',
                }}
              >
                <Typography variant="caption" sx={{ color: alpha('#ffffff', 0.65) }}>
                  Готовность к входу
                </Typography>
                <Typography variant="h6" fontWeight={800}>
                  {tokenData.participant_name}
                </Typography>
                <Typography variant="body2" sx={{ color: alpha('#ffffff', 0.78) }}>
                  {formatRoomName(tokenData.room_name)}
                </Typography>
              </Stack>
            </Paper>

            <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1.5}>
              <Button
                fullWidth
                variant={preferences.audioEnabled ? 'contained' : 'outlined'}
                startIcon={preferences.audioEnabled ? <MicRoundedIcon /> : <MicOffRoundedIcon />}
                onClick={() => onPreferencesChange({ audioEnabled: !preferences.audioEnabled })}
                sx={{
                  py: 1.3,
                  borderRadius: 4,
                  color: '#ffffff',
                  borderColor: alpha('#ffffff', 0.12),
                  background: preferences.audioEnabled
                    ? 'linear-gradient(135deg, #3384ff 0%, #1d6eff 100%)'
                    : alpha('#ffffff', 0.04),
                }}
              >
                {preferences.audioEnabled ? 'Микрофон включён' : 'Микрофон выключен'}
              </Button>
              <Button
                fullWidth
                variant={preferences.videoEnabled ? 'contained' : 'outlined'}
                startIcon={preferences.videoEnabled ? <VideocamRoundedIcon /> : <VideocamOffRoundedIcon />}
                onClick={() => onPreferencesChange({ videoEnabled: !preferences.videoEnabled })}
                sx={{
                  py: 1.3,
                  borderRadius: 4,
                  color: '#ffffff',
                  borderColor: alpha('#ffffff', 0.12),
                  background: preferences.videoEnabled
                    ? 'linear-gradient(135deg, #3384ff 0%, #1d6eff 100%)'
                    : alpha('#ffffff', 0.04),
                }}
              >
                {preferences.videoEnabled ? 'Камера включена' : 'Камера выключена'}
              </Button>
            </Stack>
          </Stack>

          <Paper
            sx={{
              p: { xs: 2.5, md: 3 },
              borderRadius: 6,
              color: '#ffffff',
              background: alpha('#08111f', 0.9),
              border: `1px solid ${alpha('#ffffff', 0.08)}`,
              boxShadow: '0 28px 70px rgba(0, 0, 0, 0.36)',
              backdropFilter: 'blur(16px)',
            }}
          >
            <Stack spacing={2.5}>
              <Box>
                <Typography variant="overline" sx={{ color: '#8fb8ff', letterSpacing: '0.12em' }}>
                  Подготовка к встрече
                </Typography>
                <Typography variant="h4" fontWeight={800} sx={{ mt: 0.5 }}>
                  Сначала проверка, потом вход
                </Typography>
                <Typography sx={{ mt: 1, color: alpha('#ffffff', 0.72) }}>
                  Комната откроется только после кнопки «Присоединиться». Можно заранее выбрать устройства
                  и отключить камеру или микрофон.
                </Typography>
              </Box>

              {mediaAccessIssue && (
                <Box
                  sx={{
                    p: 1.6,
                    borderRadius: 4,
                    background: alpha('#ffb300', 0.12),
                    border: `1px solid ${alpha('#ffb300', 0.28)}`,
                  }}
                >
                  <Typography fontWeight={700}>Камера и микрофон сейчас недоступны</Typography>
                  <Typography variant="body2" sx={{ mt: 0.5, color: alpha('#ffffff', 0.8) }}>
                    {mediaAccessIssue}
                  </Typography>
                  {typeof window !== 'undefined' && window.location.hostname === '0.0.0.0' && (
                    <Button
                      variant="contained"
                      sx={{ mt: 1.5 }}
                      onClick={() => {
                        const nextUrl = new URL(window.location.href);
                        nextUrl.hostname = 'localhost';
                        window.location.replace(nextUrl.toString());
                      }}
                    >
                      Открыть через localhost
                    </Button>
                  )}
                </Box>
              )}

              {roomError && (
                <Box
                  sx={{
                    p: 1.6,
                    borderRadius: 4,
                    background: alpha('#ef4444', 0.14),
                    border: `1px solid ${alpha('#ef4444', 0.3)}`,
                  }}
                >
                  <Typography fontWeight={700}>Предыдущее подключение завершилось с ошибкой</Typography>
                  <Typography variant="body2" sx={{ mt: 0.5, color: alpha('#ffffff', 0.78) }}>
                    {roomError}
                  </Typography>
                </Box>
              )}

              <Box
                sx={{
                  p: 1.75,
                  borderRadius: 4,
                  background: alpha('#ffffff', 0.03),
                  border: `1px solid ${alpha('#ffffff', 0.06)}`,
                }}
              >
                <Typography variant="caption" sx={{ color: alpha('#ffffff', 0.62) }}>Комната</Typography>
                <Typography fontWeight={800} sx={{ mt: 0.5 }}>{formatRoomName(tokenData.room_name)}</Typography>
                <Typography variant="body2" sx={{ mt: 0.5, color: alpha('#ffffff', 0.72) }}>
                  Входите как {tokenData.participant_name}
                </Typography>
              </Box>

              <TextField
                select
                label="Камера"
                value={preferences.videoDeviceId}
                onChange={(event) => onPreferencesChange({ videoDeviceId: event.target.value })}
                disabled={!preferences.videoEnabled}
                sx={{
                  '& .MuiInputLabel-root': { color: alpha('#ffffff', 0.7) },
                  '& .MuiOutlinedInput-root': {
                    color: '#ffffff',
                    borderRadius: 3.5,
                    backgroundColor: alpha('#ffffff', 0.03),
                  },
                  '& .MuiOutlinedInput-notchedOutline': {
                    borderColor: alpha('#ffffff', 0.12),
                  },
                }}
              >
                <MenuItem value="default">Системная камера</MenuItem>
                {videoDevices.map((device, index) => (
                  <MenuItem key={device.deviceId} value={device.deviceId}>
                    {getDeviceLabel(device, 'Камера', index)}
                  </MenuItem>
                ))}
              </TextField>

              <TextField
                select
                label="Микрофон"
                value={preferences.audioDeviceId}
                onChange={(event) => onPreferencesChange({ audioDeviceId: event.target.value })}
                disabled={!preferences.audioEnabled}
                sx={{
                  '& .MuiInputLabel-root': { color: alpha('#ffffff', 0.7) },
                  '& .MuiOutlinedInput-root': {
                    color: '#ffffff',
                    borderRadius: 3.5,
                    backgroundColor: alpha('#ffffff', 0.03),
                  },
                  '& .MuiOutlinedInput-notchedOutline': {
                    borderColor: alpha('#ffffff', 0.12),
                  },
                }}
              >
                <MenuItem value="default">Системный микрофон</MenuItem>
                {audioDevices.map((device, index) => (
                  <MenuItem key={device.deviceId} value={device.deviceId}>
                    {getDeviceLabel(device, 'Микрофон', index)}
                  </MenuItem>
                ))}
              </TextField>

              <Stack spacing={1.5}>
                <Box
                  sx={{
                    p: 1.75,
                    borderRadius: 4,
                    background: alpha('#ffffff', 0.03),
                    border: `1px solid ${alpha('#ffffff', 0.06)}`,
                  }}
                >
                  <Typography variant="caption" sx={{ color: alpha('#ffffff', 0.62) }}>Камера</Typography>
                  <Typography fontWeight={700} sx={{ mt: 0.5 }}>{videoStatus}</Typography>
                  {videoError && (
                    <Typography variant="body2" sx={{ mt: 0.5, color: '#ffb4b4' }}>
                      {videoError.message}
                    </Typography>
                  )}
                </Box>

                <Box
                  sx={{
                    p: 1.75,
                    borderRadius: 4,
                    background: alpha('#ffffff', 0.03),
                    border: `1px solid ${alpha('#ffffff', 0.06)}`,
                  }}
                >
                  <Typography variant="caption" sx={{ color: alpha('#ffffff', 0.62) }}>Микрофон</Typography>
                  <Stack
                    direction="row"
                    alignItems="center"
                    justifyContent="space-between"
                    spacing={2}
                    sx={{ mt: 0.5 }}
                  >
                    <Typography fontWeight={700}>{audioStatus}</Typography>
                    <MicrophoneMeter level={micLevel} enabled={preferences.audioEnabled && !audioError} />
                  </Stack>
                  {audioError && (
                    <Typography variant="body2" sx={{ mt: 0.5, color: '#ffb4b4' }}>
                      {audioError.message}
                    </Typography>
                  )}
                </Box>
              </Stack>

              <Button
                size="large"
                variant="contained"
                onClick={() => onJoin({
                  ...preferences,
                  audioEnabled: preferences.audioEnabled && !audioError,
                  videoEnabled: preferences.videoEnabled && !videoError,
                })}
                sx={{
                  py: 1.6,
                  borderRadius: 4.5,
                  fontWeight: 800,
                  background: 'linear-gradient(135deg, #3384ff 0%, #1d6eff 100%)',
                  boxShadow: '0 16px 30px rgba(29, 110, 255, 0.35)',
                }}
              >
                Присоединиться
              </Button>
            </Stack>
          </Paper>
        </Box>
      </Stack>
    </Box>
  );
}

function MeetingStage({
  pomodoro,
  localUserName,
  onPomodoroPause,
  onPomodoroResume,
  onPomodoroSkip,
}: {
  pomodoro: PomodoroStateSnapshot | null;
  localUserName: string;
  onPomodoroPause: () => void;
  onPomodoroResume: () => void;
  onPomodoroSkip: () => void;
}) {
  /** По умолчанию в useTracks onlySubscribed=true: локальная публикация без готового track не попадает в сетку — картинка «пропадает». */
  const tracks = useTracks(
    [
      { source: Track.Source.Camera, withPlaceholder: true },
      { source: Track.Source.ScreenShare, withPlaceholder: false },
    ],
    { onlySubscribed: false },
  );

  return (
    <Box
      sx={{
        height: '100%',
        p: { xs: 1.5, md: 2 },
        '& .lk-participant-tile': {
          overflow: 'hidden',
          borderRadius: 5,
          border: `1px solid ${alpha('#ffffff', 0.08)}`,
          background: 'linear-gradient(180deg, #1a2740 0%, #0a1220 100%)',
          boxShadow: '0 20px 50px rgba(0, 0, 0, 0.28)',
        },
        '& .lk-participant-media-video': {
          objectFit: 'cover',
        },
        '& .lk-participant-metadata': {
          left: 16,
          right: 16,
          bottom: 16,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '10px 14px',
          borderRadius: 999,
          background: alpha('#050913', 0.7),
          border: `1px solid ${alpha('#ffffff', 0.08)}`,
          backdropFilter: 'blur(16px)',
        },
        '& .lk-participant-name': {
          color: '#ffffff',
          fontWeight: 800,
          fontSize: '0.95rem',
        },
      }}
    >
      <Box
        sx={{
          height: '100%',
          display: 'grid',
          gap: 1.5,
          gridAutoRows: '1fr',
          gridTemplateColumns: {
            xs: '1fr',
            sm: 'repeat(2, minmax(0, 1fr))',
            md: 'repeat(3, minmax(0, 1fr))',
            xl: 'repeat(4, minmax(0, 1fr))',
          },
          alignContent: 'start',
        }}
      >
        {tracks.map((trackRef, index) => {
          const key = 'participant' in trackRef
            ? `${trackRef.participant.identity}-${trackRef.source}-${'publication' in trackRef && trackRef.publication ? trackRef.publication.trackSid : 'placeholder'}`
            : String(index);

          return <ParticipantTile key={key} trackRef={trackRef} />;
        })}

        {pomodoro?.enabled ? (
          <PomodoroTile
            snapshot={pomodoro}
            localUserName={localUserName}
            onPause={onPomodoroPause}
            onResume={onPomodoroResume}
            onSkip={onPomodoroSkip}
          />
        ) : null}
      </Box>
      <RoomAudioRenderer />
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
        {participants.map((p) => (
          <Paper
            key={p.identity}
            sx={{
              p: 1.5,
              borderRadius: 3,
              background: alpha('#162744', 0.92),
              border: `1px solid ${alpha('#ffffff', 0.08)}`,
            }}
          >
            <Typography fontWeight={700}>
              {p.name && p.name.trim() ? p.name : `Участник ${p.identity}`}
            </Typography>
            {p.isLocal ? (
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
  participantsOpen,
  onParticipantsToggle,
  microphoneCaptureOptions,
  cameraCaptureOptions,
  onTrackDeviceError,
}: {
  chatOpen: boolean;
  onChatToggle: () => void;
  onWidgetsToggle: () => void;
  participantsOpen: boolean;
  onParticipantsToggle: () => void;
  microphoneCaptureOptions: AudioCaptureOptions;
  cameraCaptureOptions: VideoCaptureOptions;
  onTrackDeviceError: (message: string) => void;
}) {
  const microphone = useTrackToggle({
    source: Track.Source.Microphone,
    captureOptions: microphoneCaptureOptions,
    onDeviceError: (err) => onTrackDeviceError(err.message),
  });
  const camera = useTrackToggle({
    source: Track.Source.Camera,
    captureOptions: cameraCaptureOptions,
    onDeviceError: (err) => onTrackDeviceError(err.message),
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
      <CallControlButton
        icon={microphone.enabled ? <MicRoundedIcon /> : <MicOffRoundedIcon />}
        label="Микрофон"
        buttonProps={microphone.buttonProps}
        active={microphone.enabled}
      />
      <CallControlButton
        icon={camera.enabled ? <VideocamRoundedIcon /> : <VideocamOffRoundedIcon />}
        label="Камера"
        buttonProps={camera.buttonProps}
        active={camera.enabled}
      />
      <CallControlButton
        icon={<PresentToAllRoundedIcon />}
        label="Показ экрана"
        buttonProps={screenShare.buttonProps}
        active={screenShare.enabled}
      />
      <CallControlButton
        icon={<PeopleRoundedIcon />}
        label="Участники"
        buttonProps={{ onClick: onParticipantsToggle }}
        active={participantsOpen}
      />
      <CallControlButton
        icon={<ChatRoundedIcon />}
        label="Чат"
        buttonProps={{ onClick: onChatToggle }}
        active={chatOpen}
      />
      <CallControlButton
        icon={<WidgetsRoundedIcon />}
        label="Виджеты"
        buttonProps={{ onClick: onWidgetsToggle }}
      />
      <CallControlButton
        icon={<CallEndRoundedIcon />}
        label="Покинуть встречу"
        buttonProps={leaveButtonProps}
        danger
      />
    </Stack>
  );
}

function MeetingRoomScreen({
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
  const [sideTab, setSideTab] = useState<'chat' | 'widgets'>('chat');
  const [participantsOpen, setParticipantsOpen] = useState(false);
  const { state: widgetsState, send: sendWidgetEvent, clearToast } = useWidgetsSocket(sessionId);
  const stage = widgetsState.stage?.current_stage;
  const [nowMs, setNowMs] = useState(() => Date.now());
  const [serverOffsetMs, setServerOffsetMs] = useState<number | null>(null);

  useEffect(() => {
    const id = window.setInterval(() => setNowMs(Date.now()), 250);
    return () => window.clearInterval(id);
  }, []);

  useEffect(() => {
    const serverTimeMs = widgetsState.stage?.timing.server_time_ms;
    if (!serverTimeMs) return;
    setServerOffsetMs(Date.now() - serverTimeMs);
  }, [widgetsState.stage?.timing.server_time_ms]);

  const stageElapsed = useMemo(() => {
    const snapshot = widgetsState.stage;
    if (!snapshot) return null;
    const offset = serverOffsetMs ?? 0;
    const serverNow = nowMs - offset;
    const elapsed = Math.max(0, Math.floor((serverNow - snapshot.timing.stage_started_at_ms) / 1000));
    return elapsed;
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

  return (
    <Box
      sx={{
        minHeight: '100vh',
        px: { xs: 1.5, md: 2.5 },
        py: { xs: 1.5, md: 2.5 },
        background: 'radial-gradient(circle at top left, #203868 0%, #08111f 42%, #04070f 100%)',
      }}
    >
      <Stack spacing={2} sx={{ minHeight: 'calc(100vh - 24px)' }}>
        {mediaWarning ? (
          <Alert severity="warning" onClose={onDismissMediaWarning} sx={{ borderRadius: 3 }}>
            {mediaWarning}
          </Alert>
        ) : null}
        <Stack
          direction={{ xs: 'column', md: 'row' }}
          spacing={1.5}
          alignItems={{ xs: 'flex-start', md: 'center' }}
          justifyContent="space-between"
        >
          <Stack spacing={0.75}>
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
            <Typography variant="h4" fontWeight={800} color="#ffffff">
              {formatRoomName(roomName)}
            </Typography>
          </Stack>

          <Stack spacing={0.35} alignItems={{ xs: 'flex-start', md: 'flex-end' }}>
            <Typography sx={{ color: '#dce8ff' }}>
              Участников в комнате: {participants.length}
            </Typography>
            <Typography variant="body2" sx={{ color: alpha('#ffffff', 0.7) }}>
              Вы в комнате как {participantName}
            </Typography>
          </Stack>
        </Stack>

        <Paper
          sx={{
            p: 1.25,
            borderRadius: 4,
            background: alpha('#050913', 0.6),
            border: `1px solid ${alpha('#ffffff', 0.08)}`,
            backdropFilter: 'blur(18px)',
          }}
        >
          <Stack
            direction={{ xs: 'column', md: 'row' }}
            spacing={1}
            alignItems={{ xs: 'stretch', md: 'center' }}
            justifyContent="space-between"
          >
            <Stack direction="row" spacing={1} alignItems="center">
              <Typography variant="body2" sx={{ color: alpha('#ffffff', 0.72), fontWeight: 800 }}>
                Этап:
              </Typography>
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
              {stageElapsed !== null ? (
                <Typography variant="caption" sx={{ color: alpha('#ffffff', 0.7) }}>
                  {formatMMSS(stageElapsed)}
                </Typography>
              ) : null}
            </Stack>

            <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1}>
              <Button
                variant={stage === 'discussion' ? 'contained' : 'outlined'}
                disabled={!canControlStage}
                onClick={() => sendWidgetEvent({ event: 'stage_set', payload: { stage: 'discussion' } })}
                sx={{
                  borderRadius: 3,
                  fontWeight: 900,
                  ...(stage === 'discussion'
                    ? { background: 'linear-gradient(135deg, #3384ff 0%, #1d6eff 100%)' }
                    : { color: '#ffffff', borderColor: alpha('#ffffff', 0.18), background: alpha('#ffffff', 0.03) }),
                }}
              >
                К обсуждению
              </Button>
              <Button
                variant={stage === 'work' ? 'contained' : 'outlined'}
                disabled={!canControlStage}
                onClick={() => sendWidgetEvent({ event: 'stage_set', payload: { stage: 'work' } })}
                sx={{
                  borderRadius: 3,
                  fontWeight: 900,
                  ...(stage === 'work'
                    ? { background: 'linear-gradient(135deg, #22c55e 0%, #16a34a 100%)' }
                    : { color: '#ffffff', borderColor: alpha('#ffffff', 0.18), background: alpha('#ffffff', 0.03) }),
                }}
              >
                К работе
              </Button>
              <Button
                variant={stage === 'summary' ? 'contained' : 'outlined'}
                disabled={!canControlStage}
                onClick={() => sendWidgetEvent({ event: 'stage_set', payload: { stage: 'summary' } })}
                sx={{
                  borderRadius: 3,
                  fontWeight: 900,
                  ...(stage === 'summary'
                    ? { background: 'linear-gradient(135deg, #f59e0b 0%, #d97706 100%)' }
                    : { color: '#ffffff', borderColor: alpha('#ffffff', 0.18), background: alpha('#ffffff', 0.03) }),
                }}
              >
                К итогам
              </Button>
            </Stack>
          </Stack>
          {!canControlStage ? (
            <Typography variant="caption" sx={{ mt: 0.75, display: 'block', color: alpha('#ffffff', 0.6) }}>
              Переключать этап может только создатель комнаты или модератор.
            </Typography>
          ) : null}
        </Paper>

        <Box
          sx={{
            flex: 1,
            minHeight: 0,
            display: 'grid',
            gap: 2,
            gridTemplateColumns: { xs: '1fr', lg: sidePanelOpen ? 'minmax(0, 1fr) 340px' : '1fr' },
          }}
        >
          <Paper
            sx={{
              position: 'relative',
              minHeight: { xs: 'calc(100vh - 190px)', lg: 'calc(100vh - 120px)' },
              overflow: 'hidden',
              borderRadius: 6,
              background: 'linear-gradient(180deg, #101a2a 0%, #050913 100%)',
              border: `1px solid ${alpha('#ffffff', 0.08)}`,
              boxShadow: '0 32px 80px rgba(0, 0, 0, 0.42)',
            }}
          >
            <MeetingStage
              pomodoro={widgetsState.pomodoro}
              localUserName={participantName}
              onPomodoroPause={() => sendWidgetEvent({ event: 'pomodoro_pause', payload: {} })}
              onPomodoroResume={() => sendWidgetEvent({ event: 'pomodoro_resume', payload: {} })}
              onPomodoroSkip={() => sendWidgetEvent({ event: 'pomodoro_skip_phase', payload: {} })}
            />
            <MeetingControls
              chatOpen={sidePanelOpen && sideTab === 'chat'}
              onChatToggle={() => {
                setSidePanelOpen((prev) => (sideTab === 'chat' ? !prev : true));
                setSideTab('chat');
                setParticipantsOpen(false);
              }}
              onWidgetsToggle={() => {
                setSidePanelOpen((prev) => (sideTab === 'widgets' ? !prev : true));
                setSideTab('widgets');
                setParticipantsOpen(false);
              }}
              participantsOpen={participantsOpen}
              onParticipantsToggle={() => {
                setParticipantsOpen((prev) => !prev);
                setSidePanelOpen(false);
              }}
              microphoneCaptureOptions={microphoneCaptureOptions}
              cameraCaptureOptions={cameraCaptureOptions}
              onTrackDeviceError={onTrackDeviceError}
            />
          </Paper>

          {!isMobile && sidePanelOpen && (
            <Box sx={{ minHeight: { lg: 'calc(100vh - 120px)' } }}>
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
                </Tabs>

                {sideTab === 'chat' ? (
                  <ChatPanel sessionId={sessionId} variant="session" />
                ) : (
                  <WidgetsPanel snapshot={widgetsState.pomodoro} localUserName={participantName} send={sendWidgetEvent} />
                )}
              </Paper>
            </Box>
          )}
        </Box>

        <Drawer
          anchor="right"
          open={isMobile && sidePanelOpen}
          onClose={() => setSidePanelOpen(false)}
          PaperProps={{
            sx: {
              width: '100%',
              maxWidth: 380,
              p: 1.5,
              background: '#050913',
            },
          }}
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
            </Tabs>

            {sideTab === 'chat' ? (
              <ChatPanel sessionId={sessionId} variant="session" />
            ) : (
              <WidgetsPanel snapshot={widgetsState.pomodoro} localUserName={participantName} send={sendWidgetEvent} />
            )}
          </Paper>
        </Drawer>

        <MeetingParticipantsDrawer open={participantsOpen} onClose={() => setParticipantsOpen(false)} />

        <Snackbar
          open={Boolean(widgetsState.lastStartedToast)}
          autoHideDuration={4500}
          onClose={clearToast}
          anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
        >
          <Alert
            severity="success"
            variant="filled"
            onClose={clearToast}
            sx={{ borderRadius: 3, fontWeight: 800 }}
          >
            {widgetsState.lastStartedToast?.last_started_by?.name
              ? `${widgetsState.lastStartedToast.last_started_by.name} включил Pomodoro`
              : 'Pomodoro включён'}
          </Alert>
        </Snackbar>
      </Stack>
    </Box>
  );
}

export function VideoSessionPage() {
  const { sessionId } = useParams();
  const navigate = useNavigate();
  const [tokenData, setTokenData] = useState<TokenResponse | null>(null);
  const [pageError, setPageError] = useState('');
  const [roomError, setRoomError] = useState('');
  const [joinConfig, setJoinConfig] = useState<JoinPreferences | null>(null);
  const [preferences, setPreferences] = useState<JoinPreferences>(defaultJoinPreferences);
  const [inMeetingMediaWarning, setInMeetingMediaWarning] = useState('');
  const roomJoinedRef = useRef(false);
  const roomOptions = useMemo(
    () => ({
      adaptiveStream: true,
      dynacast: true,
      /**
       * livekit-client по умолчанию ходит на `/rtc/v1` (singlePeerConnection: true).
       * Образ `livekit/livekit-server:v1.8` отвечает на этом пути 404 (см. nginx: GET /livekit/rtc/v1 → 404),
       * из‑за этого валится сигналинг/ICE и в UI «Предыдущее подключение…».
       * Режим v0 (`/rtc`) включается при singlePeerConnection: false — см. Room.connectSignal → engine.join(…, !singlePeerConnection).
       */
      singlePeerConnection: false,
    }),
    [],
  );

  const handleLiveKitConnected = useCallback(() => {
    roomJoinedRef.current = true;
  }, []);

  const handleLiveKitDisconnected = useCallback(() => {
    roomJoinedRef.current = false;
    setInMeetingMediaWarning('');
    setJoinConfig(null);
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

  /** Для системной камеры — `true`, как в предпросмотре: без жёсткого 1280×720 (на части ноутбуков ломает трек). */
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
    <DeviceSetupScreen
      tokenData={tokenData}
      roomError={roomError}
      preferences={preferences}
      onPreferencesChange={(patch) => setPreferences((prev) => ({ ...prev, ...patch }))}
      onJoin={(config) => {
        setRoomError('');
        setInMeetingMediaWarning('');
        setJoinConfig(config);
      }}
      onBack={() => navigate('/groups')}
    />
  );
}
