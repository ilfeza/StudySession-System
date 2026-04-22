import AddTaskRoundedIcon from '@mui/icons-material/AddTaskRounded';
import {
  Button,
  MenuItem,
  Stack,
  TextField,
} from '@mui/material';
import { useState } from 'react';

import type { SessionParticipant, SessionTaskStatus } from '../../types';

interface Props {
  participants: SessionParticipant[];
  disabled?: boolean;
  submitLabel?: string;
  onSubmitted?: () => void;
  onSubmit: (payload: {
    title: string;
    description: string;
    assignee_id: number | null;
    deadline: string | null;
    status: SessionTaskStatus;
  }) => Promise<void>;
}

export function TaskCreateForm({
  participants,
  disabled = false,
  submitLabel = 'Создать задачу',
  onSubmitted,
  onSubmit,
}: Props) {
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [assigneeId, setAssigneeId] = useState('');
  const [deadline, setDeadline] = useState('');
  const [status, setStatus] = useState<SessionTaskStatus>('todo');
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit() {
    if (!title.trim()) {
      return;
    }

    setSubmitting(true);
    try {
      await onSubmit({
        title: title.trim(),
        description: description.trim(),
        assignee_id: assigneeId ? Number(assigneeId) : null,
        deadline: deadline || null,
        status,
      });
      setTitle('');
      setDescription('');
      setAssigneeId('');
      setDeadline('');
      setStatus('todo');
      onSubmitted?.();
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Stack spacing={1.25}>
      <TextField
        label="Название задачи"
        value={title}
        onChange={(event) => setTitle(event.target.value)}
        disabled={disabled || submitting}
        required
      />
      <TextField
        label="Описание"
        value={description}
        onChange={(event) => setDescription(event.target.value)}
        disabled={disabled || submitting}
        multiline
        minRows={3}
      />
      <TextField
        select
        label="Исполнитель"
        value={assigneeId}
        onChange={(event) => setAssigneeId(event.target.value)}
        disabled={disabled || submitting}
      >
        <MenuItem value="">Без исполнителя</MenuItem>
        {participants.map((participant) => (
          <MenuItem key={participant.id} value={String(participant.id)}>
            {participant.full_name}
          </MenuItem>
        ))}
      </TextField>
      <TextField
        select
        label="Статус"
        value={status}
        onChange={(event) => setStatus(event.target.value as SessionTaskStatus)}
        disabled={disabled || submitting}
      >
        <MenuItem value="todo">To do</MenuItem>
        <MenuItem value="in_progress">In progress</MenuItem>
        <MenuItem value="done">Done</MenuItem>
      </TextField>
      <TextField
        label="Дедлайн"
        type="datetime-local"
        value={deadline}
        onChange={(event) => setDeadline(event.target.value)}
        disabled={disabled || submitting}
        InputLabelProps={{ shrink: true }}
      />
      <Button
        variant="contained"
        startIcon={<AddTaskRoundedIcon />}
        onClick={handleSubmit}
        disabled={disabled || submitting || !title.trim()}
      >
        {submitLabel}
      </Button>
    </Stack>
  );
}
