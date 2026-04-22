from __future__ import annotations

from datetime import datetime

from sqlalchemy import distinct, func
from sqlalchemy.orm import Session

from app.models import SessionParticipant, SessionSummary, Task, VideoSession


class UserProfileService:
    def __init__(self, db: Session):
        self.db = db

    def progress(self, user_id: int) -> dict:
        sessions_attended = (
            self.db.query(func.count(distinct(SessionParticipant.session_id)))
            .join(VideoSession, VideoSession.id == SessionParticipant.session_id)
            .filter(SessionParticipant.user_id == user_id, VideoSession.starts_at <= datetime.utcnow())
            .scalar()
            or 0
        )
        tasks_created = self.db.query(func.count(Task.id)).filter(Task.created_by_id == user_id).scalar() or 0
        tasks_completed = (
            self.db.query(func.count(Task.id))
            .filter(Task.assignee_id == user_id, Task.is_completed.is_(True))
            .scalar()
            or 0
        )
        return {
            'sessions_attended': int(sessions_attended),
            'tasks_created': int(tasks_created),
            'tasks_completed': int(tasks_completed),
        }

    def session_history(self, user_id: int):
        return (
            self.db.query(VideoSession)
            .join(SessionParticipant, SessionParticipant.session_id == VideoSession.id)
            .filter(SessionParticipant.user_id == user_id, VideoSession.starts_at <= datetime.utcnow())
            .order_by(VideoSession.starts_at.desc())
            .all()
        )

    def summary_map(self, session_ids: list[int]) -> dict[int, SessionSummary]:
        if not session_ids:
            return {}
        rows = (
            self.db.query(SessionSummary)
            .filter(SessionSummary.session_id.in_(session_ids))
            .all()
        )
        return {row.session_id: row for row in rows}
