import MoreHorizRoundedIcon from '@mui/icons-material/MoreHorizRounded';
import PersonRoundedIcon from '@mui/icons-material/PersonRounded';
import { Box, Chip, IconButton, Paper, Stack, Typography } from '@mui/material';

import type { SessionTask } from '../../types';
import { taskStatusLabels } from '../../pages/video-session/sessionIntelligence';

export function TaskCard({
  task,
  dragging,
  onDragStart,
  onDragEnd,
  onOpen,
}: {
  task: SessionTask;
  dragging: boolean;
  onDragStart: (taskId: number) => void;
  onDragEnd: () => void;
  onOpen: (task: SessionTask) => void;
}) {
  return (
    <Paper
      draggable
      onClick={() => onOpen(task)}
      onDragStart={() => onDragStart(task.id)}
      onDragEnd={onDragEnd}
      sx={{
        p: 1.5,
        borderRadius: 3,
        border: '1px solid',
        borderColor: '#e5e7eb',
        backgroundColor: '#ffffff',
        cursor: 'grab',
        opacity: dragging ? 0.5 : 1,
        boxShadow: dragging ? '0 12px 28px rgba(15, 23, 42, 0.12)' : '0 2px 10px rgba(15, 23, 42, 0.04)',
        transition: 'box-shadow 160ms ease, transform 160ms ease, border-color 160ms ease',
        '&:hover': {
          borderColor: '#cbd5e1',
          boxShadow: '0 10px 24px rgba(15, 23, 42, 0.08)',
          transform: 'translateY(-1px)',
        },
        '&:hover .task-card-actions': {
          opacity: 1,
        },
      }}
    >
      <Stack spacing={1.25}>
        <Stack direction="row" spacing={1} justifyContent="space-between" alignItems="flex-start">
          <Typography variant="subtitle2" sx={{ lineHeight: 1.4 }}>
            {task.title}
          </Typography>
          <Box className="task-card-actions" sx={{ opacity: 0, transition: 'opacity 140ms ease' }}>
            <IconButton size="small">
              <MoreHorizRoundedIcon fontSize="small" />
            </IconButton>
          </Box>
        </Stack>

        <Stack direction="row" spacing={0.75} useFlexGap flexWrap="wrap">
          <Chip
            size="small"
            icon={<PersonRoundedIcon />}
            label={task.assignee?.full_name ?? 'Unassigned'}
            sx={{ maxWidth: 170 }}
          />
          <Chip size="small" variant="outlined" label={taskStatusLabels[task.status]} />
        </Stack>
      </Stack>
    </Paper>
  );
}
