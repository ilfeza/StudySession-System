import { Button, Stack, Typography } from '@mui/material';



import type { SessionStage } from '../../../types/pomodoro';



export const sessionStageLabels: Record<SessionStage, string> = {

  task_creation: 'Подготовка',

  task_distribution: 'Обсуждение',

  execution: 'Выполнение',

  review: 'Завершение',

};



const switchableStages: SessionStage[] = ['task_creation', 'task_distribution', 'execution', 'review'];



export function SessionStageSwitcher({
  currentStage,
  onStageChange,
  disabled = false,
}: {
  currentStage: SessionStage | null;
  onStageChange: (stage: SessionStage) => void;
  disabled?: boolean;
}) {
  return (
    <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap>
      {switchableStages.map((stageKey) => {
        const active = currentStage === stageKey;
        return (
          <Button
            key={stageKey}
            size="small"
            variant={active ? 'contained' : 'outlined'}
            disabled={disabled}
            onClick={() => onStageChange(stageKey)}

            sx={{

              borderRadius: 999,

              textTransform: 'none',

              fontWeight: 700,

              borderColor: active ? 'primary.main' : 'divider',

            }}

          >

            {sessionStageLabels[stageKey]}

          </Button>

        );

      })}

    </Stack>

  );

}



export function SessionStageDurationLabel({ seconds }: { seconds: number }) {

  const total = Math.max(0, Math.floor(seconds));

  const hours = Math.floor(total / 3600);

  const minutes = Math.floor((total % 3600) / 60);

  const secs = total % 60;



  const label = hours > 0

    ? `${hours}:${String(minutes).padStart(2, '0')}:${String(secs).padStart(2, '0')}`

    : `${String(minutes).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;



  return (

    <Typography variant="caption" color="text.secondary" sx={{ fontWeight: 600 }}>

      {label}

    </Typography>

  );

}


