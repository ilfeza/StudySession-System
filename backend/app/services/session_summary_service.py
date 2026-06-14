from __future__ import annotations

from collections import Counter
from datetime import datetime

from fastapi import HTTPException, status
from sqlalchemy.orm import Session

from app.models import (
    ChatMessage,
    GroupAnnouncement,
    SessionParticipant,
    SessionStage,
    SessionSummary,
    SessionSummaryParticipant,
    SessionSummaryStatus,
    SessionSummaryTask,
    Task,
    User,
    VideoSession,
)
from app.services.session_stage_service import SessionStageService


class SessionSummaryService:
    def __init__(self, db: Session):
        self.db = db
        self.stage_service = SessionStageService(db)

    def get_or_create(self, session: VideoSession, user_id: int) -> SessionSummary:
        summary = self.db.query(SessionSummary).filter(SessionSummary.session_id == session.id).first()
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
        self._hydrate_insights(summary, session)
        self.db.commit()
        self.db.refresh(summary)
        return summary

    def get_summary(self, session_id: int) -> SessionSummary | None:
        return self.db.query(SessionSummary).filter(SessionSummary.session_id == session_id).first()

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
        self._hydrate_insights(summary, session)
        self._mark_session_finished(session)
        if summary.status == SessionSummaryStatus.completed:
            self._publish_summary_announcement(session, summary, user_id)

        self.db.commit()
        self.db.refresh(summary)
        self.stage_service.sync_stage_for_session(session.id)
        return summary

    def skip_summary(self, session: VideoSession, user_id: int, remind_at: datetime | None) -> SessionSummary:
        summary = self.get_or_create(session, user_id)
        summary.status = SessionSummaryStatus.skipped
        summary.remind_at = remind_at
        summary.updated_by_id = user_id
        summary.updated_at = datetime.utcnow()
        self._sync_participants(summary, session)
        self._sync_tasks(summary, session, [])
        self._hydrate_insights(summary, session)
        self._mark_session_finished(session)
        self.db.commit()
        self.db.refresh(summary)
        self.stage_service.sync_stage_for_session(session.id)
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
        participants = self.db.query(SessionParticipant).filter(SessionParticipant.session_id == session.id).all()

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
        session_tasks = self.db.query(Task).filter(Task.session_id == session.id).order_by(Task.created_at.asc(), Task.id.asc()).all()
        task_map = {task.id: task for task in session_tasks}

        summary.tasks.clear()
        normalized_payloads = task_payloads or [
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
                    status_at_summary=item.get('status_at_summary', task.status if task else 'backlog'),
                    sort_order=int(item.get('sort_order', index)),
                ),
            )

    def _hydrate_insights(self, summary: SessionSummary, session: VideoSession) -> None:
        tasks = self.db.query(Task).filter(Task.session_id == session.id).all()
        messages = self.db.query(ChatMessage).filter(ChatMessage.session_id == session.id).all()

        total_tasks = len(tasks)
        done_count = sum(1 for task in tasks if task.is_completed)
        blocked_titles = [task.title for task in tasks if str(task.status) == 'SessionTaskStatus.blocked' or getattr(task.status, 'value', '') == 'blocked']

        summary.completion_summary = f'Завершено {done_count} из {total_tasks} задач.'

        contributions = Counter(message.sender_name for message in messages)
        if contributions:
            contribution_parts = [f'{name}: {count} сообщений' for name, count in contributions.most_common(5)]
            summary.contribution_summary = '; '.join(contribution_parts)
        else:
            summary.contribution_summary = 'Сообщений по сессии пока нет.'

        if blocked_titles:
            summary.bottleneck_summary = 'Блокеры: ' + '; '.join(blocked_titles[:5])
        else:
            summary.bottleneck_summary = 'Критичных блокеров к завершению обзора не выявлено.'

        task_thread_messages = sum(1 for item in messages if item.task_id is not None)
        execution_messages = sum(1 for item in messages if item.stage == SessionStage.execution.value)
        summary.collaboration_summary = (
            f'В обсуждении {len(messages)} сообщений, из них {task_thread_messages} привязаны к задачам, '
            f'{execution_messages} относятся к этапу исполнения.'
        )

    def _mark_session_finished(self, session: VideoSession) -> None:
        if session.ends_at is None:
            session.ends_at = datetime.utcnow()
        session.is_active = False

    def _publish_summary_announcement(self, session: VideoSession, summary: SessionSummary, user_id: int) -> None:
        user = self.db.get(User, user_id)
        if not user:
            return

        parts = [f'Завершена сессия «{session.title}».']
        if summary.completed_work.strip():
            parts.append(f'\n\nЧто сделано:\n{summary.completed_work.strip()}')
        if summary.next_steps.strip():
            parts.append(f'\n\nСледующие шаги:\n{summary.next_steps.strip()}')

        self.db.add(GroupAnnouncement(group_id=session.group_id, author_id=user.id, body=''.join(parts)))

    @staticmethod
    def _build_short_description(completed_work: str, next_steps: str) -> str:
        base = completed_work or next_steps
        return base[:157] + '...' if len(base) > 160 else base
