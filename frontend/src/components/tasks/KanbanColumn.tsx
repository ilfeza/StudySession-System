import { Box, Chip, Paper, Stack, Typography } from '@mui/material';
import type { DragEvent, ReactNode } from 'react';

export function KanbanColumn({
  title,
  count,
  emptyLabel,
  activeDrop,
  onDragOver,
  onDragLeave,
  onDrop,
  children,
}: {
  title: string;
  count: number;
  emptyLabel: string;
  activeDrop: boolean;
  onDragOver: (event: DragEvent<HTMLDivElement>) => void;
  onDragLeave: () => void;
  onDrop: () => void;
  children: ReactNode;
}) {
  return (
    <Paper
      onDragOver={onDragOver}
      onDragLeave={onDragLeave}
      onDrop={onDrop}
      sx={{
        p: 1.5,
        borderRadius: 2.5,
        border: '1px solid',
        borderColor: activeDrop ? '#cbd5e1' : '#e5e7eb',
        backgroundColor: activeDrop ? '#f8fafc' : '#fbfbfc',
        display: 'flex',
        flexDirection: 'column',
        gap: 1.25,
        minWidth: 280,
        height: '100%',
        minHeight: 0,
        flex: '1 0 280px',
      }}
    >
      <Stack direction="row" justifyContent="space-between" alignItems="center" spacing={1}>
        <Typography variant="subtitle2">{title}</Typography>
        <Chip size="small" label={count} />
      </Stack>

      <Box sx={{ flex: 1, minHeight: 0, overflowY: 'auto', pr: 0.25 }}>
        <Stack spacing={1}>
          {count ? children : (
            <Paper sx={{ p: 2, borderRadius: 2, textAlign: 'center', bgcolor: '#ffffff', border: '1px dashed #e2e8f0' }}>
              <Typography variant="body2" color="text.secondary">
                {emptyLabel}
              </Typography>
            </Paper>
          )}
        </Stack>
      </Box>
    </Paper>
  );
}
