from __future__ import annotations

from datetime import datetime

from sqlalchemy.orm import Session

from app.models import SessionStage, SessionStageState, SessionSummary, SessionSummaryStatus, SessionTaskStatus, Task, VideoSession


def _now_utc() -> datetime:
    return datetime.utcnow()


def _to_ms(value: datetime) -> int:
    return int(value.timestamp() * 1000)


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
            updated_at=now,
        )
        self.db.add(state)
        self.db.commit()
        self.db.refresh(state)
        return state

    def set_stage(self, state: SessionStageState, stage: SessionStage) -> SessionStageState:
        if state.current_stage == stage:
            return state

        now = _now_utc()
        state.current_stage = stage
        state.stage_started_at = now
        state.updated_at = now
        self.db.commit()
        self.db.refresh(state)
        return state

    def sync_stage_for_session(self, session_id: int) -> SessionStageState:
        state = self.get_or_create(session_id)
        derived_stage = self._derive_stage(session_id)
        if state.current_stage != derived_stage:
            now = _now_utc()
            state.current_stage = derived_stage
            state.stage_started_at = now
            state.updated_at = now
            self.db.commit()
            self.db.refresh(state)
        return state

    def build_snapshot(self, state: SessionStageState) -> dict:
        now = _now_utc()
        started_at = state.stage_started_at or now
        elapsed_s = max(0, int((now - started_at).total_seconds()))

        return {
            'session_id': state.session_id,
            'current_stage': state.current_stage.value,
            'timing': {
                'server_time': now.isoformat(),
                'server_time_ms': _to_ms(now),
                'stage_started_at': started_at.isoformat(),
                'stage_started_at_ms': _to_ms(started_at),
                'elapsed_s': elapsed_s,
            },
            'updated_at': state.updated_at.isoformat() if state.updated_at else now.isoformat(),
        }

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
