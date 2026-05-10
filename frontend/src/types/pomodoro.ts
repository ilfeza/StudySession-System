export type PomodoroPhase = 'focus' | 'short_break' | 'long_break';

export interface PomodoroDurations {
  focus_duration_s: number;
  short_break_duration_s: number;
  long_break_duration_s: number;
  cycles_before_long_break: number;
}

export interface PomodoroTiming {
  server_time: string;
  server_time_ms: number;
  started_at: string | null;
  started_at_ms: number | null;
  duration_s: number;
  paused_remaining_s: number | null;
}

export interface PomodoroController {
  user_id: number | null;
  name: string;
}

export interface PomodoroLastStartedBy {
  user_id: number | null;
  name: string;
}

export interface PomodoroStateSnapshot {
  session_id: number;
  enabled: boolean;
  running: boolean;
  phase: PomodoroPhase;
  cycle_index: number;
  durations: PomodoroDurations;
  timing: PomodoroTiming;
  controller: PomodoroController;
  last_started_by: PomodoroLastStartedBy;
  updated_at: string;
}

export type SessionStage = 'task_creation' | 'task_distribution' | 'execution' | 'review';

export interface StageTiming {
  server_time: string;
  server_time_ms: number;
  stage_started_at: string;
  stage_started_at_ms: number;
  elapsed_s: number;
}

export interface StageStateSnapshot {
  session_id: number;
  current_stage: SessionStage;
  timing: StageTiming;
  updated_at: string;
}

export type WidgetsServerEvent =
  | { event: 'pomodoro_state'; payload: PomodoroStateSnapshot }
  | { event: 'pomodoro_started'; payload: PomodoroStateSnapshot }
  | { event: 'pomodoro_controller_changed'; payload: PomodoroStateSnapshot }
  | { event: 'stage_state'; payload: StageStateSnapshot }
  | { event: 'stage_changed'; payload: StageStateSnapshot }
  | {
      event: 'pomodoro_error';
      payload: { message: string; controller_user_id: number | null; controller_name: string };
    }
  | {
      event: 'stage_error';
      payload: { message: string };
    };

export type WidgetsClientEvent =
  | { event: 'pomodoro_start'; payload: { durations: PomodoroDurations } }
  | { event: 'pomodoro_pause'; payload: {} }
  | { event: 'pomodoro_resume'; payload: {} }
  | { event: 'pomodoro_skip_phase'; payload: {} }
  | { event: 'pomodoro_reset'; payload: {} }
  | { event: 'pomodoro_claim_control'; payload: {} }
  | { event: 'stage_set'; payload: { stage: SessionStage } };

