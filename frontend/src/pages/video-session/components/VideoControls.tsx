import CallEndRoundedIcon from '@mui/icons-material/CallEndRounded';
import ChatBubbleOutlineRoundedIcon from '@mui/icons-material/ChatBubbleOutlineRounded';
import MicOffRoundedIcon from '@mui/icons-material/MicOffRounded';
import MicRoundedIcon from '@mui/icons-material/MicRounded';
import PeopleOutlineRoundedIcon from '@mui/icons-material/PeopleOutlineRounded';
import PresentToAllRoundedIcon from '@mui/icons-material/PresentToAllRounded';
import SettingsRoundedIcon from '@mui/icons-material/SettingsRounded';
import VideocamOffRoundedIcon from '@mui/icons-material/VideocamOffRounded';
import VideocamRoundedIcon from '@mui/icons-material/VideocamRounded';
import { Box, Stack, Tooltip } from '@mui/material';
import { alpha } from '@mui/material/styles';
import { useDisconnectButton, useTrackToggle } from '@livekit/components-react';
import type { ButtonHTMLAttributes, ReactNode } from 'react';
import type { AudioCaptureOptions, VideoCaptureOptions } from 'livekit-client';
import { Track } from 'livekit-client';

function ControlButton({
  label,
  size = 40,
  active = false,
  danger = false,
  secondary = false,
  children,
  buttonProps,
}: {
  label: string;
  size?: number;
  active?: boolean;
  danger?: boolean;
  secondary?: boolean;
  children: ReactNode;
  buttonProps?: ButtonHTMLAttributes<HTMLButtonElement>;
}) {
  return (
    <Tooltip title={label}>
      <Box
        component="button"
        type="button"
        {...buttonProps}
        aria-label={label}
        sx={{
          width: `${size}px`,
          height: `${size}px`,
          display: 'inline-flex',
          alignItems: 'center',
          justifyContent: 'center',
          flexShrink: 0,
          p: 0,
          borderRadius: '12px',
          border: '1px solid',
          borderColor: danger ? alpha('#fca5a5', 0.7) : active ? alpha('#ffffff', 0.18) : alpha('#ffffff', secondary ? 0.08 : 0.12),
          backgroundColor: danger ? '#dc2626' : active ? alpha('#f8fafc', 0.2) : alpha('#ffffff', secondary ? 0.08 : 0.14),
          color: '#ffffff',
          opacity: secondary ? 0.88 : 1,
          boxShadow: danger ? '0 16px 36px rgba(220, 38, 38, 0.28)' : '0 10px 24px rgba(15, 23, 42, 0.18)',
          boxSizing: 'border-box',
          transition: 'background-color 160ms ease, border-color 160ms ease, transform 160ms ease, opacity 160ms ease',
          '&:hover': {
            backgroundColor: danger ? '#b91c1c' : active ? alpha('#f8fafc', 0.28) : alpha('#ffffff', secondary ? 0.14 : 0.2),
            borderColor: danger ? '#fca5a5' : alpha('#ffffff', 0.22),
            opacity: 1,
          },
          '&:active': {
            transform: 'translateY(1px)',
          },
          '&:disabled': {
            opacity: 0.56,
            cursor: 'not-allowed',
          },
          '& svg': {
            fontSize: size >= 46 ? 22 : 18,
          },
        }}
      >
        {children}
      </Box>
    </Tooltip>
  );
}

export function VideoControls({
  microphoneCaptureOptions,
  cameraCaptureOptions,
  onTrackDeviceError,
  onParticipantsClick,
  onChatClick,
  onSettingsClick,
  isChatOpen,
}: {
  microphoneCaptureOptions: AudioCaptureOptions;
  cameraCaptureOptions: VideoCaptureOptions;
  onTrackDeviceError: (message: string) => void;
  onParticipantsClick: () => void;
  onChatClick: () => void;
  onSettingsClick: () => void;
  isChatOpen: boolean;
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
    <Box
      sx={{
        position: 'absolute',
        left: '50%',
        bottom: '16px',
        transform: 'translateX(-50%)',
        zIndex: 2,
        display: 'flex',
        justifyContent: 'center',
        width: '100%',
        maxWidth: '100%',
        px: '16px',
        pointerEvents: 'none',
        boxSizing: 'border-box',
      }}
    >
      <Stack
        direction="row"
        spacing={{ xs: '8px', sm: '10px' }}
        sx={{
          alignItems: 'center',
          flexWrap: 'nowrap',
          overflowX: 'auto',
          maxWidth: '100%',
          p: { xs: '10px', sm: '12px' },
          borderRadius: '14px',
          border: '1px solid',
          borderColor: alpha('#ffffff', 0.14),
          backgroundColor: 'rgba(0, 0, 0, 0.6)',
          backdropFilter: 'blur(18px)',
          boxShadow: '0 20px 44px rgba(15, 23, 42, 0.32)',
          pointerEvents: 'auto',
          boxSizing: 'border-box',
          '&::-webkit-scrollbar': {
            display: 'none',
          },
          scrollbarWidth: 'none',
        }}
      >
        <ControlButton label="Микрофон" active={microphone.enabled} buttonProps={microphone.buttonProps}>
          {microphone.enabled ? <MicRoundedIcon /> : <MicOffRoundedIcon />}
        </ControlButton>
        <ControlButton label="Камера" active={camera.enabled} buttonProps={camera.buttonProps}>
          {camera.enabled ? <VideocamRoundedIcon /> : <VideocamOffRoundedIcon />}
        </ControlButton>
        <ControlButton label="Показать экран" size={36} active={screenShare.enabled} secondary buttonProps={screenShare.buttonProps}>
          <PresentToAllRoundedIcon />
        </ControlButton>
        <ControlButton label={isChatOpen ? 'Скрыть чат' : 'Открыть чат'} size={36} active={isChatOpen} secondary buttonProps={{ onClick: onChatClick }}>
          <ChatBubbleOutlineRoundedIcon />
        </ControlButton>
        <ControlButton label="Участники" size={36} secondary buttonProps={{ onClick: onParticipantsClick }}>
          <PeopleOutlineRoundedIcon />
        </ControlButton>
        <ControlButton label="Настройки устройств" size={36} secondary buttonProps={{ onClick: onSettingsClick }}>
          <SettingsRoundedIcon />
        </ControlButton>
        <ControlButton label="Выйти из звонка" size={46} danger buttonProps={leaveButtonProps}>
          <CallEndRoundedIcon />
        </ControlButton>
      </Stack>
    </Box>
  );
}
