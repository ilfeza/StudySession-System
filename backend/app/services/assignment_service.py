from datetime import datetime, timedelta

from sqlalchemy import and_, func, or_
from sqlalchemy.orm import Session

from app.models import AssignmentStatus, GroupMember, SessionParticipant, Task, TaskAssignment, TaskPriority, User
from app.repositories.task_repository import TaskRepository


class AssignmentService:
    def __init__(self, db: Session):
        self.db = db
        self.task_repo = TaskRepository(db)

    def assign_task(self, task: Task) -> TaskAssignment:
        candidates = self._load_candidates(task.group_id)
        if not candidates:
            raise ValueError('В группе нет участников для назначения задачи.')

        ranked = sorted(
            ((self._candidate_score(user, task), user) for user in candidates),
            key=lambda item: item[0],
            reverse=True,
        )

        best_score, best_user = ranked[0]
        assignment = TaskAssignment(task_id=task.id, user_id=best_user.id, score=best_score)
        return self.task_repo.create_assignment(assignment)

    def reassign_inactive(self, inactivity_minutes: int = 20) -> list[TaskAssignment]:
        threshold = datetime.utcnow() - timedelta(minutes=inactivity_minutes)

        last_activity = (
            self.db.query(
                SessionParticipant.user_id.label('user_id'),
                func.max(SessionParticipant.last_activity_at).label('last_seen'),
            )
            .group_by(SessionParticipant.user_id)
            .subquery()
        )

        inactive_assignments = (
            self.db.query(TaskAssignment)
            .join(Task, Task.id == TaskAssignment.task_id)
            .join(User, User.id == TaskAssignment.user_id)
            .outerjoin(last_activity, last_activity.c.user_id == User.id)
            .filter(
                TaskAssignment.status.in_([AssignmentStatus.assigned, AssignmentStatus.in_progress]),
                or_(
                    User.is_active.is_(False),
                    and_(last_activity.c.last_seen.isnot(None), last_activity.c.last_seen < threshold),
                ),
            )
            .all()
        )

        reassignments: list[TaskAssignment] = []
        for old_assignment in inactive_assignments:
            old_assignment.status = AssignmentStatus.reassigned
            new_assignment = self.assign_task(old_assignment.task)
            reassignments.append(new_assignment)

        self.db.commit()
        return reassignments

    def _load_candidates(self, group_id: int) -> list[User]:
        return (
            self.db.query(User)
            .join(GroupMember, GroupMember.user_id == User.id)
            .filter(GroupMember.group_id == group_id, User.is_active.is_(True))
            .all()
        )

    def _candidate_score(self, user: User, task: Task) -> float:
        # Псевдоформула:
        # score = skills*0.4 + reliability*0.2 + availability*0.15 + workload*0.15 + deadline*0.1
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
