import { Box, Stack, Typography } from '@mui/material';
import { alpha } from '@mui/material/styles';

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
    <Box sx={{ height: '100%', color: '#f8fbff' }}>
      <Stack spacing={1.5}>
        <Box>
          <Typography variant="h6" fontWeight={900} sx={{ color: '#ffffff' }}>
            Виджеты комнаты
          </Typography>
          <Typography variant="body2" sx={{ color: alpha('#ffffff', 0.68) }}>
            Здесь будут появляться общие инструменты (таймер, доска, голосование и т.д.).
          </Typography>
        </Box>

        <PomodoroSettingsPanel snapshot={snapshot} localUserName={localUserName} send={send} />
      </Stack>
    </Box>
  );
}

