from fastapi import HTTPException, status
from sqlalchemy.orm import Session

from app.models import SessionParticipant, SessionTaskStatus, Task, TaskPriority, User, VideoSession
from app.repositories.task_repository import TaskRepository
from app.services.assignment_service import AssignmentService


class TaskService:
    def __init__(self, db: Session):
        self.repo = TaskRepository(db)
        self.assignment_service = AssignmentService(db)

    def create_task(self, group_id: int, title: str, description: str, required_skills: list[str], priority, deadline, user_id: int):
        task = Task(
            group_id=group_id,
            title=title,
            description=description,
            required_skills=','.join(sorted({skill.strip().lower() for skill in required_skills if skill.strip()})),
            priority=priority,
            deadline=deadline,
            created_by_id=user_id,
        )
        task = self.repo.create_task(task)
        assignment = self.assignment_service.assign_task(task)
        return task, assignment

    def create_session_task(self, session: VideoSession, creator: User, payload: dict) -> Task:
        assignee_id = payload.get('assignee_id')
        if assignee_id is not None:
            self._ensure_session_assignee(session.id, assignee_id)

        status_value = payload.get('status', SessionTaskStatus.todo)
        task = Task(
            group_id=session.group_id,
            session_id=session.id,
            title=payload['title'],
            description=payload.get('description', ''),
            required_skills=','.join(sorted({skill.strip().lower() for skill in payload.get('required_skills', []) if skill.strip()})),
            priority=payload.get('priority', TaskPriority.medium),
            deadline=payload.get('deadline'),
            created_by_id=creator.id,
            assignee_id=assignee_id,
            status=status_value,
            is_completed=status_value == SessionTaskStatus.done,
        )
        if task.assignee_id is None and status_value != SessionTaskStatus.done:
            suggested = self.assignment_service.pick_session_assignee(session.id, task, online_only=True)
            if suggested is not None:
                task.assignee_id = suggested.id
                if status_value == SessionTaskStatus.needs_reassignment:
                    task.status = SessionTaskStatus.todo
        return self.repo.create_task(task)

    def list_tasks(self, group_id: int):
        return self.repo.list_group_tasks(group_id)

    def list_session_tasks(self, session_id: int):
        return self.repo.list_session_tasks(session_id)

    def update_task(self, task_id: int, payload: dict):
        task = self.repo.get_task(task_id)
        if not task:
            raise ValueError('Задача не найдена.')

        for key, value in payload.items():
            if value is None:
                continue
            if key == 'required_skills':
                value = ','.join(sorted({skill.strip().lower() for skill in value if skill.strip()}))
            setattr(task, key, value)
        self.repo.db.commit()
        self.repo.db.refresh(task)
        return task

    def update_session_task(self, task_id: int, payload: dict) -> Task:
        task = self.repo.get_task(task_id)
        if not task or task.session_id is None:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail='Задача не найдена.')

        if 'assignee_id' in payload and payload['assignee_id'] is not None:
            self._ensure_session_assignee(task.session_id, int(payload['assignee_id']))

        for key, value in payload.items():
            if key == 'required_skills':
                value = ','.join(sorted({skill.strip().lower() for skill in value if skill.strip()}))
            if key == 'status' and value is not None:
                task.is_completed = value == SessionTaskStatus.done
            if key == 'assignee_id' and value is None and task.status == SessionTaskStatus.done:
                continue
            setattr(task, key, value)

        self.repo.db.commit()
        self.repo.db.refresh(task)
        return task

    def delete_session_task(self, task_id: int) -> Task:
        task = self.repo.get_task(task_id)
        if not task or task.session_id is None:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail='Задача не найдена.')
        self.repo.delete_task(task)
        return task

    def _ensure_session_assignee(self, session_id: int, assignee_id: int) -> SessionParticipant:
        participant = (
            self.repo.db.query(SessionParticipant)
            .filter(SessionParticipant.session_id == session_id, SessionParticipant.user_id == assignee_id)
            .first()
        )
        if not participant:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail='Исполнителем можно назначить только участника текущей видеосессии.',
            )
        return participant
