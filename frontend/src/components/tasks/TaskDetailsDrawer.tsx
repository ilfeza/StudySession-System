import DeleteOutlineRoundedIcon from '@mui/icons-material/DeleteOutlineRounded';
import AutorenewRoundedIcon from '@mui/icons-material/AutorenewRounded';
import { Box, Button, Drawer, MenuItem, Stack, TextField, Typography } from '@mui/material';
import { useEffect, useState } from 'react';

import type { SessionParticipant, SessionTask, SessionTaskStatus } from '../../types';

function toInputDateTime(value?: string | null) {
  if (!value) {
    return '';
  }
  const date = new Date(value);
  const offset = date.getTimezoneOffset();
  const normalized = new Date(date.getTime() - offset * 60_000);
  return normalized.toISOString().slice(0, 16);
}

export function TaskDetailsDrawer({
  task,
  participants,
  open,
  onClose,
  onSave,
  onDelete,
  onReassign,
}: {
  task: SessionTask | null;
  participants: SessionParticipant[];
  open: boolean;
  onClose: () => void;
  onSave: (taskId: number, payload: { title: string; description: string; assignee_id: number | null; deadline: string | null; status: SessionTaskStatus; priority: SessionTask['priority'] }) => Promise<void>;
  onDelete: (taskId: number) => Promise<void>;
  onReassign: (task: SessionTask) => void;
}) {
  const [form, setForm] = useState({
    title: '',
    description: '',
    assignee_id: '',
    deadline: '',
    status: 'todo' as SessionTaskStatus,
    priority: 'medium' as SessionTask['priority'],
  });

  useEffect(() => {
    if (!task) {
      return;
    }
    setForm({
      title: task.title,
      description: task.description,
      assignee_id: task.assignee_id ? String(task.assignee_id) : '',
      deadline: toInputDateTime(task.deadline),
      status: task.status,
      priority: task.priority,
    });
  }, [task]);

  return (
    <Drawer
      anchor="right"
      open={open}
      onClose={onClose}
      PaperProps={{
        sx: {
          width: '100%',
          maxWidth: 420,
          p: 2.5,
          backgroundColor: '#ffffff',
        },
      }}
    >
      <Stack spacing={2}>
        <Box>
          <Typography variant="h6">Task details</Typography>
          <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
            Быстрое редактирование без перегрузки самой доски.
          </Typography>
        </Box>

        <TextField label="Название" value={form.title} onChange={(event) => setForm((prev) => ({ ...prev, title: event.target.value }))} />
        <TextField label="Описание" value={form.description} onChange={(event) => setForm((prev) => ({ ...prev, description: event.target.value }))} multiline minRows={4} />
        <TextField select label="Исполнитель" value={form.assignee_id} onChange={(event) => setForm((prev) => ({ ...prev, assignee_id: event.target.value }))}>
          <MenuItem value="">Unassigned</MenuItem>
          {participants.map((participant) => (
            <MenuItem key={participant.id} value={String(participant.id)}>
              {participant.full_name}
            </MenuItem>
          ))}
        </TextField>
        <TextField select label="Статус" value={form.status} onChange={(event) => setForm((prev) => ({ ...prev, status: event.target.value as SessionTaskStatus }))}>
          <MenuItem value="todo">Todo</MenuItem>
          <MenuItem value="in_progress">In Progress</MenuItem>
          <MenuItem value="blocked">Blocked</MenuItem>
          <MenuItem value="needs_reassignment">Needs reassignment</MenuItem>
          <MenuItem value="done">Done</MenuItem>
        </TextField>
        <TextField select label="Приоритет" value={form.priority} onChange={(event) => setForm((prev) => ({ ...prev, priority: event.target.value as SessionTask['priority'] }))}>
          <MenuItem value="low">Low</MenuItem>
          <MenuItem value="medium">Medium</MenuItem>
          <MenuItem value="high">High</MenuItem>
          <MenuItem value="critical">Critical</MenuItem>
        </TextField>
        <TextField label="Дедлайн" type="datetime-local" value={form.deadline} onChange={(event) => setForm((prev) => ({ ...prev, deadline: event.target.value }))} InputLabelProps={{ shrink: true }} />

        <Stack direction="row" spacing={1}>
          <Button
            variant="contained"
            fullWidth
            onClick={() => task && void onSave(task.id, { ...form, assignee_id: form.assignee_id ? Number(form.assignee_id) : null, deadline: form.deadline || null })}
            disabled={!task || !form.title.trim()}
          >
            Save changes
          </Button>
          <Button variant="outlined" startIcon={<AutorenewRoundedIcon />} onClick={() => task && onReassign(task)} disabled={!task}>
            Reassign
          </Button>
        </Stack>

        <Button
          variant="outlined"
          color="error"
          startIcon={<DeleteOutlineRoundedIcon />}
          onClick={() => task && void onDelete(task.id)}
          disabled={!task}
        >
          Delete task
        </Button>
      </Stack>
    </Drawer>
  );
}
