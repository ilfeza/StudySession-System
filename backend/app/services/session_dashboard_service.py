from __future__ import annotations

from dataclasses import dataclass
from datetime import datetime

from sqlalchemy import case, func
from sqlalchemy.orm import Session

from app.models import SessionParticipant, SessionTaskStatus, Task, User, VideoSession
from app.services.assignment_service import AssignmentService


def _now_utc() -> datetime:
    return datetime.utcnow()


def _parse_skills(raw: str) -> list[str]:
    return [item.strip() for item in raw.split(',') if item.strip()]


@dataclass(slots=True)
class ParticipantLoad:
    user_id: int
    active_tasks: int
    completed_tasks: int
    workload_limit: int
    load_percent: int


class SessionDashboardService:
    def __init__(self, db: Session):
        self.db = db
        self.assignment_service = AssignmentService(db)

    def build_snapshot(self, session_id: int) -> dict:
        session = self.db.get(VideoSession, session_id)
        if not session:
            raise ValueError('Сессия не найдена.')

        participants_rows = (
            self.db.query(SessionParticipant, User)
            .join(User, User.id == SessionParticipant.user_id)
            .filter(SessionParticipant.session_id == session_id)
            .order_by(SessionParticipant.is_online.desc(), User.full_name.asc())
            .all()
        )

        task_rows = self.db.query(Task).filter(Task.session_id == session_id).all()
        participant_loads = self._build_participant_loads(session_id, [user for _, user in participants_rows])
        max_active_tasks = max((load.active_tasks for load in participant_loads.values()), default=0)
        session_tasks = [self._build_task_item(task) for task in task_rows]
        last_assignment = self._build_last_assignment(session_id)
        history = self._build_history(session_id)

        total_tasks = len(task_rows)
        completed_tasks = sum(1 for task in task_rows if task.status == SessionTaskStatus.done)
        in_progress_tasks = sum(1 for task in task_rows if task.status == SessionTaskStatus.in_progress)
        blocked_tasks = sum(1 for task in task_rows if task.status == SessionTaskStatus.blocked)
        avg_load = int(round(sum(item.load_percent for item in participant_loads.values()) / max(len(participant_loads), 1))) if participant_loads else 0

        heaviest = None
        lightest = None
        if participant_loads:
            heaviest = max(participant_loads.values(), key=lambda item: (item.load_percent, item.active_tasks))
            lightest = min(participant_loads.values(), key=lambda item: (item.load_percent, item.active_tasks))

        participants = []
        for participant, user in participants_rows:
            load = participant_loads[user.id]
            participants.append(
                {
                    'id': user.id,
                    'full_name': user.full_name,
                    'is_online': participant.is_online,
                    'last_activity_at': participant.last_activity_at.isoformat(),
                    'active_tasks': load.active_tasks,
                    'completed_tasks': load.completed_tasks,
                    'workload_limit': load.workload_limit,
                    'load_percent': load.load_percent,
                    'reliability_score': user.reliability_score,
                    'is_blocked': participant.is_blocked,
                    'skills': _parse_skills(user.skills),
                }
            )

        return {
            'session_id': session_id,
            'generated_at': _now_utc().isoformat(),
            'participants': participants,
            'tasks': session_tasks,
            'metrics': {
                'total_tasks': total_tasks,
                'completed_tasks': completed_tasks,
                'in_progress_tasks': in_progress_tasks,
                'blocked_tasks': blocked_tasks,
                'completion_rate': int(round((completed_tasks / total_tasks) * 100)) if total_tasks else 0,
                'average_load_percent': avg_load,
                'max_active_tasks': max_active_tasks,
                'most_loaded_participant': self._participant_summary(participants_rows, heaviest),
                'least_loaded_participant': self._participant_summary(participants_rows, lightest),
            },
            'last_assignment': last_assignment,
            'history': history,
        }

    def _build_participant_loads(self, session_id: int, users: list[User]) -> dict[int, ParticipantLoad]:
        loads: dict[int, ParticipantLoad] = {}
        if not users:
            return loads

        counts = (
            self.db.query(
                Task.assignee_id.label('user_id'),
                func.count(Task.id).label('active_tasks'),
                func.sum(case((Task.status == SessionTaskStatus.done, 1), else_=0)).label('completed_tasks'),
            )
            .filter(Task.session_id == session_id, Task.assignee_id.isnot(None))
            .group_by(Task.assignee_id)
            .all()
        )
        count_map = {
            int(row.user_id): {
                'active_tasks': int(row.active_tasks or 0),
                'completed_tasks': int(row.completed_tasks or 0),
            }
            for row in counts
        }

        active_counts = [count_map.get(user.id, {}).get('active_tasks', 0) for user in users]
        fallback_limit = max(active_counts) if active_counts else 0

        for user in users:
            workload_limit = max(int(user.workload_limit or 0), 1)
            active_tasks = count_map.get(user.id, {}).get('active_tasks', 0)
            completed_tasks = count_map.get(user.id, {}).get('completed_tasks', 0)
            effective_limit = workload_limit if workload_limit > 0 else max(fallback_limit, 1)
            load_percent = int(round((active_tasks / max(effective_limit, 1)) * 100)) if effective_limit else 0
            loads[user.id] = ParticipantLoad(
                user_id=user.id,
                active_tasks=active_tasks,
                completed_tasks=completed_tasks,
                workload_limit=effective_limit,
                load_percent=load_percent,
            )
        return loads

    def _build_task_item(self, task: Task) -> dict:
        assignment = None
        if task.session_id is not None and task.assignee_id is not None:
            suggestion = self.assignment_service.suggest_session_assignee(task.session_id, task, exclude_user_ids={task.assignee_id})
            assignment = {
                'assignee_name': task.assignee.full_name if task.assignee else '',
                'is_auto_assigned': True,
                'reason_codes': self._build_reason_codes(task, suggestion),
            }
        elif task.assignee is not None:
            assignment = {
                'assignee_name': task.assignee.full_name,
                'is_auto_assigned': False,
                'reason_codes': [],
            }

        return {
            'id': task.id,
            'title': task.title,
            'description': task.description,
            'status': task.status.value,
            'priority': task.priority.value,
            'deadline': task.deadline.isoformat() if task.deadline else None,
            'assignee_id': task.assignee_id,
            'assignee_name': task.assignee.full_name if task.assignee else None,
            'required_skills': _parse_skills(task.required_skills),
            'is_completed': task.is_completed,
            'created_at': task.created_at.isoformat(),
            'assignment': assignment,
        }

    def _build_reason_codes(self, task: Task, suggestion: dict | None) -> list[str]:
        if not task.assignee:
            return []
        reason_codes = ['online']
        if suggestion is not None:
            reason_codes.extend(['minimal_load', 'skills_fit', 'high_reliability'])
        return list(dict.fromkeys(reason_codes))

    def _build_last_assignment(self, session_id: int) -> dict | None:
        task = (
            self.db.query(Task)
            .filter(Task.session_id == session_id, Task.assignee_id.isnot(None))
            .order_by(Task.created_at.desc(), Task.id.desc())
            .first()
        )
        if not task or not task.assignee:
            return None

        suggestion = self.assignment_service.suggest_session_assignee(session_id, task, exclude_user_ids={task.assignee_id})
        return {
            'task_id': task.id,
            'task_title': task.title,
            'assignee_id': task.assignee_id,
            'assignee_name': task.assignee.full_name,
            'assigned_at': task.created_at.isoformat(),
            'reasons': self._assignment_reasons(task, suggestion),
            'auto_assigned': suggestion is not None,
        }

    def _assignment_reasons(self, task: Task, suggestion: dict | None) -> list[str]:
        reasons: list[str] = []
        if suggestion is not None:
            reasons.append('минимальная загрузка')
            if suggestion.get('skill_gap', 0) == 0:
                reasons.append('подходит по навыкам')
            reasons.append('онлайн')
            reasons.append('высокий рейтинг надёжности')
        elif task.assignee is not None:
            reasons.append('назначено вручную')
        return reasons

    def _build_history(self, session_id: int) -> list[dict]:
        tasks = (
            self.db.query(Task)
            .filter(Task.session_id == session_id)
            .order_by(Task.created_at.desc())
            .limit(20)
            .all()
        )
        history: list[dict] = []
        for task in tasks:
            history.append(
                {
                    'timestamp': task.created_at.isoformat(),
                    'task_id': task.id,
                    'message': f'Задача #{task.id} назначена {task.assignee.full_name}' if task.assignee else f'Задача #{task.id} создана',
                    'task_title': task.title,
                    'assignee_name': task.assignee.full_name if task.assignee else None,
                    'status': task.status.value,
                }
            )
        return history

    def _participant_summary(self, participants_rows, load: ParticipantLoad | None) -> dict | None:
        if load is None:
            return None
        for participant, user in participants_rows:
            if user.id == load.user_id:
                return {
                    'id': user.id,
                    'full_name': user.full_name,
                    'load_percent': load.load_percent,
                    'active_tasks': load.active_tasks,
                }
        return None
