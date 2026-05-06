import CallEndRoundedIcon from '@mui/icons-material/CallEndRounded';
import ChatBubbleOutlineRoundedIcon from '@mui/icons-material/ChatBubbleOutlineRounded';
import MicOffRoundedIcon from '@mui/icons-material/MicOffRounded';
import MicRoundedIcon from '@mui/icons-material/MicRounded';
import PeopleOutlineRoundedIcon from '@mui/icons-material/PeopleOutlineRounded';
import PresentToAllRoundedIcon from '@mui/icons-material/PresentToAllRounded';
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
  active = false,
  danger = false,
  children,
  buttonProps,
}: {
  label: string;
  active?: boolean;
  danger?: boolean;
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
          width: 52,
          height: 52,
          display: 'grid',
          placeItems: 'center',
          borderRadius: '50%',
          border: '1px solid',
          borderColor: danger ? '#fecaca' : active ? alpha('#111827', 0.12) : '#e5e7eb',
          backgroundColor: danger ? '#ef4444' : active ? '#111827' : '#ffffff',
          color: danger || active ? '#ffffff' : '#111827',
          boxShadow: '0 12px 30px rgba(15, 23, 42, 0.12)',
          transition: 'background-color 160ms ease, transform 160ms ease',
          '&:hover': {
            backgroundColor: danger ? '#dc2626' : active ? '#1f2937' : '#f8fafc',
          },
          '&:active': {
            transform: 'translateY(1px)',
          },
          '&:disabled': {
            opacity: 0.56,
            cursor: 'not-allowed',
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
}: {
  microphoneCaptureOptions: AudioCaptureOptions;
  cameraCaptureOptions: VideoCaptureOptions;
  onTrackDeviceError: (message: string) => void;
  onParticipantsClick: () => void;
  onChatClick: () => void;
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
        bottom: { xs: 16, md: 24 },
        transform: 'translateX(-50%)',
        zIndex: 2,
      }}
    >
      <Stack
        direction="row"
        spacing={1}
        sx={{
          p: 1,
          borderRadius: 999,
          border: '1px solid',
          borderColor: alpha('#ffffff', 0.72),
          backgroundColor: alpha('#ffffff', 0.92),
          backdropFilter: 'blur(14px)',
        }}
      >
        <ControlButton label="Микрофон" active={microphone.enabled} buttonProps={microphone.buttonProps}>
          {microphone.enabled ? <MicRoundedIcon /> : <MicOffRoundedIcon />}
        </ControlButton>
        <ControlButton label="Камера" active={camera.enabled} buttonProps={camera.buttonProps}>
          {camera.enabled ? <VideocamRoundedIcon /> : <VideocamOffRoundedIcon />}
        </ControlButton>
        <ControlButton label="Демонстрация экрана" active={screenShare.enabled} buttonProps={screenShare.buttonProps}>
          <PresentToAllRoundedIcon />
        </ControlButton>
        <ControlButton label="Участники" buttonProps={{ onClick: onParticipantsClick }}>
          <PeopleOutlineRoundedIcon />
        </ControlButton>
        <ControlButton label="Чат" buttonProps={{ onClick: onChatClick }}>
          <ChatBubbleOutlineRoundedIcon />
        </ControlButton>
        <ControlButton label="Выйти из звонка" danger buttonProps={leaveButtonProps}>
          <CallEndRoundedIcon />
        </ControlButton>
      </Stack>
    </Box>
  );
}
