import AddTaskRoundedIcon from '@mui/icons-material/AddTaskRounded';
import DeleteOutlineRoundedIcon from '@mui/icons-material/DeleteOutlineRounded';
import RefreshRoundedIcon from '@mui/icons-material/RefreshRounded';
import { Alert, Button, Dialog, DialogContent, DialogTitle, IconButton, Menu, MenuItem, Paper, Stack, Typography } from '@mui/material';
import { useEffect, useMemo, useState, type MouseEvent } from 'react';

import { generateAiTasks } from '../../api/ai';
import type { AiTaskSuggestion, ChatMessage, SessionParticipant, SessionTask, SessionTaskStatus } from '../../types';
import { chooseBestParticipant, type SessionNotification, type SessionSuggestion } from '../../pages/video-session/sessionIntelligence';
import { BoardHeader } from './BoardHeader';
import { KanbanColumn } from './KanbanColumn';
import { TaskCard } from './TaskCard';
import { TaskCreateForm } from './TaskCreateForm';
import { TaskDetailsDrawer } from './TaskDetailsDrawer';
import { useSessionTasks, type SessionTasksController } from './useSessionTasks';

const columnConfig: Array<{ status: SessionTaskStatus; title: string; emptyLabel: string }> = [
  { status: 'backlog', title: 'Бэклог', emptyLabel: 'Соберите задачи для следующего шага' },
  { status: 'assigned', title: 'Назначено', emptyLabel: 'Распределенные задачи появятся здесь' },
  { status: 'in_progress', title: 'В работе', emptyLabel: 'Активная работа начнется здесь' },
  { status: 'blocked', title: 'Заблокировано', emptyLabel: 'Здесь будут видны блокеры' },
  { status: 'done', title: 'Готово', emptyLabel: 'Завершенные задачи появятся здесь' },
];

interface EditableAiTask extends AiTaskSuggestion {
  localId: string;
}

