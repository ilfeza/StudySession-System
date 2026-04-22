import AddTaskRoundedIcon from '@mui/icons-material/AddTaskRounded';
import AutoAwesomeRoundedIcon from '@mui/icons-material/AutoAwesomeRounded';
import DeleteOutlineRoundedIcon from '@mui/icons-material/DeleteOutlineRounded';
import DragIndicatorRoundedIcon from '@mui/icons-material/DragIndicatorRounded';
import EventBusyRoundedIcon from '@mui/icons-material/EventBusyRounded';
import PersonRoundedIcon from '@mui/icons-material/PersonRounded';
import RefreshRoundedIcon from '@mui/icons-material/RefreshRounded';
import SearchRoundedIcon from '@mui/icons-material/SearchRounded';
import ScheduleRoundedIcon from '@mui/icons-material/ScheduleRounded';
import TrendingUpRoundedIcon from '@mui/icons-material/TrendingUpRounded';
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
import { alpha } from '@mui/material/styles';
import { useEffect, useMemo, useState } from 'react';

import { generateAiTasks } from '../../api/ai';
import type { AiTaskSuggestion, ChatMessage, SessionTask, SessionTaskStatus } from '../../types';
import { useSessionTasks } from './useSessionTasks';
import { TaskCreateForm } from './TaskCreateForm';

const statusLabels: Record<SessionTaskStatus, string> = {
  todo: 'To do',
  in_progress: 'In progress',
  done: 'Done',
};

