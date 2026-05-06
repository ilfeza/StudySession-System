import MicOffRoundedIcon from '@mui/icons-material/MicOffRounded';
import { Box } from '@mui/material';
import { alpha } from '@mui/material/styles';
import { ParticipantTile as LiveKitParticipantTile } from '@livekit/components-react';
import type { ComponentProps } from 'react';

export function ParticipantTile({
  trackRef,
  single,
}: {
  trackRef: ComponentProps<typeof LiveKitParticipantTile>['trackRef'];
  single: boolean;
}) {
  return (
    <Box
      sx={{
        width: '100%',
        maxWidth: single ? 'min(100%, 1080px)' : '100%',
        aspectRatio: '16 / 9',
        overflow: 'hidden',
        borderRadius: { xs: 4, md: 5 },
        border: '1px solid',
        borderColor: '#e5e7eb',
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
          objectFit: 'cover',
        },
        '& .lk-participant-placeholder': {
          width: '100%',
          height: '100%',
          background: 'linear-gradient(180deg, #cbd5e1 0%, #94a3b8 100%)',
        },
        '& .lk-participant-metadata': {
          left: 12,
          right: 12,
          bottom: 12,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: 1,
          px: 1.5,
          py: 1,
          borderRadius: 999,
          backgroundColor: alpha('#0f172a', 0.72),
          backdropFilter: 'blur(10px)',
        },
        '& .lk-participant-name': {
          color: '#ffffff',
          fontWeight: 600,
          fontSize: '0.92rem',
        },
        '& .lk-audio-indicator': {
          color: '#ffffff',
        },
        '& .lk-participant-metadata > *:last-child svg': {
          fontSize: 18,
        },
      }}
    >
      <LiveKitParticipantTile trackRef={trackRef} />
      {trackRef && 'publication' in trackRef && trackRef.publication?.isMuted ? (
        <Box
          sx={{
            position: 'absolute',
            top: 12,
            right: 12,
            width: 34,
            height: 34,
            display: 'grid',
            placeItems: 'center',
            borderRadius: '50%',
            backgroundColor: alpha('#ffffff', 0.92),
            color: '#b91c1c',
            boxShadow: '0 8px 24px rgba(15, 23, 42, 0.16)',
          }}
        >
          <MicOffRoundedIcon fontSize="small" />
        </Box>
      ) : null}
    </Box>
  );
}
