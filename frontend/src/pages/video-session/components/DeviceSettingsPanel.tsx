import MicOffRoundedIcon from '@mui/icons-material/MicOffRounded';
import MicRoundedIcon from '@mui/icons-material/MicRounded';
import VideocamOffRoundedIcon from '@mui/icons-material/VideocamOffRounded';
import VideocamRoundedIcon from '@mui/icons-material/VideocamRounded';
import { Box, Button, MenuItem, Stack, TextField, Typography } from '@mui/material';
import { alpha } from '@mui/material/styles';
import { useMediaDevices } from '@livekit/components-react';

import { getDeviceLabel } from '../utils';
import type { JoinPreferences } from '../types';
import { SessionPanelCard, SessionSidePanel, sessionPanelFieldSx } from './SessionSidePanel';

export function DeviceSettingsPanel({
  joinPreferences,
  onJoinPreferencesChange,
}: {
  joinPreferences: JoinPreferences;
  onJoinPreferencesChange: (patch: Partial<JoinPreferences>) => void;
}) {
  const devices = useMediaDevices({ kind: 'audioinput' });
  const videoDevices = useMediaDevices({ kind: 'videoinput' });

  return (
    <SessionSidePanel
      title="Настройки устройств"
      subtitle="Микрофон, камера и выбор устройств ввода."
    >
      <Stack spacing={1.25}>
        <SessionPanelCard>
          <Stack spacing={1.25}>
            <Typography variant="caption" sx={{ color: alpha('#f8fafc', 0.62), fontWeight: 700 }}>
              Быстрые переключатели
            </Typography>
            <Stack direction="row" spacing={1}>
              <Button
                fullWidth
                variant={joinPreferences.audioEnabled ? 'contained' : 'outlined'}
                startIcon={joinPreferences.audioEnabled ? <MicRoundedIcon /> : <MicOffRoundedIcon />}
                onClick={() => onJoinPreferencesChange({ audioEnabled: !joinPreferences.audioEnabled })}
                sx={{
                  borderRadius: 2,
                  textTransform: 'none',
                  borderColor: alpha('#ffffff', 0.18),
                  color: joinPreferences.audioEnabled ? '#ffffff' : alpha('#f8fafc', 0.88),
                  backgroundColor: joinPreferences.audioEnabled ? alpha('#2563eb', 0.88) : 'transparent',
                  '&:hover': {
                    borderColor: alpha('#ffffff', 0.28),
                    backgroundColor: joinPreferences.audioEnabled ? '#1d4ed8' : alpha('#ffffff', 0.08),
                  },
                }}
              >
                Микрофон
              </Button>
              <Button
                fullWidth
                variant={joinPreferences.videoEnabled ? 'contained' : 'outlined'}
                startIcon={joinPreferences.videoEnabled ? <VideocamRoundedIcon /> : <VideocamOffRoundedIcon />}
                onClick={() => onJoinPreferencesChange({ videoEnabled: !joinPreferences.videoEnabled })}
                sx={{
                  borderRadius: 2,
                  textTransform: 'none',
                  borderColor: alpha('#ffffff', 0.18),
                  color: joinPreferences.videoEnabled ? '#ffffff' : alpha('#f8fafc', 0.88),
                  backgroundColor: joinPreferences.videoEnabled ? alpha('#2563eb', 0.88) : 'transparent',
                  '&:hover': {
                    borderColor: alpha('#ffffff', 0.28),
                    backgroundColor: joinPreferences.videoEnabled ? '#1d4ed8' : alpha('#ffffff', 0.08),
                  },
                }}
              >
                Камера
              </Button>
            </Stack>
          </Stack>
        </SessionPanelCard>

        <SessionPanelCard>
          <Stack spacing={1.5}>
            <Typography variant="caption" sx={{ color: alpha('#f8fafc', 0.62), fontWeight: 700 }}>
              Устройства
            </Typography>
            <TextField
              select
              fullWidth
              size="small"
              label="Микрофон"
              value={joinPreferences.audioDeviceId}
              onChange={(event) => onJoinPreferencesChange({ audioDeviceId: event.target.value })}
              sx={sessionPanelFieldSx}
            >
              <MenuItem value="default">По умолчанию</MenuItem>
              {devices.map((device, index) => (
                <MenuItem key={device.deviceId} value={device.deviceId}>
                  {getDeviceLabel(device, 'Микрофон', index)}
                </MenuItem>
              ))}
            </TextField>
            <TextField
              select
              fullWidth
              size="small"
              label="Камера"
              value={joinPreferences.videoDeviceId}
              onChange={(event) => onJoinPreferencesChange({ videoDeviceId: event.target.value })}
              sx={sessionPanelFieldSx}
            >
              <MenuItem value="default">По умолчанию</MenuItem>
              {videoDevices.map((device, index) => (
                <MenuItem key={device.deviceId} value={device.deviceId}>
                  {getDeviceLabel(device, 'Камера', index)}
                </MenuItem>
              ))}
            </TextField>
          </Stack>
        </SessionPanelCard>

        <Box sx={{ px: 0.5 }}>
          <Typography variant="caption" sx={{ color: alpha('#f8fafc', 0.45) }}>
            Изменения применяются к вашему подключению. Кнопки внизу экрана также управляют микрофоном и камерой во время звонка.
          </Typography>
        </Box>
      </Stack>
    </SessionSidePanel>
  );
}
