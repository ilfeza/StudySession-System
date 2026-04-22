from sqlalchemy.orm import Session

from app.models import Task
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

    def list_tasks(self, group_id: int):
        return self.repo.list_group_tasks(group_id)

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
