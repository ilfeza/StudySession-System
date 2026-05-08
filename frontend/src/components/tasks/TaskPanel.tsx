import AddTaskRoundedIcon from '@mui/icons-material/AddTaskRounded';
import DeleteOutlineRoundedIcon from '@mui/icons-material/DeleteOutlineRounded';
import RefreshRoundedIcon from '@mui/icons-material/RefreshRounded';
import { Alert, Button, Dialog, DialogContent, DialogTitle, IconButton, Menu, MenuItem, Paper, Stack, Typography } from '@mui/material';
import { useEffect, useMemo, useRef, useState, type MouseEvent } from 'react';

import { generateAiTasks } from '../../api/ai';
import type { AiTaskSuggestion, ChatMessage, SessionParticipant, SessionTask, SessionTaskStatus } from '../../types';
import {
  chooseBestParticipant,
  getTaskAgeMinutes,
  type SessionNotification,
  type SessionSuggestion,
} from '../../pages/video-session/sessionIntelligence';
import { BoardHeader } from './BoardHeader';
import { KanbanColumn } from './KanbanColumn';
import { TaskCard } from './TaskCard';
import { TaskCreateForm } from './TaskCreateForm';
import { TaskDetailsDrawer } from './TaskDetailsDrawer';
import { useSessionTasks, type SessionTasksController } from './useSessionTasks';

const columnConfig: Array<{ status: 'todo' | 'in_progress' | 'blocked' | 'done'; title: string; emptyLabel: string }> = [
  { status: 'todo', title: 'К выполнению', emptyLabel: 'Добавьте первую задачу' },
  { status: 'in_progress', title: 'В работе', emptyLabel: 'Здесь появятся задачи в работе' },
  { status: 'blocked', title: 'Заблокировано', emptyLabel: 'Заблокированных задач пока нет' },
  { status: 'done', title: 'Готово', emptyLabel: 'Завершённые задачи появятся здесь' },
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
  const previousStatusRef = useRef<Map<number, SessionTaskStatus>>(new Map());
  const handledBlockedRef = useRef<Set<number>>(new Set());
  const handledOfflineRef = useRef<Set<string>>(new Set());
  const lastHandledCreateKeyRef = useRef(0);

  useEffect(() => {
    if (openCreateKey > 0 && openCreateKey !== lastHandledCreateKeyRef.current) {
      lastHandledCreateKeyRef.current = openCreateKey;
      setCreateOpen(true);
    }
  }, [openCreateKey]);

  useEffect(() => {
    onEngineSuggestionsChange?.(engineSuggestions);
  }, [engineSuggestions, onEngineSuggestionsChange]);

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

  const tasksByStatus = useMemo<Record<'todo' | 'in_progress' | 'blocked' | 'done', SessionTask[]>>(
    () => ({
      todo: filteredTasks.filter((task) => task.status === 'todo' || task.status === 'needs_reassignment'),
      in_progress: filteredTasks.filter((task) => task.status === 'in_progress'),
      blocked: filteredTasks.filter((task) => task.status === 'blocked'),
      done: filteredTasks.filter((task) => task.status === 'done'),
    }),
    [filteredTasks],
  );

  useEffect(() => {
    const nextSuggestions: SessionSuggestion[] = [];
    const previousStatuses = previousStatusRef.current;

    tasks.forEach((task) => {
      const previousStatus = previousStatuses.get(task.id);

      if (previousStatus && previousStatus !== 'done' && task.status === 'done') {
        const nextTask = tasks.find((item) => item.id !== task.id && (item.status === 'todo' || item.status === 'needs_reassignment') && item.assignee_id == null);
        if (nextTask) {
          nextSuggestions.push({
            id: `next-${task.id}-${nextTask.id}`,
            source: 'engine',
            action: 'assign_next',
            taskId: nextTask.id,
            title: 'Готова следующая задача',
            description: `Задачу "${nextTask.title}" можно сразу отдать следующему участнику.`,
          });
          onNotify?.({ id: `done-${task.id}`, message: `Следующая задача готова: ${nextTask.title}`, severity: 'info' });
        }
      }

      previousStatuses.set(task.id, task.status);

      const ageMinutes = getTaskAgeMinutes(task);
      if ((task.status === 'blocked' || task.status === 'in_progress') && ageMinutes >= 20 && !handledBlockedRef.current.has(task.id)) {
        handledBlockedRef.current.add(task.id);
        nextSuggestions.push({
          id: `stale-${task.id}`,
          source: 'engine',
          action: 'reassign_task',
          taskId: task.id,
          title: 'Задаче нужна помощь',
          description: `Задача "${task.title}" давно не двигается. Возможно, стоит помочь или переназначить её.`,
        });
        onNotify?.({ id: `stale-toast-${task.id}`, message: `Проверьте задачу: ${task.title}`, severity: 'warning' });
      }
    });

    setEngineSuggestions((prev) => {
      const map = new Map(prev.map((item) => [item.id, item]));
      nextSuggestions.forEach((item) => map.set(item.id, item));
      return [...map.values()].slice(-8);
    });
  }, [tasks, onNotify]);

  useEffect(() => {
    if (!isModerator || !liveParticipantNames.length) {
      return;
    }

    const liveSet = new Set(liveParticipantNames.map((name) => name.trim().toLowerCase()));
    const offlineParticipants = participants.filter((participant) => !liveSet.has(participant.full_name.trim().toLowerCase()));

    offlineParticipants.forEach((participant) => {
      const marker = `${participant.id}-${participant.full_name}`;
      if (handledOfflineRef.current.has(marker)) {
        return;
      }
      handledOfflineRef.current.add(marker);

      const affectedTasks = tasks.filter((task) => task.assignee_id === participant.id && task.status !== 'done');
      if (!affectedTasks.length) {
        return;
      }

      onNotify?.({
        id: `offline-${participant.id}`,
        message: `${participant.full_name} вышел из сессии, ${affectedTasks.length} задач(и) нужно переназначить`,
        severity: 'warning',
      });

      affectedTasks.forEach((task) => {
        void patchTask(task.id, { status: 'needs_reassignment', assignee_id: null });
      });

      setEngineSuggestions((prev) => [
        ...prev,
        ...affectedTasks.map((task) => ({
          id: `offline-${task.id}`,
          source: 'engine' as const,
          action: 'reassign_task' as const,
          taskId: task.id,
          title: 'Нужно переназначение',
          description: `Задача "${task.title}" осталась без исполнителя.`,
        })),
      ].slice(-8));
    });
  }, [isModerator, liveParticipantNames, participants, tasks, patchTask, onNotify]);

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
        await createTask({
          title: task.title,
          description: task.description,
          assignee_id: resolveAssigneeId(participants, task.assignee),
          deadline: null,
          status: 'todo',
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

    await patchTask(task.id, { assignee_id: nextParticipant.id, status: 'todo' });
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
      status: nextAssigneeId ? 'todo' : 'needs_reassignment',
    });
    const nextAssignee = participants.find((participant) => participant.id === nextAssigneeId);
    onNotify?.({
      id: `manual-reassign-${reassigningTask.id}`,
      message: nextAssignee ? `Задача переназначена: ${nextAssignee.full_name}` : 'Задача отмечена для переназначения',
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
                  <option value="">Нужно переназначить</option>
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

            {aiLoading ? <Alert severity="info">AI анализирует сессию...</Alert> : null}
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
