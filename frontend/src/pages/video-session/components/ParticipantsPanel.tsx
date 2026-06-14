import BlockRoundedIcon from '@mui/icons-material/BlockRounded';
import { Box, Button, Stack, Typography } from '@mui/material';
import { alpha } from '@mui/material/styles';

import type { SessionDashboardParticipant, SessionTask } from '../../../types';
import { formatShortName } from '../utils';
import { SessionPanelCard, SessionSidePanel } from './SessionSidePanel';

export function ParticipantsPanel({
  participants,
  participantTasks,
  canBlockParticipants = false,
  currentUserId,
  onParticipantClick,
  onBlockParticipant,
}: {
  participants: SessionDashboardParticipant[];
  participantTasks: Record<number, SessionTask>;
  canBlockParticipants?: boolean;
  currentUserId?: number;
  onParticipantClick?: (participantId: number) => void;
  onBlockParticipant?: (participantId: number) => void;
}) {
  return (
    <SessionSidePanel
      title="Участники"
      subtitle="Состав команды, статус и текущие задачи."
    >
      <Stack spacing={1}>
        {participants.length ? participants.map((participant) => {
          const task = participantTasks[participant.id];
          const canBlock = canBlockParticipants && participant.id !== currentUserId && !participant.is_blocked;

          return (
            <SessionPanelCard
              key={participant.id}
              onClick={onParticipantClick ? () => onParticipantClick(participant.id) : undefined}
            >
              <Stack spacing={0.75}>
                <Stack direction="row" justifyContent="space-between" alignItems="center" spacing={1}>
                  <Typography variant="body2" sx={{ fontWeight: 700, color: '#f8fafc' }}>
                    {formatShortName(participant.full_name)}
                  </Typography>
                  <Box
                    sx={{
                      px: 1,
                      py: 0.25,
                      borderRadius: 999,
                      fontSize: '0.7rem',
                      fontWeight: 700,
                      color: participant.is_blocked
                        ? '#fca5a5'
                        : participant.is_online
                          ? '#86efac'
                          : alpha('#f8fafc', 0.55),
                      backgroundColor: participant.is_blocked
                        ? alpha('#dc2626', 0.2)
                        : participant.is_online
                          ? alpha('#16a34a', 0.2)
                          : alpha('#ffffff', 0.08),
                      border: '1px solid',
                      borderColor: participant.is_blocked
                        ? alpha('#fca5a5', 0.35)
                        : participant.is_online
                          ? alpha('#86efac', 0.35)
                          : alpha('#ffffff', 0.1),
                      flexShrink: 0,
                    }}
                  >
                    {participant.is_blocked ? 'Заблокирован' : participant.is_online ? 'Онлайн' : 'Офлайн'}
                  </Box>
                </Stack>

                <Typography variant="caption" sx={{ color: alpha('#f8fafc', 0.62) }}>
                  Активных: {participant.active_tasks} · Выполнено: {participant.completed_tasks} · Нагрузка: {participant.load_percent}% · Надёжность: {Math.round(participant.reliability_score * 100)}%
                </Typography>

                {task ? (
                  <Box
                    sx={{
                      mt: 0.25,
                      px: 1,
                      py: 0.75,
                      borderRadius: 1.5,
                      backgroundColor: alpha('#2563eb', 0.18),
                      border: '1px solid',
                      borderColor: alpha('#60a5fa', 0.28),
                    }}
                  >
                    <Typography variant="caption" sx={{ color: alpha('#f8fafc', 0.62) }}>
                      Текущая задача
                    </Typography>
                    <Typography variant="body2" sx={{ color: '#f8fafc', fontWeight: 600 }}>
                      {task.title}
                    </Typography>
                  </Box>
                ) : (
                  <Typography variant="caption" sx={{ color: alpha('#f8fafc', 0.45) }}>
                    Нет активной задачи
                  </Typography>
                )}

                {canBlock ? (
                  <Button
                    size="small"
                    color="error"
                    variant="outlined"
                    startIcon={<BlockRoundedIcon fontSize="small" />}
                    onClick={(event) => {
                      event.stopPropagation();
                      onBlockParticipant?.(participant.id);
                    }}
                    sx={{
                      alignSelf: 'flex-start',
                      mt: 0.25,
                      borderColor: alpha('#fca5a5', 0.45),
                      color: '#fca5a5',
                      textTransform: 'none',
                    }}
                  >
                    Заблокировать
                  </Button>
                ) : null}
              </Stack>
            </SessionPanelCard>
          );
        }) : (
          <Typography variant="body2" sx={{ color: alpha('#f8fafc', 0.62), textAlign: 'center', py: 2 }}>
            Участники появятся после подключения к сессии.
          </Typography>
        )}
      </Stack>
    </SessionSidePanel>
  );
}
