import CallEndRoundedIcon from '@mui/icons-material/CallEndRounded';
import ChatBubbleOutlineRoundedIcon from '@mui/icons-material/ChatBubbleOutlineRounded';
import ChevronRightRoundedIcon from '@mui/icons-material/ChevronRightRounded';
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
  size = 44,
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
          borderRadius: `${Math.max(16, Math.floor(size / 2))}px`,
          border: '1px solid',
          borderColor: danger ? alpha('#fca5a5', 0.7) : active ? alpha('#ffffff', 0.18) : alpha('#ffffff', secondary ? 0.08 : 0.12),
          backgroundColor: danger ? '#dc2626' : active ? alpha('#f8fafc', 0.2) : alpha('#ffffff', secondary ? 0.08 : 0.14),
          color: '#ffffff',
          opacity: secondary ? 0.88 : 1,
          boxShadow: danger ? '0 16px 36px rgba(220, 38, 38, 0.28)' : '0 12px 28px rgba(15, 23, 42, 0.18)',
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
            fontSize: size >= 52 ? 24 : size >= 44 ? 22 : 20,
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
  isChatOpen,
}: {
  microphoneCaptureOptions: AudioCaptureOptions;
  cameraCaptureOptions: VideoCaptureOptions;
  onTrackDeviceError: (message: string) => void;
  onParticipantsClick: () => void;
  onChatClick: () => void;
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
        spacing={{ xs: '8px', sm: '12px' }}
        sx={{
          alignItems: 'center',
          flexWrap: 'nowrap',
          overflowX: 'auto',
          maxWidth: '100%',
          p: { xs: '12px', sm: '14px', md: '16px' },
          borderRadius: { xs: '20px', sm: '22px', md: '24px' },
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
        <ControlButton label="РњРёРєСЂРѕС„РѕРЅ" size={46} active={microphone.enabled} buttonProps={microphone.buttonProps}>
          {microphone.enabled ? <MicRoundedIcon /> : <MicOffRoundedIcon />}
        </ControlButton>
        <ControlButton label="РљР°РјРµСЂР°" size={46} active={camera.enabled} buttonProps={camera.buttonProps}>
          {camera.enabled ? <VideocamRoundedIcon /> : <VideocamOffRoundedIcon />}
        </ControlButton>
        <ControlButton label="Р”РµРјРѕРЅСЃС‚СЂР°С†РёСЏ СЌРєСЂР°РЅР°" size={40} active={screenShare.enabled} secondary buttonProps={screenShare.buttonProps}>
          <PresentToAllRoundedIcon />
        </ControlButton>
        <ControlButton label="РЈС‡Р°СЃС‚РЅРёРєРё" size={40} secondary buttonProps={{ onClick: onParticipantsClick }}>
          <PeopleOutlineRoundedIcon />
        </ControlButton>
        <ControlButton label={isChatOpen ? 'РЎРєСЂС‹С‚СЊ С‡Р°С‚' : 'РћС‚РєСЂС‹С‚СЊ С‡Р°С‚'} size={40} active={isChatOpen} secondary buttonProps={{ onClick: onChatClick }}>
          {isChatOpen ? <ChevronRightRoundedIcon /> : <ChatBubbleOutlineRoundedIcon />}
        </ControlButton>
        <ControlButton label="Р’С‹Р№С‚Рё РёР· Р·РІРѕРЅРєР°" size={54} danger buttonProps={leaveButtonProps}>
          <CallEndRoundedIcon />
        </ControlButton>
      </Stack>
    </Box>
  );
}
