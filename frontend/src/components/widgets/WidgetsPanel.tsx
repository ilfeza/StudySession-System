import { Box, Stack, Typography } from '@mui/material';

import type { PomodoroStateSnapshot, WidgetsClientEvent } from '../../types/pomodoro';
import { PomodoroSettingsPanel } from './PomodoroSettingsPanel';

export function WidgetsPanel({
  snapshot,
  localUserName,
  send,
}: {
  snapshot: PomodoroStateSnapshot | null;
  localUserName: string;
  send: (message: WidgetsClientEvent) => void;
}) {
  return (
    <Box sx={{ height: '100%' }}>
      <Stack spacing={2}>
        <Box>
          <Typography variant="h6">Виджеты комнаты</Typography>
          <Typography variant="body2" color="text.secondary" sx={{ mt: 0.75 }}>
            Дополнительные инструменты скрыты здесь, чтобы не мешать основной работе во время встречи.
          </Typography>
        </Box>
        <PomodoroSettingsPanel snapshot={snapshot} localUserName={localUserName} send={send} />
      </Stack>
    </Box>
  );
}
