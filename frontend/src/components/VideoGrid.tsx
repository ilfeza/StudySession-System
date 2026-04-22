import { GridLayout, ParticipantTile, RoomAudioRenderer, useTracks } from '@livekit/components-react';
import { Paper, Typography } from '@mui/material';
import { Track } from 'livekit-client';

export function VideoGrid() {
  const tracks = useTracks([
    { source: Track.Source.Camera, withPlaceholder: true },
  ]);

  return (
    <Paper sx={{ p: 2 }}>
      <Typography variant="h6" sx={{ mb: 2 }}>Видеосетка участников</Typography>
      <GridLayout tracks={tracks} style={{ height: 420 }}>
        <ParticipantTile />
      </GridLayout>
      <RoomAudioRenderer />
    </Paper>
  );
}
