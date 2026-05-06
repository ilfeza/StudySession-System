import AddTaskRoundedIcon from '@mui/icons-material/AddTaskRounded';
import AutoAwesomeRoundedIcon from '@mui/icons-material/AutoAwesomeRounded';
import DeleteOutlineRoundedIcon from '@mui/icons-material/DeleteOutlineRounded';
import EventBusyRoundedIcon from '@mui/icons-material/EventBusyRounded';
import PersonRoundedIcon from '@mui/icons-material/PersonRounded';
import RefreshRoundedIcon from '@mui/icons-material/RefreshRounded';
import SearchRoundedIcon from '@mui/icons-material/SearchRounded';
import {
  Alert,
  Box,
  Button,
  Chip,
  Dialog,
  DialogContent,
  DialogTitle,
  IconButton,
  MenuItem,
  Paper,
  Stack,
  TextField,
  Typography,
} from '@mui/material';
import { useEffect, useMemo, useState } from 'react';

import { generateAiTasks } from '../../api/ai';
import type { AiTaskSuggestion, ChatMessage, SessionTask, SessionTaskStatus } from '../../types';
import { TaskCreateForm } from './TaskCreateForm';
import { useSessionTasks } from './useSessionTasks';

const statusLabels: Record<SessionTaskStatus, string> = {
  todo: 'To do',
  in_progress: 'In progress',
  done: 'Done',
};

const columnConfig: Array<{
  status: SessionTaskStatus;
  title: string;
  description: string;
}> = [
  { status: 'todo', title: 'To do', description: 'Новые и ожидающие задачи' },
  { status: 'in_progress', title: 'In progress', description: 'Активная работа команды' },
  { status: 'done', title: 'Done', description: 'Завершенные карточки' },
];

function toInputDateTime(value?: string | null) {
  if (!value) {
    return '';
  }
  const date = new Date(value);
  const offset = date.getTimezoneOffset();
  const normalized = new Date(date.getTime() - offset * 60_000);
  return normalized.toISOString().slice(0, 16);
}

function formatDeadline(value?: string | null) {
  if (!value) {
    return 'Без дедлайна';
  }
  return new Date(value).toLocaleString('ru-RU');
}

function isOverdue(value?: string | null) {
  return Boolean(value && new Date(value).getTime() < Date.now());
}

interface EditableAiTask extends AiTaskSuggestion {
  localId: string;
}

function resolveAssigneeId(participants: ReturnType<typeof useSessionTasks>['participants'], assignee?: string | null) {
  const normalizedAssignee = assignee?.trim().toLowerCase();
  if (!normalizedAssignee) {
    return null;
  }

  const exact = participants.find((participant) => participant.full_name.trim().toLowerCase() === normalizedAssignee);
  if (exact) {
    return exact.id;
  }

  const partial = participants.find((participant) => participant.full_name.trim().toLowerCase().includes(normalizedAssignee));
  return partial?.id ?? null;
}

