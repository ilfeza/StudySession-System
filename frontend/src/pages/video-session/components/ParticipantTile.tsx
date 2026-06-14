import MicOffRoundedIcon from '@mui/icons-material/MicOffRounded';
import TaskAltRoundedIcon from '@mui/icons-material/TaskAltRounded';
import { Box, ButtonBase, Stack, Typography } from '@mui/material';
import { alpha } from '@mui/material/styles';
import { ParticipantTile as LiveKitParticipantTile } from '@livekit/components-react';
import { useEffect, useState, type ComponentProps } from 'react';

import { formatCountdown } from '../../../components/tasks/deadlineField';

type ParticipantTaskInfo = {
  title: string;
  description: string;
  status: string;
  deadline?: string | null;
} | null;

export function ParticipantTile({
  trackRef,
  single,
  task,
  onTaskClick,
}: {
  trackRef: ComponentProps<typeof LiveKitParticipantTile>['trackRef'];
  single: boolean;
  task?: ParticipantTaskInfo;
  onTaskClick?: () => void;
}) {
  const [nowMs, setNowMs] = useState(() => Date.now());

  useEffect(() => {
    if (!task?.deadline) {
      return undefined;
    }
    const timer = window.setInterval(() => setNowMs(Date.now()), 1000);
    return () => window.clearInterval(timer);
  }, [task?.deadline]);

  const countdownLabel = task?.deadline
    ? formatCountdown(Math.floor((new Date(task.deadline).getTime() - nowMs) / 1000))
    : null;
  const countdownOverdue = task?.deadline ? new Date(task.deadline).getTime() < nowMs : false;
  return (
    <Box
      sx={{
        position: 'relative',
        width: '100%',
        maxWidth: single ? 'min(100%, 980px)' : '100%',
        height: single ? 'auto' : '100%',
        minHeight: 0,
        aspectRatio: single ? '16 / 9' : 'auto',
        overflow: 'hidden',
        borderRadius: 2,
        border: '1px solid',
        borderColor: alpha('#e2e8f0', 0.7),
        backgroundColor: '#0f172a',
        boxShadow: '0 18px 45px rgba(15, 23, 42, 0.12)',
        '& .lk-participant-tile': {
          width: '100%',
          height: '100%',
          position: 'relative',
          overflow: 'hidden',
          background: 'linear-gradient(180deg, #e2e8f0 0%, #cbd5e1 100%)',
        },
        '& .lk-participant-media-video': {
          width: '100%',
          height: '100%',
          objectFit: single ? 'contain' : 'cover',
          backgroundColor: '#020617',
        },
        '& .lk-participant-placeholder': {
          width: '100%',
          height: '100%',
          background: 'linear-gradient(180deg, #cbd5e1 0%, #94a3b8 100%)',
        },
        '& .lk-participant-metadata': {
          left: 12,
          right: 12,
          bottom: 10,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: 1,
          px: 0,
          py: 0,
          backgroundColor: 'transparent',
        },
        '& .lk-participant-name': {
          color: '#ffffff',
          fontWeight: 700,
          fontSize: '0.92rem',
          textShadow: '0 2px 8px rgba(2, 6, 23, 0.72)',
        },
        '& .lk-audio-indicator, & .lk-connection-quality': {
          color: '#f8fafc',
          filter: 'drop-shadow(0 2px 6px rgba(2, 6, 23, 0.8))',
        },
        '& .lk-participant-metadata > *:last-child svg': {
          fontSize: 18,
        },
      }}
    >
      <LiveKitParticipantTile trackRef={trackRef} />

      {task ? (
        <ButtonBase
          onClick={onTaskClick}
          sx={{
            position: 'absolute',
            left: 10,
            top: 10,
            zIndex: 2,
            maxWidth: 'calc(100% - 20px)',
            borderRadius: 1.5,
            overflow: 'hidden',
            backgroundColor: alpha('#020617', 0.58),
            border: '1px solid rgba(255,255,255,0.12)',
            backdropFilter: 'blur(12px)',
            textAlign: 'left',
            px: 1.25,
            py: 0.75,
            alignItems: 'stretch',
          }}
        >
          <Stack spacing={0.25} sx={{ minWidth: 0 }}>
            <Stack direction="row" spacing={1} alignItems="center" sx={{ minWidth: 0, flexWrap: 'wrap' }}>
              <TaskAltRoundedIcon sx={{ color: '#f8fafc', fontSize: 18, flexShrink: 0 }} />
              <Typography variant="caption" sx={{ color: alpha('#ffffff', 0.72) }}>
                Текущая задача
              </Typography>
              {countdownLabel ? (
                <Typography
                  variant="caption"
                  sx={{
                    color: countdownOverdue ? '#fca5a5' : '#86efac',
                    fontWeight: 700,
                    fontVariantNumeric: 'tabular-nums',
                  }}
                >
                  {countdownLabel}
                </Typography>
              ) : null}
            </Stack>
            <Typography
              variant="body2"
              sx={{
                color: '#ffffff',
                fontWeight: 700,
                display: '-webkit-box',
                overflow: 'hidden',
                WebkitLineClamp: 1,
                WebkitBoxOrient: 'vertical',
              }}
            >
              {task.title}
            </Typography>
          </Stack>
        </ButtonBase>
      ) : null}

      {trackRef && 'publication' in trackRef && trackRef.publication?.isMuted ? (
        <Box
          sx={{
            position: 'absolute',
            top: 12,
            right: 12,
            width: 32,
            height: 32,
            display: 'grid',
            placeItems: 'center',
            borderRadius: 1.5,
            backgroundColor: alpha('#ffffff', 0.92),
            color: '#b91c1c',
            boxShadow: '0 8px 24px rgba(15, 23, 42, 0.16)',
          }}
        >
          <MicOffRoundedIcon sx={{ fontSize: 18 }} />
        </Box>
      ) : null}
    </Box>
  );
}