function resolveAssigneeId(participants: SessionParticipant[], assignee?: string | null) {
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

export function TaskPanel({
  sessionId,
  fullscreen = false,
  openCreateKey = 0,
  sessionTitle = '',
  sessionDescription = '',
  chatMessages = [],
  controller,
  isModerator = false,
  liveParticipantNames = [],
  onNotify,
  onEngineSuggestionsChange,
}: {
  sessionId: number;
  fullscreen?: boolean;
  openCreateKey?: number;
  sessionTitle?: string;
  sessionDescription?: string;
  chatMessages?: ChatMessage[];
  controller?: SessionTasksController;
  isModerator?: boolean;
  liveParticipantNames?: string[];
  onNotify?: (notification: SessionNotification) => void;
  onEngineSuggestionsChange?: (suggestions: SessionSuggestion[]) => void;
}) {
  const taskController = controller ?? useSessionTasks(sessionId);
  const { tasks, participants, loading, error, createTask, patchTask, removeTask } = taskController;
  const [createOpen, setCreateOpen] = useState(false);
  const [aiOpen, setAiOpen] = useState(false);
  const [aiMenuAnchor, setAiMenuAnchor] = useState<HTMLElement | null>(null);
  const [aiLoading, setAiLoading] = useState(false);
  const [aiSaving, setAiSaving] = useState(false);
  const [aiError, setAiError] = useState('');
  const [aiTasks, setAiTasks] = useState<EditableAiTask[]>([]);
  const [query, setQuery] = useState('');
  const [assigneeFilter, setAssigneeFilter] = useState<'all' | 'unassigned' | `${number}`>('all');
  const [draggedTaskId, setDraggedTaskId] = useState<number | null>(null);
  const [dropStatus, setDropStatus] = useState<SessionTaskStatus | null>(null);
  const [detailsTask, setDetailsTask] = useState<SessionTask | null>(null);
  const [reassigningTask, setReassigningTask] = useState<SessionTask | null>(null);
  const [reassignAssigneeId, setReassignAssigneeId] = useState('');
  const [engineSuggestions, setEngineSuggestions] = useState<SessionSuggestion[]>([]);
  const [lastHandledCreateKey, setLastHandledCreateKey] = useState(0);

  useEffect(() => {
    if (openCreateKey > 0 && openCreateKey !== lastHandledCreateKey) {
      setLastHandledCreateKey(openCreateKey);
      setCreateOpen(true);
    }
  }, [lastHandledCreateKey, openCreateKey]);

  useEffect(() => {
    onEngineSuggestionsChange?.(engineSuggestions);
  }, [engineSuggestions, onEngineSuggestionsChange]);

  useEffect(() => {
    if (!isModerator) {
      return;
    }

    const liveSet = new Set(liveParticipantNames.map((name) => name.trim().toLowerCase()));
    const staleTasks = tasks.filter((task) => task.assignee?.full_name && !liveSet.has(task.assignee.full_name.trim().toLowerCase()) && task.status !== 'done');
    if (!staleTasks.length) {
      return;
    }

    const suggestions = staleTasks.map((task) => ({
      id: `offline-${task.id}`,
      source: 'engine' as const,
      action: 'reassign_task' as const,
      taskId: task.id,
      title: 'Переназначить задачу',
      description: `Исполнитель задачи "${task.title}" неактивен. Нужна новая раздача.`,
    }));
    setEngineSuggestions((prev) => [...prev.filter((item) => !suggestions.some((next) => next.id === item.id)), ...suggestions].slice(-8));
  }, [isModerator, liveParticipantNames, tasks]);

  const filteredTasks = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();

    return tasks.filter((task) => {
      const matchesQuery = !normalizedQuery
        || task.title.toLowerCase().includes(normalizedQuery)
        || task.description.toLowerCase().includes(normalizedQuery)
        || task.assignee?.full_name?.toLowerCase().includes(normalizedQuery);

      const matchesAssignee = assigneeFilter === 'all'
        ? true
        : assigneeFilter === 'unassigned'
          ? task.assignee_id == null
          : String(task.assignee_id ?? '') === assigneeFilter;

      return matchesQuery && matchesAssignee;
    });
  }, [assigneeFilter, query, tasks]);

  const tasksByStatus = useMemo<Record<SessionTaskStatus, SessionTask[]>>(
    () => ({
      backlog: filteredTasks.filter((task) => task.status === 'backlog'),
      assigned: filteredTasks.filter((task) => task.status === 'assigned'),
      in_progress: filteredTasks.filter((task) => task.status === 'in_progress'),
      blocked: filteredTasks.filter((task) => task.status === 'blocked'),
      done: filteredTasks.filter((task) => task.status === 'done'),
    }),
    [filteredTasks],
  );

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

    const payload: { status: SessionTaskStatus; assignee_id?: number | null } = { status: nextStatus };
    if (nextStatus === 'backlog') {
      payload.assignee_id = null;
    }
    await patchTask(draggedTask.id, payload);
  }

  async function requestAiTasks() {
    setAiLoading(true);
    setAiError('');
    try {
      const generated = await generateAiTasks({
        roomId: sessionId,
        roomTitle: sessionTitle || 'Учебная сессия',
        description: sessionDescription,
        messages: chatMessages,
      });
      setAiTasks(generated.map((item, index) => ({ ...item, localId: `${Date.now()}-${index}` })));
    } catch (err) {
      setAiTasks([]);
      setAiError(err instanceof Error ? err.message : 'Не удалось сгенерировать задачи.');
    } finally {
      setAiLoading(false);
    }
  }

  async function handleConfirmAiTasks() {
    const normalizedTasks = aiTasks
      .map((task) => ({
        title: task.title.trim(),
        description: task.description.trim(),
        assignee: task.assignee?.trim() ?? '',
      }))
      .filter((task) => task.title);

    if (!normalizedTasks.length) {
      setAiError('Добавьте хотя бы одну задачу.');
      return;
    }

    setAiSaving(true);
    setAiError('');
    try {
      for (const task of normalizedTasks) {
        const assigneeId = resolveAssigneeId(participants, task.assignee);
        await createTask({
          title: task.title,
          description: task.description,
          assignee_id: assigneeId,
          deadline: null,
          status: assigneeId ? 'assigned' : 'backlog',
          priority: 'medium',
        });
      }
      setAiOpen(false);
      setAiTasks([]);
      onNotify?.({ id: `ai-saved-${Date.now()}`, message: 'AI-задачи добавлены на доску', severity: 'success' });
    } catch (err) {
      setAiError(err instanceof Error ? err.message : 'Не удалось сохранить задачи.');
    } finally {
      setAiSaving(false);
    }
  }

  async function handleAutoAssignTask(taskId: number) {
    const task = tasks.find((item) => item.id === taskId);
    if (!task) {
      return;
    }
    const nextParticipant = chooseBestParticipant(tasks, participants, task.required_skills);
    if (!nextParticipant) {
      onNotify?.({ id: `no-participant-${task.id}`, message: 'Нет доступных участников для назначения', severity: 'warning' });
      return;
    }

    await patchTask(task.id, { assignee_id: nextParticipant.id, status: 'assigned' });
    onNotify?.({ id: `reassigned-${task.id}`, message: `Задача назначена: ${nextParticipant.full_name}`, severity: 'success' });
    setEngineSuggestions((prev) => prev.filter((item) => item.taskId !== task.id));
  }

  async function handleReassignConfirm() {
    if (!reassigningTask) {
      return;
    }
    const nextAssigneeId = reassignAssigneeId ? Number(reassignAssigneeId) : null;
    await patchTask(reassigningTask.id, {
      assignee_id: nextAssigneeId,
      status: nextAssigneeId ? 'assigned' : 'backlog',
    });
    const nextAssignee = participants.find((participant) => participant.id === nextAssigneeId);
    onNotify?.({
      id: `manual-reassign-${reassigningTask.id}`,
      message: nextAssignee ? `Задача переназначена: ${nextAssignee.full_name}` : 'Задача возвращена в бэклог',
      severity: 'success',
    });
    setReassigningTask(null);
    setReassignAssigneeId('');
  }

  async function handleSaveDetails(taskId: number, payload: { title: string; description: string; assignee_id: number | null; deadline: string | null; status: SessionTaskStatus; priority: SessionTask['priority'] }) {
    await patchTask(taskId, payload);
    setDetailsTask(null);
  }

  async function handleDeleteTask(taskId: number) {
    await removeTask(taskId);
    setDetailsTask(null);
  }

  function openAiMenu(event: MouseEvent<HTMLButtonElement>) {
    setAiMenuAnchor(event.currentTarget);
  }

  return (
    <>
      <Paper
        sx={{
          p: { xs: 2, md: fullscreen ? 2.5 : 2 },
          minHeight: 0,
          display: 'flex',
          flexDirection: 'column',
          gap: 2,
          borderRadius: 0,
          border: 'none',
          backgroundColor: 'transparent',
          boxShadow: 'none',
        }}
      >
        <BoardHeader
          query={query}
          assigneeFilter={assigneeFilter}
          participants={participants}
          onQueryChange={setQuery}
          onAssigneeFilterChange={setAssigneeFilter}
          onCreateTask={() => setCreateOpen(true)}
          onOpenAiActions={openAiMenu}
        />

        {error ? <Alert severity="warning">{error}</Alert> : null}

        {!loading && tasks.length === 0 ? (
          <Paper sx={{ p: 5, borderRadius: 2.5, border: '1px dashed #dbe2ea', textAlign: 'center', bgcolor: '#fcfcfd', boxShadow: 'none' }}>
            <Stack spacing={1.5} alignItems="center">
              <Typography variant="h6">Задач пока нет</Typography>
              <Button variant="contained" onClick={() => setCreateOpen(true)}>
                Создать первую задачу
              </Button>
            </Stack>
          </Paper>
        ) : (
          <Stack sx={{ flex: 1, minHeight: 0, overflowX: 'auto', overflowY: 'hidden' }}>
            <Stack direction="row" spacing={1.5} sx={{ minWidth: 'max-content', flex: 1 }}>
              {columnConfig.map((column) => {
                const columnTasks = tasksByStatus[column.status];
                return (
                  <KanbanColumn
                    key={column.status}
                    title={column.title}
                    count={columnTasks.length}
                    emptyLabel={column.emptyLabel}
                    activeDrop={dropStatus === column.status}
                    onDragOver={(event) => {
                      event.preventDefault();
                      setDropStatus(column.status);
                    }}
                    onDragLeave={() => setDropStatus((prev) => (prev === column.status ? null : prev))}
                    onDrop={() => void handleDrop(column.status)}
                  >
                    {columnTasks.map((task) => (
                      <TaskCard
                        key={task.id}
                        task={task}
                        dragging={draggedTaskId === task.id}
                        onDragStart={setDraggedTaskId}
                        onDragEnd={() => {
                          setDraggedTaskId(null);
                          setDropStatus(null);
                        }}
                        onOpen={setDetailsTask}
                      />
                    ))}
                  </KanbanColumn>
                );
              })}
            </Stack>
          </Stack>
        )}
      </Paper>

      <Menu anchorEl={aiMenuAnchor} open={Boolean(aiMenuAnchor)} onClose={() => setAiMenuAnchor(null)}>
        <MenuItem
          onClick={() => {
            setAiMenuAnchor(null);
            setAiOpen(true);
            void requestAiTasks();
          }}
        >
          Сгенерировать задачи через AI
        </MenuItem>
        <MenuItem
          onClick={() => {
            setAiMenuAnchor(null);
            engineSuggestions.forEach((item) => {
              if (item.taskId != null) {
                void handleAutoAssignTask(item.taskId);
              }
            });
          }}
        >
          Применить AI-подсказки
        </MenuItem>
      </Menu>

      <Dialog open={createOpen} onClose={() => setCreateOpen(false)} fullWidth maxWidth="sm">
        <DialogTitle>Создать задачу</DialogTitle>
        <DialogContent>
          <TaskCreateForm participants={participants} disabled={loading} submitLabel="Сохранить задачу" onSubmitted={() => setCreateOpen(false)} onSubmit={createTask} />
        </DialogContent>
      </Dialog>

      <Dialog open={Boolean(reassigningTask)} onClose={() => setReassigningTask(null)} fullWidth maxWidth="xs">
        <DialogTitle>Переназначить задачу</DialogTitle>
        <DialogContent>
          <Stack spacing={2} sx={{ pt: 1 }}>
            <Typography variant="body2" color="text.secondary">
              {reassigningTask ? `Выберите нового исполнителя для "${reassigningTask.title}"` : ''}
            </Typography>
            <Paper sx={{ p: 1.5, borderRadius: 3, border: '1px solid #e5e7eb' }}>
              <Stack spacing={1.5}>
                <select
                  value={reassignAssigneeId}
                  onChange={(event) => setReassignAssigneeId(event.target.value)}
                  style={{ width: '100%', padding: 10, borderRadius: 10, border: '1px solid #d1d5db', background: '#fff' }}
                >
                  <option value="">Вернуть в бэклог</option>
                  {participants.map((participant) => (
                    <option key={participant.id} value={String(participant.id)}>
                      {participant.full_name}
                    </option>
                  ))}
                </select>
                <Stack direction="row" spacing={1} justifyContent="flex-end">
                  <Button variant="outlined" onClick={() => setReassigningTask(null)}>Отмена</Button>
                  <Button variant="contained" onClick={() => void handleReassignConfirm()}>Подтвердить</Button>
                </Stack>
              </Stack>
            </Paper>
          </Stack>
        </DialogContent>
      </Dialog>

      <Dialog open={aiOpen} onClose={() => !aiLoading && !aiSaving && setAiOpen(false)} fullWidth maxWidth="md">
        <DialogTitle>AI-действия</DialogTitle>
        <DialogContent>
          <Stack spacing={2}>
            {aiError ? <Alert severity="warning">{aiError}</Alert> : null}
            <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1}>
              <Button variant="outlined" startIcon={<RefreshRoundedIcon />} onClick={() => void requestAiTasks()} disabled={aiLoading || aiSaving}>
                Сгенерировать заново
              </Button>
              <Button variant="contained" startIcon={<AddTaskRoundedIcon />} onClick={() => void handleConfirmAiTasks()} disabled={aiLoading || aiSaving || aiTasks.length === 0}>
                Сохранить на доску
              </Button>
            </Stack>

            {aiLoading ? <Alert severity="info">AI анализирует этап создания задач...</Alert> : null}
            {!aiLoading && !aiTasks.length && !aiError ? <Alert severity="info">Пока нет AI-предложений.</Alert> : null}

            <Stack spacing={1.25}>
              {aiTasks.map((task) => (
                <Paper key={task.localId} sx={{ p: 2, borderRadius: 3, bgcolor: '#f9fafb' }}>
                  <Stack spacing={1.25}>
                    <Stack direction="row" justifyContent="space-between" spacing={1} alignItems="center">
                      <Typography variant="subtitle2">Предложение AI</Typography>
                      <IconButton onClick={() => setAiTasks((prev) => prev.filter((item) => item.localId !== task.localId))} disabled={aiSaving} size="small">
                        <DeleteOutlineRoundedIcon fontSize="small" />
                      </IconButton>
                    </Stack>
                    <input value={task.title} onChange={(event) => setAiTasks((prev) => prev.map((item) => (item.localId === task.localId ? { ...item, title: event.target.value } : item)))} style={{ width: '100%', padding: 12, borderRadius: 10, border: '1px solid #d1d5db' }} />
                    <textarea value={task.description} onChange={(event) => setAiTasks((prev) => prev.map((item) => (item.localId === task.localId ? { ...item, description: event.target.value } : item)))} rows={3} style={{ width: '100%', padding: 12, borderRadius: 10, border: '1px solid #d1d5db', resize: 'vertical' }} />
                  </Stack>
                </Paper>
              ))}
            </Stack>
          </Stack>
        </DialogContent>
      </Dialog>

      <TaskDetailsDrawer
        task={detailsTask}
        participants={participants}
        open={Boolean(detailsTask)}
        onClose={() => setDetailsTask(null)}
        onSave={handleSaveDetails}
        onDelete={handleDeleteTask}
        onReassign={(task) => {
          setDetailsTask(null);
          setReassigningTask(task);
          setReassignAssigneeId(task.assignee_id ? String(task.assignee_id) : '');
        }}
      />
    </>
  );
}