function TaskCard({
  task,
  participants,
  dragging,
  onDragStart,
  onDragEnd,
  onPatch,
  onRemove,
}: {
  task: SessionTask;
  participants: ReturnType<typeof useSessionTasks>['participants'];
  dragging: boolean;
  onDragStart: (taskId: number) => void;
  onDragEnd: () => void;
  onPatch: (taskId: number, payload: { status?: SessionTaskStatus; assignee_id?: number | null; deadline?: string | null }) => void;
  onRemove: (taskId: number) => void;
}) {
  const overdue = isOverdue(task.deadline) && task.status !== 'done';

  return (
    <Paper
      draggable
      onDragStart={() => onDragStart(task.id)}
      onDragEnd={onDragEnd}
      sx={{
        p: 2,
        borderRadius: 3,
        cursor: 'grab',
        opacity: dragging ? 0.55 : 1,
        transition: 'opacity 140ms ease, border-color 140ms ease, box-shadow 140ms ease',
        borderColor: overdue ? '#fecaca' : '#e5e7eb',
        boxShadow: dragging ? '0 10px 30px rgba(15, 23, 42, 0.12)' : '0 1px 2px rgba(15, 23, 42, 0.04)',
      }}
    >
      <Stack spacing={1.5}>
        <Stack direction="row" justifyContent="space-between" spacing={1} alignItems="flex-start">
          <Box sx={{ minWidth: 0 }}>
            <Typography variant="subtitle2">{task.title}</Typography>
            <Typography variant="caption" color="text.secondary">
              {task.created_by?.full_name ? `Создал: ${task.created_by.full_name}` : 'Автор задачи'}
            </Typography>
          </Box>
          <IconButton onClick={() => onRemove(task.id)} size="small">
            <DeleteOutlineRoundedIcon fontSize="small" />
          </IconButton>
        </Stack>

        <Typography variant="body2" color="text.secondary">
          {task.description || 'Описание пока не добавлено.'}
        </Typography>

        <Stack direction="row" spacing={0.75} useFlexGap flexWrap="wrap">
          <Chip size="small" label={statusLabels[task.status]} />
          <Chip size="small" icon={<PersonRoundedIcon />} label={task.assignee?.full_name ?? 'Без исполнителя'} />
          {overdue ? <Chip size="small" icon={<EventBusyRoundedIcon />} label="Просрочено" color="error" /> : null}
        </Stack>

        <Stack spacing={1}>
          <TextField select size="small" label="Статус" value={task.status} onChange={(event) => onPatch(task.id, { status: event.target.value as SessionTaskStatus })}>
            <MenuItem value="todo">To do</MenuItem>
            <MenuItem value="in_progress">In progress</MenuItem>
            <MenuItem value="done">Done</MenuItem>
          </TextField>

          <TextField
            select
            size="small"
            label="Исполнитель"
            value={task.assignee_id ? String(task.assignee_id) : ''}
            onChange={(event) => onPatch(task.id, { assignee_id: event.target.value ? Number(event.target.value) : null })}
          >
            <MenuItem value="">Без исполнителя</MenuItem>
            {participants.map((participant) => (
              <MenuItem key={participant.id} value={String(participant.id)}>
                {participant.full_name}
              </MenuItem>
            ))}
          </TextField>

          <TextField
            size="small"
            label="Дедлайн"
            type="datetime-local"
            value={toInputDateTime(task.deadline)}
            onChange={(event) => onPatch(task.id, { deadline: event.target.value || null })}
            InputLabelProps={{ shrink: true }}
          />
        </Stack>

        <Typography variant="caption" color={overdue ? 'error.main' : 'text.secondary'}>
          {formatDeadline(task.deadline)}
        </Typography>
      </Stack>
    </Paper>
  );
}

