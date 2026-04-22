import AddTaskRoundedIcon from '@mui/icons-material/AddTaskRounded';
import { Box, Button, Chip, Paper, Stack, TextField, Typography } from '@mui/material';
import { useEffect, useState } from 'react';

import { api } from '../api/client';
import { Task } from '../types';

interface Props {
  groupId: number;
  moderatorMode?: boolean;
}

const labels: Record<Task['priority'], string> = {
  low: 'Низкий',
  medium: 'Средний',
  high: 'Высокий',
  critical: 'Критичный',
};

export function TaskHub({ groupId, moderatorMode = false }: Props) {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');

  function reload() {
    api.get<Task[]>(`/tasks/group/${groupId}`).then((response) => setTasks(response.data));
  }

  useEffect(() => {
    reload();
  }, [groupId]);

  async function createTask() {
    if (!title.trim()) {
      return;
    }
    await api.post('/tasks', {
      group_id: groupId,
      title,
      description,
      required_skills: [],
      priority: 'medium',
    });
    setTitle('');
    setDescription('');
    reload();
  }

  return (
    <Paper sx={{ p: 2 }}>
      <Typography variant="h6">Центр задач</Typography>
      <Typography variant="body2" color="text.secondary">Управление задачами и динамическим назначением.</Typography>
      {moderatorMode && (
        <Stack spacing={1} sx={{ mt: 2, mb: 2 }}>
          <TextField label="Название задачи" value={title} onChange={(event) => setTitle(event.target.value)} />
          <TextField label="Описание" value={description} onChange={(event) => setDescription(event.target.value)} multiline rows={2} />
          <Button variant="contained" startIcon={<AddTaskRoundedIcon />} onClick={createTask}>Создать задачу</Button>
        </Stack>
      )}
      <Stack spacing={1.5}>
        {tasks.map((task) => (
          <Box key={task.id} sx={{ p: 1.5, border: '1px solid #e8edf6', borderRadius: 2, backgroundColor: '#fff' }}>
            <Stack direction="row" spacing={1} justifyContent="space-between" alignItems="center">
              <Typography fontWeight={700}>{task.title}</Typography>
              <Chip label={labels[task.priority]} color={task.priority === 'critical' ? 'error' : 'primary'} size="small" />
            </Stack>
            <Typography variant="body2" color="text.secondary">{task.description || 'Описание пока не заполнено.'}</Typography>
          </Box>
        ))}
      </Stack>
    </Paper>
  );
}

