from __future__ import annotations

from datetime import datetime

from sqlalchemy.orm import Session

from app.models import SessionStage, SessionStageState, SessionSummary, SessionSummaryStatus, SessionTaskStatus, Task, VideoSession


def _now_utc() -> datetime:
    return datetime.utcnow()


def _to_ms(value: datetime) -> int:
    return int(value.timestamp() * 1000)


def _empty_stage_durations() -> dict[str, int]:
    return {stage.value: 0 for stage in SessionStage}


class SessionStageService:
    def __init__(self, db: Session):
        self.db = db

    def get_or_create(self, session_id: int) -> SessionStageState:
        state = self.db.query(SessionStageState).filter(SessionStageState.session_id == session_id).first()
        if state:
            return state

        session = self.db.get(VideoSession, session_id)
        if not session:
            raise ValueError('Сессия не найдена.')

        now = _now_utc()
        state = SessionStageState(
            session_id=session_id,
            current_stage=SessionStage.task_creation,
            stage_started_at=now,
            stage_durations=_empty_stage_durations(),
            updated_at=now,
        )
        self.db.add(state)
        self.db.commit()
        self.db.refresh(state)
        return state

    def set_stage(self, state: SessionStageState, stage: SessionStage) -> SessionStageState:
        if state.current_stage == stage:
            state.stage_locked = True
            self.db.commit()
            self.db.refresh(state)
            return state

        now = _now_utc()
        self._accumulate_elapsed(state, now)
        state.current_stage = stage
        state.stage_started_at = now
        state.updated_at = now
        state.stage_locked = True
        self.db.commit()
        self.db.refresh(state)
        return state

    def sync_stage_for_session(self, session_id: int) -> tuple[SessionStageState, bool]:
        state = self.get_or_create(session_id)
        if state.stage_locked:
            return state, False
        derived_stage = self._derive_stage(session_id)
        if state.current_stage != derived_stage:
            now = _now_utc()
            self._accumulate_elapsed(state, now)
            state.current_stage = derived_stage
            state.stage_started_at = now
            state.updated_at = now
            self.db.commit()
            self.db.refresh(state)
            return state, True
        return state, False

    def build_snapshot(self, state: SessionStageState) -> dict:
        now = _now_utc()
        started_at = state.stage_started_at or now
        elapsed_s = max(0, int((now - started_at).total_seconds()))
        durations = self._normalized_durations(state)
        current_key = state.current_stage.value
        durations[current_key] = durations.get(current_key, 0) + elapsed_s

        return {
            'session_id': state.session_id,
            'current_stage': state.current_stage.value,
            'stage_durations': durations,
            'timing': {
                'server_time': now.isoformat(),
                'server_time_ms': _to_ms(now),
                'stage_started_at': started_at.isoformat(),
                'stage_started_at_ms': _to_ms(started_at),
                'elapsed_s': elapsed_s,
            },
            'updated_at': state.updated_at.isoformat() if state.updated_at else now.isoformat(),
        }

    def _accumulate_elapsed(self, state: SessionStageState, now: datetime) -> None:
        started_at = state.stage_started_at or now
        elapsed_s = max(0, int((now - started_at).total_seconds()))
        if elapsed_s <= 0:
            return

        durations = self._normalized_durations(state)
        current_key = state.current_stage.value
        durations[current_key] = durations.get(current_key, 0) + elapsed_s
        state.stage_durations = durations

    def _normalized_durations(self, state: SessionStageState) -> dict[str, int]:
        stored = state.stage_durations if isinstance(state.stage_durations, dict) else {}
        durations = _empty_stage_durations()
        for key, value in stored.items():
            if key in durations:
                durations[key] = max(0, int(value or 0))
        return durations

    def _derive_stage(self, session_id: int) -> SessionStage:
        summary = self.db.query(SessionSummary).filter(SessionSummary.session_id == session_id).first()
        if summary and summary.status in {SessionSummaryStatus.completed, SessionSummaryStatus.skipped}:
            return SessionStage.review

        tasks = self.db.query(Task).filter(Task.session_id == session_id).all()
        if not tasks:
            return SessionStage.task_creation

        if all(task.status == SessionTaskStatus.backlog for task in tasks):
            return SessionStage.task_creation

        if any(task.status in {SessionTaskStatus.in_progress, SessionTaskStatus.blocked, SessionTaskStatus.done} for task in tasks):
            return SessionStage.execution

        if any(task.status == SessionTaskStatus.assigned for task in tasks):
            return SessionStage.task_distribution

        return SessionStage.task_creation
