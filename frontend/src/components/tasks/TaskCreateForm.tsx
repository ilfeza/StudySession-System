import AddTaskRoundedIcon from '@mui/icons-material/AddTaskRounded';
import { Button, MenuItem, Stack, TextField } from '@mui/material';
import { useState } from 'react';

import type { SessionParticipant, SessionTaskStatus, Task } from '../../types';

const statusLabels: Record<SessionTaskStatus, string> = {
  backlog: 'Бэклог',
  assigned: 'Назначено',
  in_progress: 'В работе',
  blocked: 'Заблокировано',
  done: 'Готово',
};

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
    priority: Task['priority'];
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
  const [status, setStatus] = useState<SessionTaskStatus>('backlog');
  const [priority, setPriority] = useState<Task['priority']>('medium');
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
        priority,
      });
      setTitle('');
      setDescription('');
      setAssigneeId('');
      setDeadline('');
      setStatus('backlog');
      setPriority('medium');
      onSubmitted?.();
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Stack spacing={1.5} sx={{ pt: 1 }}>
      <TextField label="Название задачи" value={title} onChange={(event) => setTitle(event.target.value)} disabled={disabled || submitting} required />
      <TextField label="Описание" value={description} onChange={(event) => setDescription(event.target.value)} disabled={disabled || submitting} multiline minRows={4} />
      <TextField
        select
        label="Исполнитель"
        value={assigneeId}
        onChange={(event) => {
          const nextAssigneeId = event.target.value;
          setAssigneeId(nextAssigneeId);
          setStatus((prev) => {
            if (nextAssigneeId && prev === 'backlog') {
              return 'assigned';
            }
            if (!nextAssigneeId && prev === 'assigned') {
              return 'backlog';
            }
            return prev;
          });
        }}
        disabled={disabled || submitting}
      >
        <MenuItem value="">Без исполнителя</MenuItem>
        {participants.map((participant) => (
          <MenuItem key={participant.id} value={String(participant.id)}>
            {participant.full_name}
          </MenuItem>
        ))}
      </TextField>
      <TextField select label="Колонка Kanban" value={status} onChange={(event) => setStatus(event.target.value as SessionTaskStatus)} disabled={disabled || submitting}>
        {Object.entries(statusLabels).map(([value, label]) => (
          <MenuItem key={value} value={value}>
            {label}
          </MenuItem>
        ))}
      </TextField>
      <TextField select label="Приоритет" value={priority} onChange={(event) => setPriority(event.target.value as Task['priority'])} disabled={disabled || submitting}>
        <MenuItem value="low">Низкий</MenuItem>
        <MenuItem value="medium">Средний</MenuItem>
        <MenuItem value="high">Высокий</MenuItem>
        <MenuItem value="critical">Критичный</MenuItem>
      </TextField>
      <TextField label="Дедлайн" type="datetime-local" value={deadline} onChange={(event) => setDeadline(event.target.value)} disabled={disabled || submitting} InputLabelProps={{ shrink: true }} />
      <Button variant="contained" startIcon={<AddTaskRoundedIcon />} onClick={handleSubmit} disabled={disabled || submitting || !title.trim()}>
        {submitLabel}
      </Button>
    </Stack>
  );
}
