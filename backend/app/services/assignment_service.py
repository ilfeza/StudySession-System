from datetime import datetime, timedelta

from fastapi import HTTPException, status
from sqlalchemy import and_, func, or_
from sqlalchemy.orm import Session

from app.models import AssignmentStatus, GroupMember, SessionParticipant, SessionTaskStatus, Task, TaskAssignment, TaskPriority, User
from app.repositories.task_repository import TaskRepository


class AssignmentService:
    def __init__(self, db: Session):
        self.db = db
        self.task_repo = TaskRepository(db)

    def assign_task(self, task: Task) -> TaskAssignment:
        candidates = self._load_candidates(task.group_id)
        if not candidates:
            raise ValueError('В группе нет участников для назначения задачи.')

        best_user, best_score = self._pick_best_group_candidate(task, candidates)
        task.assignee_id = best_user.id
        task.status = SessionTaskStatus.assigned
        assignment = TaskAssignment(task_id=task.id, user_id=best_user.id, score=best_score)
        self.db.add(assignment)
        self.db.commit()
        self.db.refresh(task)
        self.db.refresh(assignment)
        return assignment

    def suggest_session_assignee(self, session_id: int, task: Task, *, exclude_user_ids: set[int] | None = None) -> dict | None:
        user, score = self._pick_session_candidate(session_id, task, exclude_user_ids=exclude_user_ids)
        if user is None:
            return None

        active_count = self._active_session_task_count(session_id, user.id)
        skill_gap = self._task_skill_gap(user, task)
        return {
            'user': user,
            'score': score,
            'reason': self._build_recommendation_reason(user, active_count, skill_gap),
            'active_count': active_count,
            'skill_gap': skill_gap,
        }

    def ensure_user_can_take_task(self, session_id: int, user_id: int, task_id: int | None = None) -> None:
        user = self.db.get(User, user_id)
        if not user or not user.is_active:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail='Исполнителем можно назначить только активного участника.')

        active_count = self._active_session_task_count(session_id, user_id, exclude_task_id=task_id)
        if active_count >= max(user.workload_limit, 1):
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail='Нельзя перегружать участника: достигнут лимит активных задач.',
            )

    def reassign_inactive_session_tasks(self, session_id: int, inactivity_minutes: int = 20) -> list[Task]:
        threshold = datetime.utcnow() - timedelta(minutes=inactivity_minutes)
        tasks = (
            self.db.query(Task)
            .join(SessionParticipant, and_(SessionParticipant.session_id == Task.session_id, SessionParticipant.user_id == Task.assignee_id))
            .filter(
                Task.session_id == session_id,
                Task.status.in_([SessionTaskStatus.assigned, SessionTaskStatus.in_progress, SessionTaskStatus.blocked]),
                or_(
                    SessionParticipant.is_online.is_(False),
                    SessionParticipant.last_activity_at < threshold,
                ),
            )
            .all()
        )

        updated: list[Task] = []
        for task in tasks:
            exclude_ids = {task.assignee_id} if task.assignee_id is not None else set()
            suggestion = self.suggest_session_assignee(session_id, task, exclude_user_ids=exclude_ids)
            if suggestion is None:
                task.status = SessionTaskStatus.backlog
                task.assignee_id = None
            else:
                task.assignee_id = suggestion['user'].id
                task.status = SessionTaskStatus.assigned
            updated.append(task)

        self.db.commit()
        for task in updated:
            self.db.refresh(task)
        return updated

    def _load_candidates(self, group_id: int) -> list[User]:
        return (
            self.db.query(User)
            .join(GroupMember, GroupMember.user_id == User.id)
            .filter(GroupMember.group_id == group_id, User.is_active.is_(True))
            .all()
        )

    def _pick_best_group_candidate(self, task: Task, candidates: list[User]) -> tuple[User, float]:
        ranked = sorted(
            ((self._candidate_score(user, task), user) for user in candidates),
            key=lambda item: item[0],
            reverse=True,
        )
        best_score, best_user = ranked[0]
        return best_user, best_score

    def _pick_session_candidate(
        self,
        session_id: int,
        task: Task,
        *,
        exclude_user_ids: set[int] | None = None,
    ) -> tuple[User | None, float]:
        exclude_user_ids = exclude_user_ids or set()
        query = (
            self.db.query(SessionParticipant, User)
            .join(User, User.id == SessionParticipant.user_id)
            .filter(
                SessionParticipant.session_id == session_id,
                SessionParticipant.is_online.is_(True),
                User.is_active.is_(True),
            )
        )
        candidates = [user for _, user in query.all() if user.id not in exclude_user_ids]
        candidates = [user for user in candidates if self._active_session_task_count(session_id, user.id, exclude_task_id=task.id) < max(user.workload_limit, 1)]
        if not candidates:
            return None, 0.0

        ranked = sorted(
            ((self._session_candidate_score(session_id, user, task), user) for user in candidates),
            key=lambda item: item[0],
        )
        best_tuple, best_user = ranked[0]
        score = float((10 - best_tuple[0]) + (5 - best_tuple[1]))
        return best_user, score

    def _session_candidate_score(self, session_id: int, user: User, task: Task) -> tuple[int, int, str]:
        active_count = self._active_session_task_count(session_id, user.id, exclude_task_id=task.id)
        skill_gap = self._task_skill_gap(user, task)
        return (active_count, skill_gap, user.full_name.lower())

    def _task_skill_gap(self, user: User, task: Task) -> int:
        user_skills = {skill.strip().lower() for skill in user.skills.split(',') if skill.strip()}
        task_skills = {skill.strip().lower() for skill in task.required_skills.split(',') if skill.strip()}
        return 0 if not task_skills else len(task_skills - user_skills)

    def _build_recommendation_reason(self, user: User, active_count: int, skill_gap: int) -> str:
        if skill_gap == 0:
            skill_part = 'полностью закрывает нужные навыки'
        elif skill_gap == 1:
            skill_part = 'почти полностью закрывает нужные навыки'
        else:
            skill_part = 'может взять задачу при поддержке команды'
        return f'{user.full_name}: {skill_part}, активных задач {active_count}/{user.workload_limit}.'

    def _active_session_task_count(self, session_id: int, user_id: int, exclude_task_id: int | None = None) -> int:
        query = self.db.query(func.count(Task.id)).filter(
            Task.session_id == session_id,
            Task.assignee_id == user_id,
            Task.status.in_([SessionTaskStatus.assigned, SessionTaskStatus.in_progress, SessionTaskStatus.blocked]),
        )
        if exclude_task_id is not None:
            query = query.filter(Task.id != exclude_task_id)
        return int(query.scalar() or 0)

    def _candidate_score(self, user: User, task: Task) -> float:
        user_skills = {skill.strip().lower() for skill in user.skills.split(',') if skill.strip()}
        task_skills = {skill.strip().lower() for skill in task.required_skills.split(',') if skill.strip()}
        skill_match = 1.0 if not task_skills else len(user_skills & task_skills) / len(task_skills)

        active_assignments = self.task_repo.list_active_assignments_for_user(user.id)
        load_ratio = len(active_assignments) / max(user.workload_limit, 1)
        workload_score = max(0.0, 1.0 - load_ratio)
        availability_score = 1.0 if load_ratio < 1 else 0.2
        deadline_score = self._deadline_score(task.priority, task.deadline)

        return (
            skill_match * 0.4
            + user.reliability_score * 0.2
            + availability_score * 0.15
            + workload_score * 0.15
            + deadline_score * 0.1
        )

    def _deadline_score(self, priority: TaskPriority, deadline) -> float:
        if not deadline:
            return 0.7

        delta_hours = max((deadline - datetime.utcnow()).total_seconds() / 3600.0, 0.0)
        urgency = 1.0 if delta_hours < 24 else 0.7 if delta_hours < 72 else 0.5

        if priority == TaskPriority.critical:
            return min(1.0, urgency + 0.1)
        if priority == TaskPriority.high:
            return urgency
        return max(0.3, urgency - 0.1)
