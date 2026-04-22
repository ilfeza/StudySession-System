from __future__ import annotations

from datetime import datetime

from fastapi import HTTPException, status
from sqlalchemy.orm import Session

from app.models import (
    SessionParticipant,
    SessionSummary,
    SessionSummaryParticipant,
    SessionSummaryStatus,
    SessionSummaryTask,
    Task,
    VideoSession,
)


class SessionSummaryService:
    def __init__(self, db: Session):
        self.db = db

    def get_or_create(self, session: VideoSession, user_id: int) -> SessionSummary:
        summary = (
            self.db.query(SessionSummary)
            .filter(SessionSummary.session_id == session.id)
            .first()
        )
        if summary:
            return summary

        summary = SessionSummary(
            session_id=session.id,
            group_id=session.group_id,
            created_by_id=user_id,
            updated_by_id=user_id,
            short_description='',
            status=SessionSummaryStatus.draft,
        )
        self.db.add(summary)
        self.db.flush()
        self._sync_participants(summary, session)
        self._sync_tasks(summary, session, [])
        self.db.commit()
        self.db.refresh(summary)
        return summary

    def get_summary(self, session_id: int) -> SessionSummary | None:
        return (
            self.db.query(SessionSummary)
            .filter(SessionSummary.session_id == session_id)
            .first()
        )

    def save_summary(self, session: VideoSession, user_id: int, payload: dict) -> SessionSummary:
        summary = self.get_or_create(session, user_id)
        summary.completed_work = str(payload.get('completed_work', '')).strip()
        summary.next_steps = str(payload.get('next_steps', '')).strip()
        short_description = str(payload.get('short_description', '')).strip()
        summary.short_description = short_description or self._build_short_description(summary.completed_work, summary.next_steps)
        summary.status = payload.get('status', SessionSummaryStatus.completed)
        summary.remind_at = None
        summary.updated_by_id = user_id
        summary.updated_at = datetime.utcnow()

        self._sync_participants(summary, session)
        self._sync_tasks(summary, session, payload.get('tasks', []))
        self._mark_session_finished(session)

        self.db.commit()
        self.db.refresh(summary)
        return summary

    def skip_summary(self, session: VideoSession, user_id: int, remind_at: datetime | None) -> SessionSummary:
        summary = self.get_or_create(session, user_id)
        summary.status = SessionSummaryStatus.skipped
        summary.remind_at = remind_at
        summary.updated_by_id = user_id
        summary.updated_at = datetime.utcnow()
        self._sync_participants(summary, session)
        self._sync_tasks(summary, session, [])
        self._mark_session_finished(session)
        self.db.commit()
        self.db.refresh(summary)
        return summary

    def list_group_history(self, group_id: int) -> list[tuple[VideoSession, SessionSummary]]:
        rows = (
            self.db.query(VideoSession, SessionSummary)
            .join(SessionSummary, SessionSummary.session_id == VideoSession.id)
            .filter(VideoSession.group_id == group_id)
            .order_by(VideoSession.starts_at.desc(), SessionSummary.updated_at.desc())
            .all()
        )
        return rows

    def _sync_participants(self, summary: SessionSummary, session: VideoSession) -> None:
        participants = (
            self.db.query(SessionParticipant)
            .filter(SessionParticipant.session_id == session.id)
            .all()
        )

        summary.participants.clear()
        for participant in participants:
            full_name = participant.user.full_name if participant.user else f'Участник #{participant.user_id}'
            role_in_session = 'moderator' if participant.user_id == session.created_by_id else 'participant'
            summary.participants.append(
                SessionSummaryParticipant(
                    user_id=participant.user_id,
                    full_name_snapshot=full_name,
                    role_in_session=role_in_session,
                ),
            )

    def _sync_tasks(self, summary: SessionSummary, session: VideoSession, task_payloads: list[dict]) -> None:
        session_tasks = (
            self.db.query(Task)
            .filter(Task.session_id == session.id)
            .order_by(Task.created_at.asc(), Task.id.asc())
            .all()
        )
        task_map = {task.id: task for task in session_tasks}

        summary.tasks.clear()
        if task_payloads:
            normalized_payloads = task_payloads
        else:
            normalized_payloads = [
                {
                    'task_id': task.id,
                    'status_at_summary': task.status,
                    'sort_order': index,
                }
                for index, task in enumerate(session_tasks)
            ]

        for index, item in enumerate(normalized_payloads):
            task_id = item.get('task_id')
            task = task_map.get(task_id)
            if task_id is not None and task is None:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail='В итогах можно указывать только задачи текущей сессии.',
                )

            title = task.title if task else str(item.get('title', '')).strip()
            if not title:
                continue

            assignee = task.assignee if task else None
            summary.tasks.append(
                SessionSummaryTask(
                    task_id=task.id if task else task_id,
                    title_snapshot=title,
                    assignee_id=task.assignee_id if task else item.get('assignee_id'),
                    assignee_name_snapshot=assignee.full_name if assignee else '',
                    deadline_snapshot=task.deadline if task else item.get('deadline'),
                    status_at_summary=item.get('status_at_summary', task.status if task else 'todo'),
                    sort_order=int(item.get('sort_order', index)),
                ),
            )

    def _mark_session_finished(self, session: VideoSession) -> None:
        if session.ends_at is None:
            session.ends_at = datetime.utcnow()
        session.is_active = False

    @staticmethod
    def _build_short_description(completed_work: str, next_steps: str) -> str:
        base = completed_work or next_steps
        return base[:157] + '...' if len(base) > 160 else base
