from __future__ import annotations

from dataclasses import dataclass
from datetime import datetime, timedelta

from sqlalchemy.orm import Session

from app.models import PomodoroPhase, PomodoroState, VideoSession


DEFAULT_FOCUS_S = 25 * 60
DEFAULT_SHORT_BREAK_S = 5 * 60
DEFAULT_LONG_BREAK_S = 15 * 60
DEFAULT_CYCLES_BEFORE_LONG = 4


@dataclass(frozen=True)
class PomodoroDurations:
    focus_duration_s: int
    short_break_duration_s: int
    long_break_duration_s: int
    cycles_before_long_break: int


def _now_utc() -> datetime:
    return datetime.utcnow()

def _to_ms(value: datetime) -> int:
    return int(value.timestamp() * 1000)


def _phase_duration_s(state: PomodoroState) -> int:
    if state.phase == PomodoroPhase.focus:
        return int(state.focus_duration_s)
    if state.phase == PomodoroPhase.short_break:
        return int(state.short_break_duration_s)
    return int(state.long_break_duration_s)


def _next_phase(state: PomodoroState) -> PomodoroPhase:
    if state.phase == PomodoroPhase.focus:
        return PomodoroPhase.long_break if (state.cycle_index + 1) % max(1, state.cycles_before_long_break) == 0 else PomodoroPhase.short_break
    return PomodoroPhase.focus


class PomodoroService:
    def __init__(self, db: Session):
        self.db = db

    def get_or_create(self, session_id: int) -> PomodoroState:
        state = self.db.query(PomodoroState).filter(PomodoroState.session_id == session_id).first()
        if state:
            return state

        session = self.db.get(VideoSession, session_id)
        if not session:
            raise ValueError('Сессия не найдена.')

        state = PomodoroState(session_id=session_id)
        self.db.add(state)
        self.db.commit()
        self.db.refresh(state)
        return state

    def normalize_progress(self, state: PomodoroState) -> PomodoroState:
        """
        Продвигаем фазы по времени так, чтобы снапшот всегда был актуален.
        Это критично для late-join: новый клиент сразу увидит текущий этап.
        """
        if not state.enabled or not state.running or not state.started_at:
            return state

        now = _now_utc()
        guard = 0
        while guard < 12:
            guard += 1
            duration_s = _phase_duration_s(state)
            elapsed_s = int((now - state.started_at).total_seconds())
            if elapsed_s < duration_s:
                break

            overflow_s = elapsed_s - duration_s
            next_phase = _next_phase(state)
            if state.phase == PomodoroPhase.focus:
                state.cycle_index = int(state.cycle_index) + 1

            state.phase = next_phase
            state.started_at = now - timedelta(seconds=overflow_s)
            state.updated_at = now

            self.db.commit()

        return state

    def build_snapshot(self, state: PomodoroState) -> dict:
        state = self.normalize_progress(state)

        duration_s = _phase_duration_s(state) if state.enabled else 0
        started_at = state.started_at.isoformat() if state.started_at else None
        now = _now_utc()

        return {
            'session_id': state.session_id,
            'enabled': state.enabled,
            'running': state.running,
            'phase': state.phase.value,
            'cycle_index': state.cycle_index,
            'durations': {
                'focus_duration_s': state.focus_duration_s,
                'short_break_duration_s': state.short_break_duration_s,
                'long_break_duration_s': state.long_break_duration_s,
                'cycles_before_long_break': state.cycles_before_long_break,
            },
            'timing': {
                'server_time': now.isoformat(),
                'server_time_ms': _to_ms(now),
                'started_at': started_at,
                'started_at_ms': _to_ms(state.started_at) if state.started_at else None,
                'duration_s': duration_s,
                'paused_remaining_s': state.paused_remaining_s,
            },
            'controller': {
                'user_id': state.controller_user_id,
                'name': state.controller_name,
            },
            'last_started_by': {
                'user_id': state.last_started_by_id,
                'name': state.last_started_by_name,
            },
            'updated_at': state.updated_at.isoformat() if state.updated_at else now.isoformat(),
        }

    def start(
        self,
        state: PomodoroState,
        *,
        controller_user_id: int,
        controller_name: str,
        durations: PomodoroDurations,
    ) -> PomodoroState:
        now = _now_utc()
        state.enabled = True
        state.running = True
        state.phase = PomodoroPhase.focus
        state.cycle_index = 0
        state.started_at = now
        state.paused_remaining_s = None

        state.focus_duration_s = int(durations.focus_duration_s)
        state.short_break_duration_s = int(durations.short_break_duration_s)
        state.long_break_duration_s = int(durations.long_break_duration_s)
        state.cycles_before_long_break = int(durations.cycles_before_long_break)

        state.controller_user_id = controller_user_id
        state.controller_name = controller_name
        state.last_started_by_id = controller_user_id
        state.last_started_by_name = controller_name
        state.updated_at = now

        self.db.commit()
        self.db.refresh(state)
        return state

    def pause(self, state: PomodoroState) -> PomodoroState:
        if not state.enabled or not state.running:
            return state

        self.normalize_progress(state)
        now = _now_utc()

        duration_s = _phase_duration_s(state)
        elapsed_s = int((now - state.started_at).total_seconds()) if state.started_at else 0
        remaining_s = max(0, duration_s - elapsed_s)

        state.running = False
        state.paused_remaining_s = remaining_s
        state.started_at = None
        state.updated_at = now
        self.db.commit()
        self.db.refresh(state)
        return state

    def resume(self, state: PomodoroState) -> PomodoroState:
        if not state.enabled or state.running:
            return state

        now = _now_utc()
        state.running = True
        if state.paused_remaining_s is None:
            state.paused_remaining_s = _phase_duration_s(state)

        # Чтобы remaining = paused_remaining_s, ставим started_at так, будто уже прошло duration - remaining.
        duration_s = _phase_duration_s(state)
        elapsed_s = max(0, duration_s - int(state.paused_remaining_s))
        state.started_at = now - timedelta(seconds=elapsed_s)
        state.paused_remaining_s = None
        state.updated_at = now
        self.db.commit()
        self.db.refresh(state)
        return state

    def skip_phase(self, state: PomodoroState) -> PomodoroState:
        if not state.enabled:
            return state

        self.normalize_progress(state)
        now = _now_utc()

        if state.phase == PomodoroPhase.focus:
            state.cycle_index = int(state.cycle_index) + 1

        state.phase = _next_phase(state)
        state.running = True
        state.started_at = now
        state.paused_remaining_s = None
        state.updated_at = now
        self.db.commit()
        self.db.refresh(state)
        return state

    def reset(self, state: PomodoroState) -> PomodoroState:
        now = _now_utc()
        state.enabled = False
        state.running = False
        state.phase = PomodoroPhase.focus
        state.cycle_index = 0
        state.started_at = None
        state.paused_remaining_s = None
        state.updated_at = now
        self.db.commit()
        self.db.refresh(state)
        return state

    def claim_control(self, state: PomodoroState, *, controller_user_id: int, controller_name: str) -> PomodoroState:
        now = _now_utc()
        state.controller_user_id = controller_user_id
        state.controller_name = controller_name
        state.updated_at = now
        self.db.commit()
        self.db.refresh(state)
        return state

