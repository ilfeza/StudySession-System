import { ParticipantTile, RoomAudioRenderer, useTracks } from '@livekit/components-react';
import { Box } from '@mui/material';
import { alpha } from '@mui/material/styles';
import { Track } from 'livekit-client';

function getGridTemplate(count: number) {
  if (count <= 1) {
    return {
      columns: { xs: 'minmax(0, 1fr)' },
      maxWidth: 960,
      justifyItems: 'center',
    } as const;
  }

  if (count === 2) {
    return {
      columns: { xs: '1fr', sm: 'repeat(2, minmax(0, 1fr))' },
      justifyItems: 'stretch',
    } as const;
  }

  if (count <= 4) {
    return {
      columns: { xs: '1fr', sm: 'repeat(2, minmax(0, 1fr))' },
      justifyItems: 'stretch',
    } as const;
  }

  if (count <= 6) {
    return {
      columns: { xs: '1fr', sm: 'repeat(2, minmax(0, 1fr))', lg: 'repeat(3, minmax(0, 1fr))' },
      justifyItems: 'stretch',
    } as const;
  }

  if (count <= 9) {
    return {
      columns: { xs: '1fr', sm: 'repeat(2, minmax(0, 1fr))', md: 'repeat(3, minmax(0, 1fr))' },
      justifyItems: 'stretch',
    } as const;
  }

  return {
    columns: {
      xs: '1fr',
      sm: 'repeat(2, minmax(0, 1fr))',
      md: 'repeat(3, minmax(0, 1fr))',
      xl: 'repeat(4, minmax(0, 1fr))',
    },
    justifyItems: 'stretch',
  } as const;
}

export function VideoGrid() {
  const tracks = useTracks(
    [{ source: Track.Source.Camera, withPlaceholder: true }],
    { onlySubscribed: false },
  );
  const count = Math.max(tracks.length, 1);
  const grid = getGridTemplate(count);

  return (
    <Box sx={{ height: '100%', width: '100%' }}>
      <Box
        className="video-grid"
        sx={{
          display: 'grid',
          gap: '16px',
          px: { xs: 2, md: 3 },
          pt: { xs: 2, md: 3 },
          pb: { xs: 10, md: 12 },
          width: '100%',
          height: '100%',
          minHeight: 0,
          gridTemplateColumns: grid.columns,
          gridAutoRows: 'minmax(0, 1fr)',
          alignContent: count === 1 ? 'center' : 'stretch',
          justifyItems: grid.justifyItems,
          maxWidth: count === 1 ? '960px' : '100%',
          mx: 'auto',
          '& .lk-participant-tile': {
            position: 'relative',
            width: '100%',
            maxWidth: count === 1 ? '960px' : '100%',
            aspectRatio: '16 / 9',
            overflow: 'hidden',
            borderRadius: '12px',
            border: `1px solid ${alpha('#ffffff', 0.08)}`,
            backgroundColor: '#0b1422',
          },
          '& .lk-participant-media-video': {
            width: '100%',
            height: '100%',
            objectFit: 'cover',
          },
          '& .lk-participant-placeholder': {
            width: '100%',
            height: '100%',
            background: 'linear-gradient(180deg, #16233a 0%, #0b1422 100%)',
          },
          '& .lk-participant-metadata': {
            left: 0,
            right: 0,
            bottom: 0,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: 1,
            px: 1.75,
            py: 1.25,
            background: 'linear-gradient(180deg, rgba(8, 17, 31, 0) 0%, rgba(8, 17, 31, 0.92) 100%)',
          },
          '& .lk-participant-name': {
            color: '#f8fbff',
            fontWeight: 600,
            fontSize: '0.92rem',
          },
          '& .lk-audio-indicator, & .lk-participant-metadata > *:last-child': {
            color: alpha('#ffffff', 0.82),
          },
        }}
      >
        {tracks.map((trackRef, index) => {
          const key = 'participant' in trackRef
            ? `${trackRef.participant.identity}-${trackRef.source}-${'publication' in trackRef && trackRef.publication ? trackRef.publication.trackSid : 'placeholder'}`
            : String(index);

          return <ParticipantTile key={key} trackRef={trackRef} />;
        })}
      </Box>
      <RoomAudioRenderer />
    </Box>
  );
}
