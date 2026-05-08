import ChevronLeftRoundedIcon from '@mui/icons-material/ChevronLeftRounded';
import ChevronRightRoundedIcon from '@mui/icons-material/ChevronRightRounded';
import { RoomAudioRenderer, useTracks } from '@livekit/components-react';
import { Box, IconButton, Stack, Typography } from '@mui/material';
import { alpha } from '@mui/material/styles';
import { useEffect, useMemo, useState } from 'react';
import { Track } from 'livekit-client';

import { ParticipantTile } from './ParticipantTile';

function resolveGrid(count: number) {
  if (count <= 1) {
    return { columns: 'minmax(0, 1fr)', rows: 'minmax(0, 1fr)', justifyItems: 'center' } as const;
  }
  if (count === 2) {
    return { columns: 'repeat(2, minmax(0, 1fr))', rows: 'minmax(0, 1fr)', justifyItems: 'stretch' } as const;
  }
  if (count <= 4) {
    return { columns: 'repeat(2, minmax(0, 1fr))', rows: 'repeat(2, minmax(0, 1fr))', justifyItems: 'stretch' } as const;
  }
  if (count <= 6) {
    return { columns: 'repeat(3, minmax(0, 1fr))', rows: 'repeat(2, minmax(0, 1fr))', justifyItems: 'stretch' } as const;
  }
  if (count <= 9) {
    return { columns: 'repeat(3, minmax(0, 1fr))', rows: 'repeat(3, minmax(0, 1fr))', justifyItems: 'stretch' } as const;
  }
  return { columns: 'repeat(4, minmax(0, 1fr))', rows: 'repeat(3, minmax(0, 1fr))', justifyItems: 'stretch' } as const;
}

export function VideoGrid({ chatOpen }: { chatOpen: boolean }) {
  const tracks = useTracks(
    [{ source: Track.Source.Camera, withPlaceholder: true }],
    { onlySubscribed: false },
  );
  const pageSize = chatOpen ? 9 : 12;
  const totalPages = Math.max(1, Math.ceil(Math.max(tracks.length, 1) / pageSize));
  const [page, setPage] = useState(0);

  useEffect(() => {
    setPage(0);
  }, [pageSize]);

  useEffect(() => {
    setPage((prev) => Math.min(prev, totalPages - 1));
  }, [totalPages]);

  const visibleTracks = useMemo(() => {
    if (!tracks.length) {
      return [];
    }
    const start = page * pageSize;
    return tracks.slice(start, start + pageSize);
  }, [page, pageSize, tracks]);

  const count = Math.max(visibleTracks.length, 1);
  const grid = resolveGrid(count);

  return (
    <Box sx={{ height: '100%', width: '100%', position: 'relative' }}>
      <Box
        sx={{
          display: 'grid',
          gap: { xs: 1.25, md: 1.75 },
          px: { xs: 1.5, md: 2 },
          py: { xs: 1.5, md: 2 },
          width: '100%',
          height: '100%',
          minHeight: 0,
          gridTemplateColumns: grid.columns,
          gridTemplateRows: grid.rows,
          alignContent: count === 1 ? 'center' : 'stretch',
          justifyItems: grid.justifyItems,
        }}
      >
        {visibleTracks.map((trackRef, index) => {
          const key = 'participant' in trackRef
            ? `${trackRef.participant.identity}-${trackRef.source}-${'publication' in trackRef && trackRef.publication ? trackRef.publication.trackSid : 'placeholder'}`
            : String(index);

          return <ParticipantTile key={key} trackRef={trackRef} single={count === 1} />;
        })}
      </Box>

      {totalPages > 1 ? (
        <Stack
          direction="row"
          spacing={1}
          alignItems="center"
          sx={{
            position: 'absolute',
            top: 18,
            right: 18,
            zIndex: 2,
            px: 1,
            py: 0.75,
            borderRadius: 999,
            backgroundColor: alpha('#0f172a', 0.64),
            backdropFilter: 'blur(12px)',
            color: '#ffffff',
          }}
        >
          <IconButton
            size="small"
            onClick={() => setPage((prev) => Math.max(0, prev - 1))}
            disabled={page === 0}
            sx={{ color: '#ffffff', '&.Mui-disabled': { color: alpha('#ffffff', 0.4) } }}
          >
            <ChevronLeftRoundedIcon fontSize="small" />
          </IconButton>
          <Typography variant="caption" sx={{ minWidth: 92, textAlign: 'center', color: 'inherit' }}>
            {`Страница ${page + 1} из ${totalPages}`}
          </Typography>
          <IconButton
            size="small"
            onClick={() => setPage((prev) => Math.min(totalPages - 1, prev + 1))}
            disabled={page >= totalPages - 1}
            sx={{ color: '#ffffff', '&.Mui-disabled': { color: alpha('#ffffff', 0.4) } }}
          >
            <ChevronRightRoundedIcon fontSize="small" />
          </IconButton>
        </Stack>
      ) : null}

      <RoomAudioRenderer />
    </Box>
  );
}
