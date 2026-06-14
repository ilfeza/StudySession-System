import AssignmentTurnedInRoundedIcon from '@mui/icons-material/AssignmentTurnedInRounded';
import CheckCircleRoundedIcon from '@mui/icons-material/CheckCircleRounded';
import HistoryRoundedIcon from '@mui/icons-material/HistoryRounded';
import {
  Alert,
  Box,
  Button,
  Chip,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  FormControl,
  InputLabel,
  MenuItem,
  Paper,
  Select,
  Stack,
  TextField,
  Typography,
} from '@mui/material';
import { alpha, useTheme } from '@mui/material/styles';
import { useEffect, useMemo, useState } from 'react';

import {
  getSessionSummary,
  saveSessionSummary,
  updateSessionSummary,
} from '../../api/sessionSummaries';
import type { SessionSummary, SessionSummaryTask, SessionTaskStatus } from '../../types';

function statusLabel(status: SessionTaskStatus) {
  if (status === 'backlog') return 'Бэклог';
  if (status === 'assigned') return 'Назначена';
  if (status === 'in_progress') return 'В работе';
  if (status === 'blocked') return 'Заблокирована';
  return 'Готово';
}

function buildShortDescription(completedWork: string, nextSteps: string) {
  const base = completedWork.trim() || nextSteps.trim();
  return base.length > 160 ? `${base.slice(0, 157)}...` : base;
}

function groupTasksByParticipant(tasks: SessionSummaryTask[], participantNames: string[]) {
  const buckets = new Map<string, SessionSummaryTask[]>();
  const unassignedKey = '__unassigned__';

  for (const task of tasks) {
    const key = task.assignee_name?.trim() || unassignedKey;
    if (!buckets.has(key)) {
      buckets.set(key, []);
    }
    buckets.get(key)!.push(task);
  }

  const ordered: Array<{ name: string; tasks: SessionSummaryTask[] }> = [];
  const seen = new Set<string>();

  for (const name of participantNames) {
    const items = buckets.get(name);
    if (items?.length) {
      ordered.push({ name, tasks: items });
      seen.add(name);
    }
  }

  buckets.forEach((items, key) => {
    if (key === unassignedKey || seen.has(key)) {
      return;
    }
    ordered.push({ name: key, tasks: items });
  });

  const unassigned = buckets.get(unassignedKey);
  if (unassigned?.length) {
    ordered.push({ name: 'Без исполнителя', tasks: unassigned });
  }

  return ordered;
}

