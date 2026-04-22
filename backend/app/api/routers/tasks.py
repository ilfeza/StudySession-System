from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.api.deps import ensure_group_member, ensure_moderator, get_current_user
from app.db.session import get_db
from app.models import Task
from app.schemas import AssignmentRead, TaskCreate, TaskRead, TaskUpdate
from app.services.assignment_service import AssignmentService
from app.services.task_service import TaskService

router = APIRouter()


def _task_read(task: Task) -> TaskRead:
    return TaskRead(
        id=task.id,
        group_id=task.group_id,
        title=task.title,
        description=task.description,
        required_skills=[s for s in task.required_skills.split(',') if s],
        priority=task.priority,
        deadline=task.deadline,
        is_completed=task.is_completed,
    )


@router.post('', response_model=TaskRead)
def create_task(payload: TaskCreate, db: Session = Depends(get_db), user=Depends(get_current_user)):
    ensure_moderator(payload.group_id, user, db)
    task, _ = TaskService(db).create_task(
        payload.group_id,
        payload.title,
        payload.description,
        payload.required_skills,
        payload.priority,
        payload.deadline,
        user.id,
    )
    return _task_read(task)


@router.get('/group/{group_id}', response_model=list[TaskRead])
def list_tasks(group_id: int, db: Session = Depends(get_db), user=Depends(get_current_user)):
    ensure_group_member(group_id, user, db)
    tasks = TaskService(db).list_tasks(group_id)
    return [_task_read(task) for task in tasks]


@router.patch('/{task_id}', response_model=TaskRead)
def update_task(task_id: int, payload: TaskUpdate, db: Session = Depends(get_db), user=Depends(get_current_user)):
    task = db.get(Task, task_id)
    if not task:
        raise HTTPException(status_code=404, detail='Задача не найдена.')
    ensure_moderator(task.group_id, user, db)
    updated = TaskService(db).update_task(task_id, payload.model_dump(exclude_unset=True))
    return _task_read(updated)


@router.post('/reassign', response_model=list[AssignmentRead])
def reassign_inactive(db: Session = Depends(get_db), _=Depends(get_current_user)):
    assignments = AssignmentService(db).reassign_inactive()
    return [AssignmentRead.model_validate(item) for item in assignments]
