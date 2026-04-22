import AssignmentTurnedInRoundedIcon from '@mui/icons-material/AssignmentTurnedInRounded';
import EventRepeatRoundedIcon from '@mui/icons-material/EventRepeatRounded';
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
  Divider,
  FormControl,
  InputLabel,
  MenuItem,
  Select,
  Stack,
  TextField,
  Typography,
} from '@mui/material';
import { alpha } from '@mui/material/styles';
import { useEffect, useMemo, useState } from 'react';

import {
  getSessionSummary,
  saveSessionSummary,
  skipSessionSummary,
  updateSessionSummary,
} from '../../api/sessionSummaries';
import type { SessionSummary, SessionSummaryTask, SessionTaskStatus } from '../../types';

function statusLabel(status: SessionTaskStatus) {
  if (status === 'done') {
    return 'Сделано';
  }
  if (status === 'in_progress') {
    return 'В работе';
  }
  return 'Нужно сделать';
}

function buildShortDescription(completedWork: string, nextSteps: string) {
  const base = completedWork.trim() || nextSteps.trim();
  return base.length > 160 ? `${base.slice(0, 157)}...` : base;
}

export function SessionSummaryDialog({
  open,
  sessionId,
  title,
  autoFocusReminder = false,
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

  const shortDescription = useMemo(
    () => buildShortDescription(completedWork, nextSteps),
    [completedWork, nextSteps],
  );

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

  async function handleSkip() {
    setSaving(true);
    setError('');
    try {
      const remindAt = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();
      const result = await skipSessionSummary(sessionId, remindAt);
      setSummary(result);
      onSaved?.(result);
      onClose();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Не удалось отложить итоги.');
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog open={open} onClose={onClose} fullWidth maxWidth="md">
      <DialogTitle sx={{ pb: 1.25 }}>
        <Stack spacing={1}>
          <Stack direction="row" spacing={1} alignItems="center">
            <AssignmentTurnedInRoundedIcon color="primary" />
            <Typography variant="h5" fontWeight={900}>
              {title || 'Итоги сессии'}
            </Typography>
          </Stack>
          <Typography variant="body2" color="text.secondary">
            Зафиксируйте, что получилось сделать, и обновите статусы задач. Это займет меньше минуты.
          </Typography>
          {summary?.status === 'skipped' || autoFocusReminder ? (
            <Alert icon={<EventRepeatRoundedIcon fontSize="inherit" />} severity="info" sx={{ borderRadius: 3 }}>
              Итоги были отложены. Напоминание сохранено, но их можно заполнить прямо сейчас.
            </Alert>
          ) : null}
        </Stack>
      </DialogTitle>
      <DialogContent dividers>
        <Stack spacing={2}>
          {error ? <Alert severity="error">{error}</Alert> : null}
          {loading ? (
            <Typography color="text.secondary">Загружаем данные сессии...</Typography>
          ) : (
            <>
              <Stack direction="row" spacing={1} useFlexGap flexWrap="wrap">
                {(summary?.participants || []).map((participant) => (
                  <Chip
                    key={`${participant.user_id ?? participant.full_name}-${participant.role_in_session}`}
                    label={participant.full_name}
                    size="small"
                    sx={{
                      borderRadius: 999,
                      background: alpha('#165DFF', 0.08),
                    }}
                  />
                ))}
              </Stack>

              <TextField
                label="Что было сделано на сессии"
                value={completedWork}
                onChange={(event) => setCompletedWork(event.target.value)}
                multiline
                minRows={4}
                fullWidth
                placeholder="Например: согласовали структуру проекта, распределили задачи и подготовили дедлайны."
              />

              <Box>
                <Stack direction="row" spacing={1} alignItems="center" sx={{ mb: 1 }}>
                  <HistoryRoundedIcon color="action" />
                  <Typography fontWeight={800}>Задачи сессии</Typography>
                </Stack>
                {tasks.length === 0 ? (
                  <Alert severity="info" sx={{ borderRadius: 3 }}>
                    На этой сессии задачи не создавались.
                  </Alert>
                ) : (
                  <Stack spacing={1.25}>
                    {tasks.map((task, index) => (
                      <Box
                        key={`${task.task_id ?? index}-${task.title}`}
                        sx={{
                          p: 1.5,
                          borderRadius: 3,
                          border: '1px solid',
                          borderColor: 'divider',
                          backgroundColor: 'rgba(22, 93, 255, 0.03)',
                        }}
                      >
                        <Stack
                          direction={{ xs: 'column', md: 'row' }}
                          spacing={1}
                          alignItems={{ xs: 'stretch', md: 'center' }}
                          justifyContent="space-between"
                        >
                          <Stack spacing={0.5}>
                            <Typography fontWeight={700}>{task.title}</Typography>
                            <Typography variant="body2" color="text.secondary">
                              {task.assignee_name ? `Исполнитель: ${task.assignee_name}` : 'Исполнитель не назначен'}
                            </Typography>
                          </Stack>

                          <FormControl size="small" sx={{ minWidth: 170 }}>
                            <InputLabel id={`task-status-${index}`}>Статус</InputLabel>
                            <Select
                              labelId={`task-status-${index}`}
                              label="Статус"
                              value={task.status_at_summary}
                              onChange={(event) => {
                                const nextStatus = event.target.value as SessionTaskStatus;
                                setTasks((prev) => prev.map((item, itemIndex) => (
                                  itemIndex === index ? { ...item, status_at_summary: nextStatus } : item
                                )));
                              }}
                            >
                              <MenuItem value="todo">{statusLabel('todo')}</MenuItem>
                              <MenuItem value="in_progress">{statusLabel('in_progress')}</MenuItem>
                              <MenuItem value="done">{statusLabel('done')}</MenuItem>
                            </Select>
                          </FormControl>
                        </Stack>
                      </Box>
                    ))}
                  </Stack>
                )}
              </Box>

              <Divider />

              <TextField
                label="Какие задачи остались / следующие шаги"
                value={nextSteps}
                onChange={(event) => setNextSteps(event.target.value)}
                multiline
                minRows={3}
                fullWidth
                placeholder="Например: доделать экран истории, проверить миграции и подготовить демо."
              />

              <TextField
                label="Краткое описание для истории"
                value={shortDescription}
                fullWidth
                InputProps={{ readOnly: true }}
                helperText="Формируется автоматически и используется в карточке истории."
              />
            </>
          )}
        </Stack>
      </DialogContent>
      <DialogActions sx={{ px: 3, py: 2 }}>
        <Button onClick={handleSkip} disabled={saving || loading} color="inherit">
          Пропустить и напомнить завтра
        </Button>
        <Button onClick={onClose} disabled={saving}>
          Закрыть
        </Button>
        <Button variant="contained" onClick={handleSave} disabled={saving || loading}>
          Сохранить итоги
        </Button>
      </DialogActions>
    </Dialog>
  );
}