export function SessionSummaryDialog({
  open,
  sessionId,
  title,
  onClose,
  onSaved,
}: {
  open: boolean;
  sessionId: number;
  title?: string;
  autoFocusReminder?: boolean;
  onClose: () => void;
  onSaved?: (summary: SessionSummary) => void;
}) {
  const theme = useTheme();
  const [summary, setSummary] = useState<SessionSummary | null>(null);
  const [completedWork, setCompletedWork] = useState('');
  const [nextSteps, setNextSteps] = useState('');
  const [tasks, setTasks] = useState<SessionSummaryTask[]>([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!open) {
      return;
    }

    let cancelled = false;
    setLoading(true);
    setError('');

    getSessionSummary(sessionId)
      .then((data) => {
        if (cancelled) {
          return;
        }
        setSummary(data);
        setCompletedWork(data.completed_work);
        setNextSteps(data.next_steps);
        setTasks(data.tasks);
      })
      .catch((err: unknown) => {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : 'Не удалось загрузить форму итогов.');
        }
      })
      .finally(() => {
        if (!cancelled) {
          setLoading(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [open, sessionId]);

  const shortDescription = useMemo(() => buildShortDescription(completedWork, nextSteps), [completedWork, nextSteps]);

  const tasksByParticipant = useMemo(
    () => groupTasksByParticipant(tasks, (summary?.participants || []).map((item) => item.full_name)),
    [summary?.participants, tasks],
  );

  function updateTaskStatus(taskRef: SessionSummaryTask, nextStatus: SessionTaskStatus) {
    setTasks((prev) => prev.map((item) => (
      item.task_id === taskRef.task_id && item.title === taskRef.title
        ? { ...item, status_at_summary: nextStatus }
        : item
    )));
  }

  async function handleSave() {
    setSaving(true);
    setError('');
    try {
      const payload = {
        completed_work: completedWork.trim(),
        next_steps: nextSteps.trim(),
        short_description: shortDescription,
        status: 'completed' as const,
        tasks: tasks.map((task, index) => ({
          task_id: task.task_id ?? null,
          status_at_summary: task.status_at_summary,
          sort_order: index,
        })),
      };
      const result = summary?.status === 'draft'
        ? await saveSessionSummary(sessionId, payload)
        : await updateSessionSummary(sessionId, payload);
      setSummary(result);
      onSaved?.(result);
      onClose();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Не удалось сохранить итоги.');
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog open={open} onClose={() => {}} fullWidth maxWidth="md">
      <DialogTitle sx={{ pb: 1.25 }}>
        <Stack direction="row" spacing={1} alignItems="center">
          <AssignmentTurnedInRoundedIcon color="primary" />
          <Typography variant="h5" fontWeight={900}>
            {title || 'Итоги сессии'}
          </Typography>
        </Stack>
      </DialogTitle>
      <DialogContent dividers>
        <Stack spacing={2.5}>
          {error ? <Alert severity="error">{error}</Alert> : null}
          {loading ? (
            <Typography color="text.secondary">Загружаем форму итогов...</Typography>
          ) : (
            <>
              <TextField
                label="Что было сделано"
                value={completedWork}
                onChange={(event) => setCompletedWork(event.target.value)}
                multiline
                minRows={4}
                fullWidth
              />

              <Box>
                <Stack direction="row" spacing={1} alignItems="center" sx={{ mb: 1.5 }}>
                  <HistoryRoundedIcon color="action" />
                  <Typography fontWeight={800}>Итоги по участникам</Typography>
                </Stack>

                {tasksByParticipant.length === 0 ? (
                  <Alert severity="info" sx={{ borderRadius: 2 }}>
                    К этой сессии пока не привязаны задачи.
                  </Alert>
                ) : (
                  <Stack spacing={1.5}>
                    {tasksByParticipant.map((group) => {
                      const doneTasks = group.tasks.filter((task) => task.status_at_summary === 'done');
                      const otherTasks = group.tasks.filter((task) => task.status_at_summary !== 'done');

                      return (
                        <Paper
                          key={group.name}
                          variant="outlined"
                          sx={{
                            p: 1.75,
                            borderRadius: 2,
                            bgcolor: alpha(theme.palette.primary.main, theme.palette.mode === 'dark' ? 0.06 : 0.03),
                          }}
                        >
                          <Stack spacing={1.25}>
                            <Stack direction="row" justifyContent="space-between" alignItems="center" spacing={1} flexWrap="wrap">
                              <Typography variant="subtitle1">{group.name}</Typography>
                              <Chip
                                size="small"
                                icon={<CheckCircleRoundedIcon />}
                                label={`Сделано: ${doneTasks.length} из ${group.tasks.length}`}
                                color={doneTasks.length ? 'success' : 'default'}
                                variant="outlined"
                              />
                            </Stack>

                            {doneTasks.length ? (
                              <Stack spacing={0.75}>
                                <Typography variant="caption" color="text.secondary">Выполненные задачи</Typography>
                                {doneTasks.map((task) => (
                                  <Stack
                                    key={`${task.task_id ?? task.title}-done`}
                                    direction={{ xs: 'column', sm: 'row' }}
                                    spacing={1}
                                    alignItems={{ sm: 'center' }}
                                    justifyContent="space-between"
                                  >
                                    <Typography variant="body2" sx={{ fontWeight: 600 }}>{task.title}</Typography>
                                    <FormControl size="small" sx={{ minWidth: 160 }}>
                                      <InputLabel>Статус</InputLabel>
                                      <Select
                                        label="Статус"
                                        value={task.status_at_summary}
                                        onChange={(event) => updateTaskStatus(task, event.target.value as SessionTaskStatus)}
                                      >
                                        <MenuItem value="done">{statusLabel('done')}</MenuItem>
                                        <MenuItem value="in_progress">{statusLabel('in_progress')}</MenuItem>
                                        <MenuItem value="assigned">{statusLabel('assigned')}</MenuItem>
                                        <MenuItem value="backlog">{statusLabel('backlog')}</MenuItem>
                                        <MenuItem value="blocked">{statusLabel('blocked')}</MenuItem>
                                      </Select>
                                    </FormControl>
                                  </Stack>
                                ))}
                              </Stack>
                            ) : null}

                            {otherTasks.length ? (
                              <Stack spacing={0.75}>
                                <Typography variant="caption" color="text.secondary">
                                  {doneTasks.length ? 'Остальные задачи' : 'Задачи участника'}
                                </Typography>
                                {otherTasks.map((task) => (
                                  <Stack
                                    key={`${task.task_id ?? task.title}-other`}
                                    direction={{ xs: 'column', sm: 'row' }}
                                    spacing={1}
                                    alignItems={{ sm: 'center' }}
                                    justifyContent="space-between"
                                  >
                                    <Typography variant="body2">{task.title}</Typography>
                                    <FormControl size="small" sx={{ minWidth: 160 }}>
                                      <InputLabel>Статус</InputLabel>
                                      <Select
                                        label="Статус"
                                        value={task.status_at_summary}
                                        onChange={(event) => updateTaskStatus(task, event.target.value as SessionTaskStatus)}
                                      >
                                        <MenuItem value="backlog">{statusLabel('backlog')}</MenuItem>
                                        <MenuItem value="assigned">{statusLabel('assigned')}</MenuItem>
                                        <MenuItem value="in_progress">{statusLabel('in_progress')}</MenuItem>
                                        <MenuItem value="blocked">{statusLabel('blocked')}</MenuItem>
                                        <MenuItem value="done">{statusLabel('done')}</MenuItem>
                                      </Select>
                                    </FormControl>
                                  </Stack>
                                ))}
                              </Stack>
                            ) : null}
                          </Stack>
                        </Paper>
                      );
                    })}
                  </Stack>
                )}
              </Box>

              <TextField
                label="Следующие шаги"
                value={nextSteps}
                onChange={(event) => setNextSteps(event.target.value)}
                multiline
                minRows={4}
                fullWidth
              />
            </>
          )}
        </Stack>
      </DialogContent>
      <DialogActions sx={{ px: 3, py: 2 }}>
        <Button variant="contained" onClick={() => void handleSave()} disabled={saving || loading}>
          Сохранить итоги
        </Button>
      </DialogActions>
    </Dialog>
  );
}
