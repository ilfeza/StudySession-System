import ArrowBackRoundedIcon from '@mui/icons-material/ArrowBackRounded';
import MicOffRoundedIcon from '@mui/icons-material/MicOffRounded';
import MicRoundedIcon from '@mui/icons-material/MicRounded';
import VideocamOffRoundedIcon from '@mui/icons-material/VideocamOffRounded';
import VideocamRoundedIcon from '@mui/icons-material/VideocamRounded';
import { Box, Button, MenuItem, Paper, Stack, TextField, Typography } from '@mui/material';
import { alpha } from '@mui/material/styles';
import { useMediaDevices } from '@livekit/components-react';
import { useEffect, useRef, useState } from 'react';

import type { JoinPreferences, TokenResponse } from './types';
import { getDeviceLabel, getMediaAccessIssue } from './utils';

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
          next.getTracks().forEach((track) => track.stop());
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
        active.getTracks().forEach((track) => track.stop());
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
              background: isActive ? 'linear-gradient(180deg, #7fd7ff 0%, #3384ff 100%)' : '#dbe4f0',
              transition: 'background-color 120ms ease, transform 120ms ease',
              transform: isActive ? 'translateY(-1px)' : 'none',
            }}
          />
        );
      })}
    </Stack>
  );
}

export function DeviceSetupScreen({
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

  const hasLiveVideo = Boolean(previewStream?.getVideoTracks().some((track) => track.readyState === 'live'));
  const canShowVideo = preferences.videoEnabled && !videoError && hasLiveVideo;
  const showCameraOffState = !preferences.videoEnabled || Boolean(videoError);
  const videoStatus = !preferences.videoEnabled
    ? 'Камера выключена'
    : videoError
      ? 'Нет доступа к камере'
      : 'Камера готова';
  const audioStatus = !preferences.audioEnabled
    ? 'Микрофон выключен'
    : audioError
      ? 'Нет доступа к микрофону'
      : 'Микрофон готов';

  return (
    <Box
      sx={{
        minHeight: '100vh',
        px: { xs: 2, md: 3 },
        py: { xs: 2, md: 3 },
        backgroundColor: '#ffffff',
      }}
    >
      <Stack spacing={2.5}>
        <Button
          onClick={onBack}
          startIcon={<ArrowBackRoundedIcon />}
          sx={{
            alignSelf: 'flex-start',
            color: '#0f172a',
            px: 0,
            '&:hover': { backgroundColor: 'transparent', color: '#111827' },
          }}
        >
          К группам
        </Button>

        <Box
          sx={{
            display: 'grid',
            gap: 2.5,
            alignItems: 'start',
            gridTemplateColumns: { xs: '1fr', lg: 'minmax(0, 1.45fr) minmax(320px, 420px)' },
          }}
        >
          <Stack spacing={2}>
            <Paper
              sx={{
                position: 'relative',
                height: { xs: 340, md: 520 },
                maxHeight: { xs: 340, md: 520 },
                overflow: 'hidden',
                borderRadius: 3,
                backgroundColor: '#020617',
                border: '1px solid #e5e7eb',
                boxShadow: '0 24px 60px rgba(15, 23, 42, 0.08)',
              }}
            >
              {canShowVideo ? (
                <Box
                  component="video"
                  ref={videoRef}
                  autoPlay
                  playsInline
                  muted
                  sx={{
                    position: 'absolute',
                    inset: 0,
                    width: '100%',
                    height: '100%',
                    objectFit: 'cover',
                    transform: 'scaleX(-1)',
                    display: 'block',
                  }}
                />
              ) : showCameraOffState ? (
                <Stack
                  spacing={2}
                  alignItems="center"
                  justifyContent="center"
                  sx={{
                    position: 'absolute',
                    inset: 0,
                    px: 3,
                    textAlign: 'center',
                    color: '#0f172a',
                    bgcolor: '#f8fafc',
                  }}
                >
                  <Box
                    sx={{
                      width: 96,
                      height: 96,
                      display: 'grid',
                      placeItems: 'center',
                      borderRadius: '50%',
                      bgcolor: alpha('#dc2626', 0.1),
                      color: '#dc2626',
                    }}
                  >
                    <VideocamOffRoundedIcon sx={{ fontSize: 42 }} />
                  </Box>
                  <Typography variant="h5" fontWeight={800}>Проверка устройств</Typography>
                </Stack>
              ) : (
                <Box sx={{ position: 'absolute', inset: 0, bgcolor: '#020617' }} />
              )}

              <Stack
                spacing={0.5}
                sx={{
                  position: 'absolute',
                  left: 20,
                  right: 20,
                  bottom: 20,
                  p: 2,
                  borderRadius: 2.5,
                  color: '#0f172a',
                  background: alpha('#ffffff', 0.92),
                  border: '1px solid #e5e7eb',
                  backdropFilter: 'blur(18px)',
                }}
              >
                <Typography variant="caption" sx={{ color: 'text.secondary' }}>
                  Готовность к входу
                </Typography>
                <Typography variant="h6" fontWeight={800}>
                  {tokenData.participant_name}
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
                  borderRadius: 2.5,
                  color: preferences.audioEnabled ? '#ffffff' : '#dc2626',
                  borderColor: preferences.audioEnabled ? undefined : '#fca5a5',
                  background: preferences.audioEnabled
                    ? 'linear-gradient(135deg, #3384ff 0%, #1d6eff 100%)'
                    : '#ffffff',
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
                  borderRadius: 2.5,
                  color: preferences.videoEnabled ? '#ffffff' : '#dc2626',
                  borderColor: preferences.videoEnabled ? undefined : '#fca5a5',
                  background: preferences.videoEnabled
                    ? 'linear-gradient(135deg, #3384ff 0%, #1d6eff 100%)'
                    : '#ffffff',
                }}
              >
                {preferences.videoEnabled ? 'Камера включена' : 'Камера выключена'}
              </Button>
            </Stack>
          </Stack>

          <Paper
            sx={{
              p: 2.25,
              borderRadius: 3,
              color: '#0f172a',
              backgroundColor: '#ffffff',
              border: '1px solid #e5e7eb',
              boxShadow: '0 24px 60px rgba(15, 23, 42, 0.08)',
            }}
          >
            <Stack spacing={2}>
              <Typography variant="h5" fontWeight={800}>
                Камера и микрофон
              </Typography>

              <Stack spacing={1.25}>
                <TextField
                  select
                  label="Микрофон"
                  value={preferences.audioDeviceId}
                  onChange={(event) => onPreferencesChange({ audioDeviceId: event.target.value })}
                  disabled={!preferences.audioEnabled}
                  fullWidth
                  slotProps={{
                    select: {
                      MenuProps: {
                        PaperProps: {
                          sx: {
                            backgroundColor: '#ffffff',
                            color: '#0f172a',
                          },
                        },
                      },
                    },
                  }}
                  sx={{
                    '& .MuiInputBase-root': {
                      borderRadius: 2,
                      color: '#0f172a',
                      backgroundColor: '#ffffff',
                    },
                    '& .MuiInputLabel-root': { color: 'text.secondary' },
                  }}
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
                  onChange={(event) => onPreferencesChange({ videoDeviceId: event.target.value })}
                  disabled={!preferences.videoEnabled}
                  fullWidth
                  slotProps={{
                    select: {
                      MenuProps: {
                        PaperProps: {
                          sx: {
                            backgroundColor: '#ffffff',
                            color: '#0f172a',
                          },
                        },
                      },
                    },
                  }}
                  sx={{
                    '& .MuiInputBase-root': {
                      borderRadius: 2,
                      color: '#0f172a',
                      backgroundColor: '#ffffff',
                    },
                    '& .MuiInputLabel-root': { color: 'text.secondary' },
                  }}
                >
                  {videoDevices.map((device, index) => (
                    <MenuItem key={device.deviceId || `video-${index}`} value={device.deviceId || 'default'}>
                      {getDeviceLabel(device, 'Камера', index)}
                    </MenuItem>
                  ))}
                </TextField>
              </Stack>

              <Paper
                sx={{
                  p: 1.75,
                  borderRadius: 2.5,
                  backgroundColor: '#f8fafc',
                  border: '1px solid #e5e7eb',
                }}
              >
                <Stack spacing={1.4}>
                  <Stack direction="row" justifyContent="space-between" alignItems="center">
                    <Typography fontWeight={700}>Статус камеры</Typography>
                    <Typography variant="body2" sx={{ color: preferences.videoEnabled && !videoError ? 'text.secondary' : '#dc2626' }}>
                      {videoStatus}
                    </Typography>
                  </Stack>

                  <Stack direction="row" justifyContent="space-between" alignItems="center">
                    <Typography fontWeight={700}>Статус микрофона</Typography>
                    {preferences.audioEnabled && !audioError ? (
                      <MicrophoneMeter level={micLevel} enabled />
                    ) : (
                      <MicOffRoundedIcon sx={{ color: '#dc2626' }} />
                    )}
                  </Stack>
                  <Typography variant="body2" sx={{ color: preferences.audioEnabled && !audioError ? 'text.secondary' : '#dc2626' }}>
                    {audioStatus}
                  </Typography>
                </Stack>
              </Paper>

              {videoError ? (
                <Typography variant="body2" sx={{ color: '#dc2626' }}>
                  {videoError.message}
                </Typography>
              ) : null}

              {roomError ? (
                <Typography variant="body2" sx={{ color: '#dc2626' }}>
                  {roomError}
                </Typography>
              ) : null}

              <Button
                fullWidth
                size="large"
                variant="contained"
                onClick={() => onJoin({
                  ...preferences,
                  audioEnabled: preferences.audioEnabled && !audioError,
                  videoEnabled: preferences.videoEnabled && !videoError,
                })}
                sx={{
                  py: 1.6,
                  borderRadius: 3,
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
