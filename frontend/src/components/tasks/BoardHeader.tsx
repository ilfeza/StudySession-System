import AutoAwesomeRoundedIcon from '@mui/icons-material/AutoAwesomeRounded';
import SearchRoundedIcon from '@mui/icons-material/SearchRounded';
import { Button, InputAdornment, MenuItem, Paper, Stack, TextField } from '@mui/material';
import type { MouseEvent } from 'react';

import type { SessionParticipant } from '../../types';

export function BoardHeader({
  query,
  assigneeFilter,
  participants,
  onQueryChange,
  onAssigneeFilterChange,
  onCreateTask,
  onOpenAiActions,
}: {
  query: string;
  assigneeFilter: 'all' | 'unassigned' | `${number}`;
  participants: SessionParticipant[];
  onQueryChange: (value: string) => void;
  onAssigneeFilterChange: (value: 'all' | 'unassigned' | `${number}`) => void;
  onCreateTask: () => void;
  onOpenAiActions: (event: MouseEvent<HTMLButtonElement>) => void;
}) {
  return (
    <Stack spacing={1.5}>
      <Stack direction={{ xs: 'column', md: 'row' }} justifyContent="space-between" spacing={1.25} alignItems={{ xs: 'stretch', md: 'center' }}>
        <Stack direction="row" spacing={1} justifyContent={{ xs: 'stretch', md: 'flex-end' }}>
          <Button variant="contained" onClick={onCreateTask}>
            Новая задача
          </Button>
          <Button variant="outlined" startIcon={<AutoAwesomeRoundedIcon />} onClick={onOpenAiActions}>
            AI actions
          </Button>
        </Stack>
      </Stack>

      <Paper sx={{ p: 1.25, borderRadius: 3, border: '1px solid #e5e7eb', boxShadow: '0 4px 18px rgba(15, 23, 42, 0.03)' }}>
        <Stack direction={{ xs: 'column', md: 'row' }} spacing={1}>
          <TextField
            size="small"
            placeholder="Поиск"
            value={query}
            onChange={(event) => onQueryChange(event.target.value)}
            sx={{ flex: 1 }}
            InputProps={{
              startAdornment: (
                <InputAdornment position="start">
                  <SearchRoundedIcon fontSize="small" sx={{ color: 'text.secondary' }} />
                </InputAdornment>
              ),
            }}
          />
          <TextField
            select
            size="small"
            label="Исполнитель"
            value={assigneeFilter}
            onChange={(event) => onAssigneeFilterChange(event.target.value as 'all' | 'unassigned' | `${number}`)}
            sx={{ minWidth: { xs: '100%', md: 220 } }}
          >
            <MenuItem value="all">Все</MenuItem>
            <MenuItem value="unassigned">Unassigned</MenuItem>
            {participants.map((participant) => (
              <MenuItem key={participant.id} value={String(participant.id) as `${number}`}>
                {participant.full_name}
              </MenuItem>
            ))}
          </TextField>
        </Stack>
      </Paper>
    </Stack>
  );
}