const columnConfig: Array<{
  status: SessionTaskStatus;
  title: string;
  accent: string;
  background: string;
  description: string;
}> = [
  {
    status: 'todo',
    title: 'To do',
    accent: '#94a3b8',
    background: 'linear-gradient(180deg, rgba(148, 163, 184, 0.18) 0%, rgba(15, 23, 42, 0.38) 100%)',
    description: 'Идеи и новые задачи',
  },
  {
    status: 'in_progress',
    title: 'In progress',
    accent: '#60a5fa',
    background: 'linear-gradient(180deg, rgba(51, 132, 255, 0.22) 0%, rgba(9, 20, 38, 0.38) 100%)',
    description: 'То, над чем команда работает',
  },
  {
    status: 'done',
    title: 'Done',
    accent: '#4ade80',
    background: 'linear-gradient(180deg, rgba(34, 197, 94, 0.2) 0%, rgba(8, 24, 20, 0.34) 100%)',
    description: 'Готовые карточки встречи',
  },
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

function isDueToday(value?: string | null) {
  if (!value) {
    return false;
  }
  const date = new Date(value);
  const now = new Date();
  return date.getFullYear() === now.getFullYear()
    && date.getMonth() === now.getMonth()
    && date.getDate() === now.getDate();
}

function getInitials(name?: string | null) {
  if (!name) {
    return '??';
  }
  const parts = name.trim().split(/\s+/).filter(Boolean);
  return parts.slice(0, 2).map((part) => part[0]?.toUpperCase() ?? '').join('') || '??';
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
  accent,
  participants,
  dragging,
  onDragStart,
  onDragEnd,
  onPatch,
  onRemove,
}: {
  task: SessionTask;
  accent: string;
  participants: ReturnType<typeof useSessionTasks>['participants'];
  dragging: boolean;
  onDragStart: (taskId: number) => void;
  onDragEnd: () => void;
  onPatch: (taskId: number, payload: { status?: SessionTaskStatus; assignee_id?: number | null; deadline?: string | null }) => void;
  onRemove: (taskId: number) => void;
}) {
  const overdue = isOverdue(task.deadline) && task.status !== 'done';
  const dueToday = isDueToday(task.deadline) && task.status !== 'done';

  return (
    <Paper
      draggable
      onDragStart={() => onDragStart(task.id)}
      onDragEnd={onDragEnd}
      sx={{
        p: 1.5,
        borderRadius: 3.5,
        cursor: 'grab',
        opacity: dragging ? 0.5 : 1,
        transform: dragging ? 'scale(0.98)' : 'translateY(0)',
        transition: 'transform 140ms ease, box-shadow 140ms ease, opacity 140ms ease',
        background: overdue
          ? 'linear-gradient(180deg, rgba(70, 21, 28, 0.98) 0%, rgba(28, 11, 17, 0.98) 100%)'
          : 'linear-gradient(180deg, rgba(22, 39, 68, 0.98) 0%, rgba(10, 18, 32, 0.96) 100%)',
        border: `1px solid ${alpha(overdue ? '#fb7185' : accent, 0.35)}`,
        boxShadow: `0 18px 34px ${alpha('#000000', 0.28)}`,
        '&:hover': {
          transform: dragging ? 'scale(0.98)' : 'translateY(-2px)',
          boxShadow: `0 22px 42px ${alpha('#000000', 0.34)}`,
        },
      }}
    >
      <Stack spacing={1.2}>
        <Stack direction="row" justifyContent="space-between" spacing={1} alignItems="flex-start">
          <Stack direction="row" spacing={1} sx={{ minWidth: 0, flex: 1 }}>
            <Box
              sx={{
                width: 34,
                height: 34,
                flexShrink: 0,
                display: 'grid',
                placeItems: 'center',
                borderRadius: 2.5,
                color: '#ffffff',
                background: alpha(accent, 0.2),
                border: `1px solid ${alpha(accent, 0.28)}`,
              }}
            >
              <DragIndicatorRoundedIcon fontSize="small" />
            </Box>
            <Box sx={{ minWidth: 0 }}>
              <Typography fontWeight={800} sx={{ color: '#ffffff' }}>
                {task.title}
              </Typography>
              <Typography variant="caption" sx={{ color: alpha('#ffffff', 0.62) }}>
                {task.created_by?.full_name ? `Создал: ${task.created_by.full_name}` : 'Автор задачи'}
              </Typography>
            </Box>
          </Stack>

          <IconButton onClick={() => onRemove(task.id)} sx={{ color: '#ffb4b4', mt: -0.5, mr: -0.5 }}>
            <DeleteOutlineRoundedIcon />
          </IconButton>
        </Stack>

        <Typography variant="body2" sx={{ color: alpha('#ffffff', 0.78) }}>
          {task.description || 'Описание пока не добавлено.'}
        </Typography>

        <Stack direction="row" spacing={0.75} useFlexGap flexWrap="wrap">
          <Chip
            label={statusLabels[task.status]}
            size="small"
            sx={{
              color: '#ffffff',
              backgroundColor: alpha(accent, 0.22),
              border: `1px solid ${alpha(accent, 0.28)}`,
            }}
          />
          <Chip
            icon={<PersonRoundedIcon />}
            label={task.assignee?.full_name ?? 'Без исполнителя'}
            size="small"
            sx={{
              color: alpha('#ffffff', 0.9),
              backgroundColor: alpha('#ffffff', 0.08),
            }}
          />
          {overdue ? (
            <Chip
              icon={<EventBusyRoundedIcon />}
              label="Просрочено"
              size="small"
              sx={{
                color: '#ffe1e6',
                backgroundColor: alpha('#fb7185', 0.18),
                border: `1px solid ${alpha('#fb7185', 0.28)}`,
              }}
            />
          ) : null}
          {!overdue && dueToday ? (
            <Chip
              icon={<ScheduleRoundedIcon />}
              label="Сегодня"
              size="small"
              sx={{
                color: '#fff7d1',
                backgroundColor: alpha('#facc15', 0.16),
                border: `1px solid ${alpha('#facc15', 0.26)}`,
              }}
            />
          ) : null}
        </Stack>

        <Stack spacing={1}>
          <TextField
            select
            size="small"
            label="Статус"
            value={task.status}
            onChange={(event) => onPatch(task.id, { status: event.target.value as SessionTaskStatus })}
          >
            <MenuItem value="todo">To do</MenuItem>
            <MenuItem value="in_progress">In progress</MenuItem>
            <MenuItem value="done">Done</MenuItem>
          </TextField>

          <TextField
            select
            size="small"
            label="Исполнитель"
            value={task.assignee_id ? String(task.assignee_id) : ''}
            onChange={(event) => onPatch(task.id, {
              assignee_id: event.target.value ? Number(event.target.value) : null,
            })}
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

        <Stack direction="row" justifyContent="space-between" alignItems="center" spacing={1}>
          <Typography variant="caption" sx={{ color: overdue ? '#ffd0d8' : alpha('#ffffff', 0.62) }}>
            {formatDeadline(task.deadline)}
          </Typography>
          <Box
            sx={{
              width: 30,
              height: 30,
              borderRadius: '50%',
              display: 'grid',
              placeItems: 'center',
              color: '#ffffff',
              fontSize: '0.72rem',
              fontWeight: 800,
              background: alpha('#ffffff', 0.12),
              border: `1px solid ${alpha('#ffffff', 0.08)}`,
            }}
          >
            {getInitials(task.assignee?.full_name)}
          </Box>
        </Stack>
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
          p: { xs: 1.5, md: fullscreen ? 2.5 : 2.25 },
          height: '100%',
          minHeight: 0,
          display: 'flex',
          flexDirection: 'column',
          gap: 1.5,
          borderRadius: fullscreen ? 5 : 4,
          background: fullscreen
            ? 'linear-gradient(180deg, rgba(7, 13, 24, 0.98) 0%, rgba(4, 8, 15, 0.98) 100%)'
            : alpha('#08111f', 0.9),
          color: '#f8fbff',
          border: `1px solid ${alpha('#ffffff', 0.08)}`,
          boxShadow: fullscreen ? '0 32px 80px rgba(0, 0, 0, 0.42)' : '0 24px 60px rgba(0, 0, 0, 0.35)',
          backdropFilter: 'blur(16px)',
        }}
      >
        <Stack
          direction={{ xs: 'column', lg: 'row' }}
          spacing={1.5}
          alignItems={{ xs: 'stretch', lg: 'center' }}
          justifyContent="space-between"
        >
          <Stack spacing={0.35}>
            <Typography variant="h5" fontWeight={900}>
              Канбан-доска
            </Typography>
            <Typography variant="body2" sx={{ color: alpha('#ffffff', 0.7) }}>
              Полноэкранная рабочая доска видеосессии с перетаскиванием карточек мышкой между колонками.
            </Typography>
          </Stack>

          <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1}>
            <Button
              variant="outlined"
              startIcon={<AutoAwesomeRoundedIcon />}
              onClick={() => void handleOpenAiDialog()}
              sx={{
                alignSelf: { xs: 'stretch', lg: 'center' },
                borderRadius: 999,
                px: 2.2,
                py: 1.1,
                fontWeight: 900,
                textTransform: 'none',
                color: '#ffffff',
                borderColor: alpha('#ffffff', 0.2),
                background: alpha('#ffffff', 0.04),
              }}
            >
              Сгенерировать задачи
            </Button>

            <Button
              variant="contained"
              startIcon={<AddTaskRoundedIcon />}
              onClick={() => setCreateOpen(true)}
              sx={{
                alignSelf: { xs: 'stretch', lg: 'center' },
                borderRadius: 999,
                px: 2.2,
                py: 1.1,
                fontWeight: 900,
                textTransform: 'none',
                background: 'linear-gradient(135deg, #38bdf8 0%, #22c55e 100%)',
                color: '#04111d',
              }}
            >
              Создать задачу
            </Button>
          </Stack>
        </Stack>

        <Stack direction={{ xs: 'column', xl: 'row' }} spacing={1.2}>
          <Paper
            sx={{
              p: 1.2,
              borderRadius: 4,
              minWidth: { xl: 220 },
              background: alpha('#ffffff', 0.04),
              border: `1px solid ${alpha('#ffffff', 0.08)}`,
            }}
          >
            <Stack spacing={0.4}>
              <Typography variant="caption" sx={{ color: alpha('#ffffff', 0.58) }}>
                Готовность
              </Typography>
              <Typography variant="h4" fontWeight={900} color="#ffffff">
                {stats.completion}%
              </Typography>
              <Typography variant="body2" sx={{ color: alpha('#ffffff', 0.68) }}>
                {stats.done} из {tasks.length} задач закрыты
              </Typography>
            </Stack>
          </Paper>

          <Paper
            sx={{
              p: 1.2,
              borderRadius: 4,
              minWidth: { xl: 220 },
              background: alpha('#60a5fa', 0.08),
              border: `1px solid ${alpha('#60a5fa', 0.16)}`,
            }}
          >
            <Stack spacing={0.4}>
              <Typography variant="caption" sx={{ color: alpha('#ffffff', 0.58) }}>
                В работе
              </Typography>
              <Stack direction="row" spacing={0.7} alignItems="center">
                <TrendingUpRoundedIcon sx={{ color: '#8cc7ff' }} />
                <Typography variant="h5" fontWeight={900} color="#ffffff">
                  {stats.inWork}
                </Typography>
              </Stack>
            </Stack>
          </Paper>

          <Paper
            sx={{
              p: 1.2,
              borderRadius: 4,
              minWidth: { xl: 220 },
              background: alpha('#fb7185', 0.08),
              border: `1px solid ${alpha('#fb7185', 0.16)}`,
            }}
          >
            <Stack spacing={0.4}>
              <Typography variant="caption" sx={{ color: alpha('#ffffff', 0.58) }}>
                Просрочено
              </Typography>
              <Stack direction="row" spacing={0.7} alignItems="center">
                <EventBusyRoundedIcon sx={{ color: '#ff9caf' }} />
                <Typography variant="h5" fontWeight={900} color="#ffffff">
                  {stats.overdue}
                </Typography>
              </Stack>
            </Stack>
          </Paper>

          <TextField
            placeholder="Поиск по карточкам"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            InputProps={{
              startAdornment: <SearchRoundedIcon sx={{ color: alpha('#ffffff', 0.5), mr: 1 }} />,
            }}
            sx={{
              flex: 1,
              minWidth: { xl: 260 },
            }}
          />

          <TextField
            select
            label="Фильтр"
            value={assigneeFilter}
            onChange={(event) => setAssigneeFilter(event.target.value as 'all' | 'unassigned' | `${number}`)}
            sx={{ minWidth: { xs: '100%', sm: 240 } }}
          >
            <MenuItem value="all">Все карточки</MenuItem>
            <MenuItem value="unassigned">Без исполнителя</MenuItem>
            {participants.map((participant) => (
              <MenuItem key={participant.id} value={String(participant.id) as `${number}`}>
                {participant.full_name}
              </MenuItem>
            ))}
          </TextField>
        </Stack>

        {error ? <Alert severity="warning" sx={{ borderRadius: 3 }}>{error}</Alert> : null}
        {!loading && tasks.length === 0 ? (
          <Alert severity="info" sx={{ borderRadius: 3 }}>
            В сессии пока нет задач. Добавьте первую карточку, чтобы зафиксировать план работы.
          </Alert>
        ) : null}

        <Box
          sx={{
            flex: 1,
            minHeight: 0,
            overflowX: 'auto',
            overflowY: 'hidden',
          }}
        >
          <Box
            sx={{
              display: 'grid',
              gridTemplateColumns: {
                xs: 'repeat(3, minmax(360px, 1fr))',
                xl: 'repeat(3, minmax(0, 1fr))',
              },
              gap: 1.5,
              minWidth: { xs: 1140, xl: 'auto' },
              height: '100%',
            }}
          >
            {columnConfig.map((column) => {
              const columnTasks = tasksByStatus[column.status];
              const allColumnTasks = tasks.filter((task) => task.status === column.status);
              const overdueCount = allColumnTasks.filter((task) => isOverdue(task.deadline) && task.status !== 'done').length;

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
                    p: 1.2,
                    borderRadius: 4.5,
                    display: 'flex',
                    flexDirection: 'column',
                    gap: 1,
                    minHeight: 0,
                    height: '100%',
                    background: column.background,
                    border: `1px solid ${alpha(column.accent, dropStatus === column.status ? 0.55 : 0.28)}`,
                    boxShadow: dropStatus === column.status
                      ? `0 0 0 1px ${alpha(column.accent, 0.28)} inset`
                      : 'none',
                    transition: 'border-color 120ms ease, box-shadow 120ms ease, transform 120ms ease',
                    transform: dropStatus === column.status ? 'scale(1.003)' : 'none',
                  }}
                >
                  <Stack
                    direction="row"
                    justifyContent="space-between"
                    alignItems="center"
                    sx={{
                      position: 'sticky',
                      top: 0,
                      zIndex: 1,
                      py: 0.3,
                      background: alpha('#09111d', 0.42),
                      backdropFilter: 'blur(10px)',
                      borderRadius: 3,
                    }}
                  >
                    <Box>
                      <Typography fontWeight={900} sx={{ color: '#ffffff' }}>
                        {column.title}
                      </Typography>
                      <Typography variant="caption" sx={{ color: alpha('#ffffff', 0.66) }}>
                        {column.description}
                      </Typography>
                    </Box>

                    <Stack direction="row" spacing={0.75}>
                      {overdueCount > 0 ? (
                        <Chip
                          label={`Просрочено ${overdueCount}`}
                          size="small"
                          sx={{
                            color: '#ffe3e8',
                            backgroundColor: alpha('#fb7185', 0.18),
                            border: `1px solid ${alpha('#fb7185', 0.28)}`,
                          }}
                        />
                      ) : null}
                      <Chip
                        label={columnTasks.length}
                        size="small"
                        sx={{
                          color: '#ffffff',
                          fontWeight: 800,
                          backgroundColor: alpha(column.accent, 0.24),
                          border: `1px solid ${alpha(column.accent, 0.32)}`,
                        }}
                      />
                    </Stack>
                  </Stack>

                  <Box
                    sx={{
                      flex: 1,
                      minHeight: 0,
                      overflowY: 'auto',
                      pr: 0.25,
                      borderRadius: 3.5,
                    }}
                  >
                    <Stack spacing={1.1}>
                      {dropStatus === column.status && draggedTaskId !== null ? (
                        <Paper
                          sx={{
                            p: 1.15,
                            borderRadius: 3,
                            textAlign: 'center',
                            background: alpha(column.accent, 0.12),
                            border: `1px dashed ${alpha(column.accent, 0.4)}`,
                          }}
                        >
                          <Typography variant="body2" sx={{ color: '#ffffff', fontWeight: 700 }}>
                            Отпустите карточку, чтобы переместить сюда
                          </Typography>
                        </Paper>
                      ) : null}

                      {columnTasks.map((task) => (
                        <TaskCard
                          key={task.id}
                          task={task}
                          accent={column.accent}
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
                        <Paper
                          sx={{
                            p: 2,
                            borderRadius: 3.5,
                            textAlign: 'center',
                            background: alpha('#ffffff', 0.04),
                            border: `1px dashed ${alpha('#ffffff', 0.14)}`,
                          }}
                        >
                          <Typography variant="body2" sx={{ color: alpha('#ffffff', 0.68) }}>
                            Здесь пока пусто
                          </Typography>
                          <Typography variant="caption" sx={{ color: alpha('#ffffff', 0.5) }}>
                            Перетащите карточку сюда или создайте новую
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

      <Dialog
        open={createOpen}
        onClose={() => setCreateOpen(false)}
        fullWidth
        maxWidth="sm"
        PaperProps={{
          sx: {
            borderRadius: 5,
            background: 'linear-gradient(180deg, rgba(10, 18, 32, 0.98) 0%, rgba(6, 11, 20, 0.98) 100%)',
            color: '#f8fbff',
            border: `1px solid ${alpha('#ffffff', 0.08)}`,
            boxShadow: '0 32px 80px rgba(0, 0, 0, 0.45)',
          },
        }}
      >
        <DialogTitle sx={{ pb: 1, fontWeight: 900 }}>
          Создать задачу
        </DialogTitle>
        <DialogContent sx={{ pb: 3 }}>
          <TaskCreateForm
            participants={participants}
            disabled={loading}
            submitLabel="Сохранить задачу"
            onSubmitted={() => setCreateOpen(false)}
            onSubmit={createTask}
          />
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
        PaperProps={{
          sx: {
            borderRadius: 5,
            background: 'linear-gradient(180deg, rgba(10, 18, 32, 0.98) 0%, rgba(6, 11, 20, 0.98) 100%)',
            color: '#f8fbff',
            border: `1px solid ${alpha('#ffffff', 0.08)}`,
            boxShadow: '0 32px 80px rgba(0, 0, 0, 0.45)',
          },
        }}
      >
        <DialogTitle sx={{ pb: 1, fontWeight: 900 }}>
          AI-генерация задач
        </DialogTitle>
        <DialogContent sx={{ pb: 3 }}>
          <Stack spacing={1.5}>
            <Typography variant="body2" sx={{ color: alpha('#ffffff', 0.72) }}>
              Контекст берётся из чата, названия комнаты и описания сессии. Перед сохранением список можно отредактировать.
            </Typography>

            {aiError ? <Alert severity="warning" sx={{ borderRadius: 3 }}>{aiError}</Alert> : null}

            <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1}>
              <Button
                variant="outlined"
                startIcon={<RefreshRoundedIcon />}
                onClick={() => void requestAiTasks()}
                disabled={aiLoading || aiSaving}
                sx={{ borderRadius: 999, color: '#ffffff', borderColor: alpha('#ffffff', 0.18) }}
              >
                Сгенерировать заново
              </Button>
              <Button
                variant="contained"
                startIcon={<AddTaskRoundedIcon />}
                onClick={() => void handleConfirmAiTasks()}
                disabled={aiLoading || aiSaving || aiTasks.length === 0}
                sx={{
                  borderRadius: 999,
                  fontWeight: 900,
                  textTransform: 'none',
                  color: '#08111f',
                  background: 'linear-gradient(135deg, #7dd3fc 0%, #a7f3d0 100%)',
                }}
              >
                Подтвердить и сохранить
              </Button>
            </Stack>

            {aiLoading ? (
              <Alert severity="info" sx={{ borderRadius: 3 }}>
                AI анализирует обсуждение и подбирает задачи...
              </Alert>
            ) : null}

            {!aiLoading && aiTasks.length === 0 && !aiError ? (
              <Alert severity="info" sx={{ borderRadius: 3 }}>
                AI пока не предложил задачи. Попробуйте ещё раз или добавьте больше сообщений в чат.
              </Alert>
            ) : null}

            <Stack spacing={1.25}>
              {aiTasks.map((task) => (
                <Paper
                  key={task.localId}
                  sx={{
                    p: 1.25,
                    borderRadius: 3.5,
                    background: alpha('#ffffff', 0.04),
                    border: `1px solid ${alpha('#ffffff', 0.08)}`,
                  }}
                >
                  <Stack spacing={1}>
                    <Stack direction="row" justifyContent="space-between" spacing={1}>
                      <Typography fontWeight={800}>
                        Предложенная задача
                      </Typography>
                      <IconButton
                        onClick={() => setAiTasks((prev) => prev.filter((item) => item.localId !== task.localId))}
                        disabled={aiSaving}
                        sx={{ color: '#ffb4b4', mt: -0.5, mr: -0.5 }}
                      >
                        <DeleteOutlineRoundedIcon />
                      </IconButton>
                    </Stack>

                    <TextField
                      label="Название задачи"
                      value={task.title}
                      onChange={(event) => setAiTasks((prev) => prev.map((item) => (
                        item.localId === task.localId ? { ...item, title: event.target.value } : item
                      )))}
                      disabled={aiSaving}
                    />
                    <TextField
                      label="Описание"
                      value={task.description}
                      onChange={(event) => setAiTasks((prev) => prev.map((item) => (
                        item.localId === task.localId ? { ...item, description: event.target.value } : item
                      )))}
                      disabled={aiSaving}
                      multiline
                      minRows={3}
                    />
                    <TextField
                      label="Предполагаемый исполнитель"
                      value={task.assignee ?? ''}
                      onChange={(event) => setAiTasks((prev) => prev.map((item) => (
                        item.localId === task.localId ? { ...item, assignee: event.target.value } : item
                      )))}
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
