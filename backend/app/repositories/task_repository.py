from sqlalchemy.orm import Session

from app.models import AssignmentStatus, Task, TaskAssignment


class TaskRepository:
    def __init__(self, db: Session):
        self.db = db

    def create_task(self, task: Task) -> Task:
        self.db.add(task)
        self.db.commit()
        self.db.refresh(task)
        return task

    def list_group_tasks(self, group_id: int):
        return self.db.query(Task).filter(Task.group_id == group_id).order_by(Task.created_at.desc()).all()

    def get_task(self, task_id: int) -> Task | None:
        return self.db.get(Task, task_id)

    def create_assignment(self, assignment: TaskAssignment) -> TaskAssignment:
        self.db.add(assignment)
        self.db.commit()
        self.db.refresh(assignment)
        return assignment

    def list_active_assignments_for_user(self, user_id: int):
        return (
            self.db.query(TaskAssignment)
            .filter(
                TaskAssignment.user_id == user_id,
                TaskAssignment.status.in_([AssignmentStatus.assigned, AssignmentStatus.in_progress]),
            )
            .all()
        )