export function TaskPanel({
  sessionId,
  fullscreen = false,
  openCreateKey = 0,
  sessionTitle = '',
  sessionDescription = '',
  chatMessages = [],
}: {
  sessionId: number;
  fullscreen?: boolean;
  openCreateKey?: number;
  sessionTitle?: string;
  sessionDescription?: string;
  chatMessages?: ChatMessage[];
}) {
  const { tasks, participants, loading, error, createTask, patchTask, removeTask } = useSessionTasks(sessionId);
  const [createOpen, setCreateOpen] = useState(false);
  const [aiOpen, setAiOpen] = useState(false);
  const [aiLoading, setAiLoading] = useState(false);
  const [aiSaving, setAiSaving] = useState(false);
  const [aiError, setAiError] = useState('');
  const [aiTasks, setAiTasks] = useState<EditableAiTask[]>([]);
  const [query, setQuery] = useState('');
  const [assigneeFilter, setAssigneeFilter] = useState<'all' | 'unassigned' | `${number}`>('all');
  const [draggedTaskId, setDraggedTaskId] = useState<number | null>(null);
  const [dropStatus, setDropStatus] = useState<SessionTaskStatus | null>(null);

  useEffect(() => {
    if (openCreateKey > 0) {
      setCreateOpen(true);
    }
  }, [openCreateKey]);

  const filteredTasks = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();

    return tasks.filter((task) => {
      const matchesQuery = !normalizedQuery
        || task.title.toLowerCase().includes(normalizedQuery)
        || task.description.toLowerCase().includes(normalizedQuery)
        || task.assignee?.full_name?.toLowerCase().includes(normalizedQuery)
        || task.created_by?.full_name?.toLowerCase().includes(normalizedQuery);

      const matchesAssignee = assigneeFilter === 'all'
        ? true
        : assigneeFilter === 'unassigned'
          ? task.assignee_id == null
          : String(task.assignee_id ?? '') === assigneeFilter;

      return matchesQuery && matchesAssignee;
    });
  }, [assigneeFilter, query, tasks]);

  const tasksByStatus = useMemo(
    () => ({
      todo: filteredTasks.filter((task) => task.status === 'todo'),
      in_progress: filteredTasks.filter((task) => task.status === 'in_progress'),
      done: filteredTasks.filter((task) => task.status === 'done'),
    }),
    [filteredTasks],
  );

  const stats = useMemo(() => {
    const overdue = tasks.filter((task) => isOverdue(task.deadline) && task.status !== 'done').length;
    const inWork = tasks.filter((task) => task.status === 'in_progress').length;
    const done = tasks.filter((task) => task.status === 'done').length;
    const completion = tasks.length ? Math.round((done / tasks.length) * 100) : 0;
    return { overdue, inWork, done, completion };
  }, [tasks]);

  async function handleDrop(nextStatus: SessionTaskStatus) {
    if (draggedTaskId == null) {
      return;
    }

    const draggedTask = tasks.find((task) => task.id === draggedTaskId);
    setDropStatus(null);
    setDraggedTaskId(null);

    if (!draggedTask || draggedTask.status === nextStatus) {
      return;
    }

    await patchTask(draggedTask.id, { status: nextStatus });
  }

  async function requestAiTasks() {
    setAiLoading(true);
    setAiError('');
    try {
      const generated = await generateAiTasks({
        roomId: sessionId,
        roomTitle: sessionTitle || 'Учебная видеосессия',
        description: sessionDescription,
        messages: chatMessages,
      });
      setAiTasks(
        generated.map((item, index) => ({
          localId: `${Date.now()}-${index}`,
          title: item.title,
          description: item.description,
          assignee: item.assignee ?? '',
        })),
      );
    } catch (err) {
      setAiTasks([]);
      setAiError(err instanceof Error ? err.message : 'Не удалось сгенерировать задачи.');
    } finally {
      setAiLoading(false);
    }
  }

  async function handleOpenAiDialog() {
    setAiOpen(true);
    await requestAiTasks();
  }

  async function handleConfirmAiTasks() {
    const normalizedTasks = aiTasks
      .map((task) => ({
        title: task.title.trim(),
        description: task.description.trim(),
        assignee: task.assignee?.trim() ?? '',
      }))
      .filter((task) => task.title);

    if (normalizedTasks.length === 0) {
      setAiError('Добавьте хотя бы одну задачу для сохранения.');
      return;
    }

    setAiSaving(true);
    setAiError('');
    try {
      for (const task of normalizedTasks) {
        await createTask({
          title: task.title,
          description: task.description,
          assignee_id: resolveAssigneeId(participants, task.assignee),
          deadline: null,
          status: 'todo',
        });
      }
      setAiOpen(false);
      setAiTasks([]);
    } catch (err) {
      setAiError(err instanceof Error ? err.message : 'Не удалось сохранить задачи.');
    } finally {
      setAiSaving(false);
    }
  }

  return (
    <>
      <Paper
        sx={{
          p: { xs: 2, md: fullscreen ? 3 : 2.5 },
          height: '100%',
          minHeight: 0,
          display: 'flex',
          flexDirection: 'column',
          gap: 2,
          borderRadius: 3,
          backgroundColor: '#ffffff',
        }}
      >
        <Stack direction={{ xs: 'column', xl: 'row' }} justifyContent="space-between" spacing={2}>
          <Box>
            <Typography variant="h5">Kanban-доска</Typography>
            <Typography variant="body2" color="text.secondary" sx={{ mt: 0.75 }}>
              Главный фокус на колонках и карточках. Аналитика и фильтры вынесены в компактный верхний блок.
            </Typography>
          </Box>
          <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1}>
            <Button variant="outlined" startIcon={<AutoAwesomeRoundedIcon />} onClick={() => void handleOpenAiDialog()}>
              AI-задачи
            </Button>
            <Button variant="contained" startIcon={<AddTaskRoundedIcon />} onClick={() => setCreateOpen(true)}>
              Новая задача
            </Button>
          </Stack>
        </Stack>

        <Box
          sx={{
            display: 'grid',
            gap: 1.5,
            gridTemplateColumns: { xs: '1fr', lg: 'repeat(4, minmax(0, 1fr))' },
          }}
        >
          <Paper sx={{ p: 2, borderRadius: 3, bgcolor: '#f9fafb' }}>
            <Typography variant="caption" color="text.secondary">Готовность</Typography>
            <Typography variant="h4" sx={{ mt: 0.5 }}>{stats.completion}%</Typography>
            <Typography variant="body2" color="text.secondary">{stats.done} из {tasks.length} завершено</Typography>
          </Paper>
          <Paper sx={{ p: 2, borderRadius: 3, bgcolor: '#f9fafb' }}>
            <Typography variant="caption" color="text.secondary">В работе</Typography>
            <Typography variant="h4" sx={{ mt: 0.5 }}>{stats.inWork}</Typography>
            <Typography variant="body2" color="text.secondary">Карточки, над которыми сейчас работают</Typography>
          </Paper>
          <Paper sx={{ p: 2, borderRadius: 3, bgcolor: '#f9fafb' }}>
            <Typography variant="caption" color="text.secondary">Просрочено</Typography>
            <Typography variant="h4" sx={{ mt: 0.5 }}>{stats.overdue}</Typography>
            <Typography variant="body2" color="text.secondary">Задачи, требующие внимания</Typography>
          </Paper>
          <Stack spacing={1.25}>
            <TextField
              size="small"
              placeholder="Поиск по карточкам"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              InputProps={{ startAdornment: <SearchRoundedIcon fontSize="small" sx={{ mr: 1, color: 'text.secondary' }} /> }}
            />
            <TextField select size="small" label="Фильтр по исполнителю" value={assigneeFilter} onChange={(event) => setAssigneeFilter(event.target.value as 'all' | 'unassigned' | `${number}`)}>
              <MenuItem value="all">Все карточки</MenuItem>
              <MenuItem value="unassigned">Без исполнителя</MenuItem>
              {participants.map((participant) => (
                <MenuItem key={participant.id} value={String(participant.id) as `${number}`}>
                  {participant.full_name}
                </MenuItem>
              ))}
            </TextField>
          </Stack>
        </Box>

        {error ? <Alert severity="warning">{error}</Alert> : null}
        {!loading && tasks.length === 0 ? <Alert severity="info">В сессии пока нет задач. Добавьте первую карточку, чтобы зафиксировать план работы.</Alert> : null}

        <Box sx={{ flex: 1, minHeight: 0, overflowX: 'auto', overflowY: 'hidden' }}>
          <Box
            sx={{
              display: 'grid',
              gridTemplateColumns: { xs: 'repeat(3, minmax(280px, 1fr))', xl: 'repeat(3, minmax(0, 1fr))' },
              gap: 1.5,
              minWidth: { xs: 900, xl: 'auto' },
              height: '100%',
            }}
          >
            {columnConfig.map((column) => {
              const columnTasks = tasksByStatus[column.status];
              return (
                <Paper
                  key={column.status}
                  onDragOver={(event) => {
                    event.preventDefault();
                    setDropStatus(column.status);
                  }}
                  onDragLeave={() => setDropStatus((prev) => (prev === column.status ? null : prev))}
                  onDrop={() => void handleDrop(column.status)}
                  sx={{
                    p: 1.5,
                    borderRadius: 3,
                    display: 'flex',
                    flexDirection: 'column',
                    gap: 1.25,
                    minHeight: 0,
                    backgroundColor: dropStatus === column.status ? '#f9fafb' : '#fcfcfd',
                    borderColor: dropStatus === column.status ? '#9ca3af' : '#e5e7eb',
                  }}
                >
                  <Stack direction="row" justifyContent="space-between" spacing={1} alignItems="center">
                    <Box>
                      <Typography variant="subtitle1">{column.title}</Typography>
                      <Typography variant="caption" color="text.secondary">{column.description}</Typography>
                    </Box>
                    <Chip size="small" label={columnTasks.length} />
                  </Stack>

                  <Box sx={{ flex: 1, minHeight: 0, overflowY: 'auto', pr: 0.25 }}>
                    <Stack spacing={1.25}>
                      {columnTasks.map((task) => (
                        <TaskCard
                          key={task.id}
                          task={task}
                          participants={participants}
                          dragging={draggedTaskId === task.id}
                          onDragStart={setDraggedTaskId}
                          onDragEnd={() => {
                            setDraggedTaskId(null);
                            setDropStatus(null);
                          }}
                          onPatch={(taskId, payload) => void patchTask(taskId, payload)}
                          onRemove={(taskId) => void removeTask(taskId)}
                        />
                      ))}
                      {!loading && columnTasks.length === 0 ? (
                        <Paper sx={{ p: 2, borderRadius: 3, textAlign: 'center', bgcolor: '#f9fafb' }}>
                          <Typography variant="body2" color="text.secondary">
                            Здесь пока пусто
                          </Typography>
                        </Paper>
                      ) : null}
                    </Stack>
                  </Box>
                </Paper>
              );
            })}
          </Box>
        </Box>
      </Paper>

      <Dialog open={createOpen} onClose={() => setCreateOpen(false)} fullWidth maxWidth="sm">
        <DialogTitle>Создать задачу</DialogTitle>
        <DialogContent>
          <TaskCreateForm participants={participants} disabled={loading} submitLabel="Сохранить задачу" onSubmitted={() => setCreateOpen(false)} onSubmit={createTask} />
        </DialogContent>
      </Dialog>

      <Dialog
        open={aiOpen}
        onClose={() => {
          if (!aiLoading && !aiSaving) {
            setAiOpen(false);
          }
        }}
        fullWidth
        maxWidth="md"
      >
        <DialogTitle>AI-генерация задач</DialogTitle>
        <DialogContent>
          <Stack spacing={2}>
            <Typography variant="body2" color="text.secondary">
              Контекст берется из чата, названия комнаты и описания сессии. Перед сохранением список можно отредактировать.
            </Typography>
            {aiError ? <Alert severity="warning">{aiError}</Alert> : null}
            <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1}>
              <Button variant="outlined" startIcon={<RefreshRoundedIcon />} onClick={() => void requestAiTasks()} disabled={aiLoading || aiSaving}>
                Сгенерировать заново
              </Button>
              <Button variant="contained" startIcon={<AddTaskRoundedIcon />} onClick={() => void handleConfirmAiTasks()} disabled={aiLoading || aiSaving || aiTasks.length === 0}>
                Подтвердить и сохранить
              </Button>
            </Stack>

            {aiLoading ? <Alert severity="info">AI анализирует обсуждение и подбирает задачи...</Alert> : null}
            {!aiLoading && aiTasks.length === 0 && !aiError ? <Alert severity="info">AI пока не предложил задачи.</Alert> : null}

            <Stack spacing={1.25}>
              {aiTasks.map((task) => (
                <Paper key={task.localId} sx={{ p: 2, borderRadius: 3, bgcolor: '#f9fafb' }}>
                  <Stack spacing={1.25}>
                    <Stack direction="row" justifyContent="space-between" spacing={1} alignItems="center">
                      <Typography variant="subtitle2">Предложенная задача</Typography>
                      <IconButton onClick={() => setAiTasks((prev) => prev.filter((item) => item.localId !== task.localId))} disabled={aiSaving} size="small">
                        <DeleteOutlineRoundedIcon fontSize="small" />
                      </IconButton>
                    </Stack>
                    <TextField label="Название задачи" value={task.title} onChange={(event) => setAiTasks((prev) => prev.map((item) => (item.localId === task.localId ? { ...item, title: event.target.value } : item)))} disabled={aiSaving} />
                    <TextField label="Описание" value={task.description} onChange={(event) => setAiTasks((prev) => prev.map((item) => (item.localId === task.localId ? { ...item, description: event.target.value } : item)))} disabled={aiSaving} multiline minRows={3} />
                    <TextField
                      label="Предполагаемый исполнитель"
                      value={task.assignee ?? ''}
                      onChange={(event) => setAiTasks((prev) => prev.map((item) => (item.localId === task.localId ? { ...item, assignee: event.target.value } : item)))}
                      disabled={aiSaving}
                      helperText="Если имя совпадает с участником сессии, исполнитель подставится автоматически."
                    />
                  </Stack>
                </Paper>
              ))}
            </Stack>
          </Stack>
        </DialogContent>
      </Dialog>
    </>
  );
}
