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
  if (status === 'backlog') {
    return 'Бэклог';
  }
  if (status === 'assigned') {
    return 'Назначена';
  }
  if (status === 'in_progress') {
    return 'В работе';
  }
  if (status === 'blocked') {
    return 'Заблокирована';
  }
  return 'Готово';
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

  const shortDescription = useMemo(() => buildShortDescription(completedWork, nextSteps), [completedWork, nextSteps]);

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
            Зафиксируйте результаты, вклад участников, блокеры и следующий шаг перед закрытием сессии.
          </Typography>
          {summary?.status === 'skipped' || autoFocusReminder ? (
            <Alert icon={<EventRepeatRoundedIcon fontSize="inherit" />} severity="info" sx={{ borderRadius: 3 }}>
              Итоги уже откладывались ранее. Их можно заполнить сейчас и сохранить целостную историю встречи.
            </Alert>
          ) : null}
        </Stack>
      </DialogTitle>
      <DialogContent dividers>
        <Stack spacing={2}>
          {error ? <Alert severity="error">{error}</Alert> : null}
          {loading ? (
            <Typography color="text.secondary">Загружаем форму итогов...</Typography>
          ) : (
            <>
              <Stack direction="row" spacing={1} useFlexGap flexWrap="wrap">
                {(summary?.participants || []).map((participant) => (
                  <Chip
                    key={`${participant.user_id ?? participant.full_name}-${participant.role_in_session}`}
                    label={participant.full_name}
                    size="small"
                    sx={{ borderRadius: 999, background: alpha('#165DFF', 0.08) }}
                  />
                ))}
              </Stack>

              <TextField
                label="Что было сделано"
                value={completedWork}
                onChange={(event) => setCompletedWork(event.target.value)}
                multiline
                minRows={4}
                fullWidth
              />

              {summary?.completion_summary || summary?.contribution_summary || summary?.bottleneck_summary || summary?.collaboration_summary ? (
                <PaperSummary summary={summary} />
              ) : null}

              <Box>
                <Stack direction="row" spacing={1} alignItems="center" sx={{ mb: 1 }}>
                  <HistoryRoundedIcon color="action" />
                  <Typography fontWeight={800}>Итоги по задачам</Typography>
                </Stack>
                {tasks.length === 0 ? (
                  <Alert severity="info" sx={{ borderRadius: 3 }}>
                    К этой сессии пока не привязаны задачи.
                  </Alert>
                ) : (
                  <Stack spacing={1.25}>
                    {tasks.map((task, index) => (
                      <Box key={`${task.task_id ?? index}-${task.title}`} sx={{ p: 1.5, borderRadius: 3, border: '1px solid', borderColor: 'divider', backgroundColor: 'rgba(22, 93, 255, 0.03)' }}>
                        <Stack direction={{ xs: 'column', md: 'row' }} spacing={1} alignItems={{ xs: 'stretch', md: 'center' }} justifyContent="space-between">
                          <Stack spacing={0.5}>
                            <Typography fontWeight={700}>{task.title}</Typography>
                            <Typography variant="body2" color="text.secondary">
                              {task.assignee_name ? `Ответственный: ${task.assignee_name}` : 'Ответственный не назначен'}
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
                              <MenuItem value="backlog">{statusLabel('backlog')}</MenuItem>
                              <MenuItem value="assigned">{statusLabel('assigned')}</MenuItem>
                              <MenuItem value="in_progress">{statusLabel('in_progress')}</MenuItem>
                              <MenuItem value="blocked">{statusLabel('blocked')}</MenuItem>
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
                label="Следующие шаги"
                value={nextSteps}
                onChange={(event) => setNextSteps(event.target.value)}
                multiline
                minRows={3}
                fullWidth
              />

              <TextField
                label="Краткое описание для истории"
                value={shortDescription}
                fullWidth
                InputProps={{ readOnly: true }}
                helperText="Поле заполняется автоматически на основе текста итогов."
              />
            </>
          )}
        </Stack>
      </DialogContent>
      <DialogActions sx={{ px: 3, py: 2 }}>
        <Button onClick={handleSkip} disabled={saving || loading} color="inherit">
          Отложить до завтра
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

function PaperSummary({ summary }: { summary: SessionSummary }) {
  return (
    <Stack spacing={1}>
      {summary.completion_summary ? <Alert severity="success">{summary.completion_summary}</Alert> : null}
      {summary.contribution_summary ? <Alert severity="info">{summary.contribution_summary}</Alert> : null}
      {summary.bottleneck_summary ? <Alert severity="warning">{summary.bottleneck_summary}</Alert> : null}
      {summary.collaboration_summary ? <Alert severity="info">{summary.collaboration_summary}</Alert> : null}
    </Stack>
  );
}
