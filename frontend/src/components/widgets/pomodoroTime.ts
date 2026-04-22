import type { PomodoroStateSnapshot } from '../../types/pomodoro';

export function formatMMSS(totalSeconds: number) {
  const s = Math.max(0, Math.floor(totalSeconds));
  const mm = String(Math.floor(s / 60)).padStart(2, '0');
  const ss = String(s % 60).padStart(2, '0');
  return `${mm}:${ss}`;
}

export function computeRemainingSeconds(snapshot: PomodoroStateSnapshot, nowMs: number) {
  if (!snapshot.enabled) return 0;
  if (!snapshot.running) return snapshot.timing.paused_remaining_s ?? snapshot.timing.duration_s;
  if (!snapshot.timing.started_at_ms) return snapshot.timing.duration_s;

  const elapsed = Math.max(0, Math.floor((nowMs - snapshot.timing.started_at_ms) / 1000));
  return Math.max(0, snapshot.timing.duration_s - elapsed);
}

export function phaseLabel(phase: PomodoroStateSnapshot['phase']) {
  if (phase === 'focus') return 'Фокус';
  if (phase === 'short_break') return 'Перерыв';
  return 'Длинный перерыв';
}

