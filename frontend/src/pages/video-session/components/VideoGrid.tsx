import { RoomAudioRenderer, useTracks } from '@livekit/components-react';
import { Box } from '@mui/material';
import { Track } from 'livekit-client';

import { ParticipantTile } from './ParticipantTile';

function getGridTemplate(count: number) {
  if (count <= 1) {
    return { columns: 'minmax(0, 1fr)', justifyItems: 'center' } as const;
  }
  if (count <= 4) {
    return {
      columns: { xs: '1fr', sm: 'repeat(2, minmax(0, 1fr))' },
      justifyItems: 'stretch',
    } as const;
  }
  if (count <= 9) {
    return {
      columns: { xs: '1fr', sm: 'repeat(2, minmax(0, 1fr))', xl: 'repeat(3, minmax(0, 1fr))' },
      justifyItems: 'stretch',
    } as const;
  }
  return {
    columns: {
      xs: '1fr',
      sm: 'repeat(2, minmax(0, 1fr))',
      lg: 'repeat(3, minmax(0, 1fr))',
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
        sx={{
          display: 'grid',
          gap: { xs: 2, md: 2.5 },
          px: { xs: 2, md: 3 },
          pt: { xs: 2, md: 3 },
          pb: { xs: 12, md: 13 },
          width: '100%',
          height: '100%',
          minHeight: 0,
          gridTemplateColumns: grid.columns,
          gridAutoRows: 'minmax(0, 1fr)',
          alignContent: count === 1 ? 'center' : 'stretch',
          justifyItems: grid.justifyItems,
        }}
      >
        {tracks.map((trackRef, index) => {
          const key = 'participant' in trackRef
            ? `${trackRef.participant.identity}-${trackRef.source}-${'publication' in trackRef && trackRef.publication ? trackRef.publication.trackSid : 'placeholder'}`
            : String(index);

          return <ParticipantTile key={key} trackRef={trackRef} single={count === 1} />;
        })}
      </Box>
      <RoomAudioRenderer />
    </Box>
  );
}
