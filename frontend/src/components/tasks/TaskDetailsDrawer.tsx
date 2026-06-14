import AutorenewRoundedIcon from '@mui/icons-material/AutorenewRounded';
import DeleteOutlineRoundedIcon from '@mui/icons-material/DeleteOutlineRounded';
import { Box, Button, Drawer, MenuItem, Stack, TextField, Typography } from '@mui/material';
import { useEffect, useState } from 'react';

import type { SessionParticipant, SessionTask, SessionTaskStatus } from '../../types';

const statusLabels: Record<SessionTaskStatus, string> = {
  backlog: 'Бэклог',
  assigned: 'Назначено',
  in_progress: 'В работе',
  blocked: 'Заблокировано',
  done: 'Готово',
};

import { DeadlineInput } from './DeadlineInput';

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
    status: 'backlog' as SessionTaskStatus,
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
      deadline: task.deadline ? String(task.deadline) : '',
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
          <Typography variant="h6">Детали задачи</Typography>
        </Box>

        <TextField label="Название" value={form.title} onChange={(event) => setForm((prev) => ({ ...prev, title: event.target.value }))} />
        <TextField label="Описание" value={form.description} onChange={(event) => setForm((prev) => ({ ...prev, description: event.target.value }))} multiline minRows={4} />
        <TextField
          select
          label="Исполнитель"
          value={form.assignee_id}
          onChange={(event) => {
            const nextAssigneeId = event.target.value;
            setForm((prev) => ({
              ...prev,
              assignee_id: nextAssigneeId,
              status: nextAssigneeId
                ? (prev.status === 'backlog' ? 'assigned' : prev.status)
                : (prev.status === 'assigned' ? 'backlog' : prev.status),
            }));
          }}
        >
          <MenuItem value="">Без исполнителя</MenuItem>
          {participants.map((participant) => (
            <MenuItem key={participant.id} value={String(participant.id)}>
              {participant.full_name}
            </MenuItem>
          ))}
        </TextField>
        <TextField select label="Колонка Kanban" value={form.status} onChange={(event) => setForm((prev) => ({ ...prev, status: event.target.value as SessionTaskStatus }))}>
          {Object.entries(statusLabels).map(([value, label]) => (
            <MenuItem key={value} value={value}>
              {label}
            </MenuItem>
          ))}
        </TextField>
        <TextField select label="Приоритет" value={form.priority} onChange={(event) => setForm((prev) => ({ ...prev, priority: event.target.value as SessionTask['priority'] }))}>
          <MenuItem value="low">Низкий</MenuItem>
          <MenuItem value="medium">Средний</MenuItem>
          <MenuItem value="high">Высокий</MenuItem>
          <MenuItem value="critical">Критичный</MenuItem>
        </TextField>
        <DeadlineInput
          value={form.deadline}
          onChange={(deadline) => setForm((prev) => ({ ...prev, deadline }))}
        />

        <Stack direction="row" spacing={1}>
          <Button
            variant="contained"
            fullWidth
            onClick={() => task && void onSave(task.id, { ...form, assignee_id: form.assignee_id ? Number(form.assignee_id) : null, deadline: form.deadline || null })}
            disabled={!task || !form.title.trim()}
          >
            Сохранить
          </Button>
          <Button variant="outlined" fullWidth startIcon={<AutorenewRoundedIcon />} onClick={() => task && onReassign(task)} disabled={!task}>
            Переназначить
          </Button>
        </Stack>

        <Button
          variant="outlined"
          color="error"
          startIcon={<DeleteOutlineRoundedIcon />}
          onClick={() => task && void onDelete(task.id)}
          disabled={!task}
        >
          Удалить задачу
        </Button>
      </Stack>
    </Drawer>
  );
}
