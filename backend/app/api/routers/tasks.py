from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.orm import Session

from app.api.deps import ensure_group_member, ensure_moderator, ensure_session_member, ensure_session_moderator, get_current_user
from app.db.session import get_db
from app.models import Task, UserRole
from app.schemas import AssignmentRead, TaskCreate, TaskRead, TaskUpdate
from app.services.assignment_service import AssignmentService
from app.services.task_service import TaskService
from app.websocket.manager import tasks_manager

router = APIRouter()


def _task_read(task: Task, service: TaskService) -> TaskRead:
    workflow_stage, assignment_status = service.build_assignment_metadata(task)
    return TaskRead(
        id=task.id,
        group_id=task.group_id,
        room_id=task.session_id,
        created_by_id=task.created_by_id,
        assignee_id=task.assignee_id,
        title=task.title,
        description=task.description,
        status=task.status,
        required_skills=[s for s in task.required_skills.split(',') if s],
        priority=task.priority,
        deadline=task.deadline,
        is_completed=task.is_completed,
        created_at=task.created_at,
        created_by={'id': task.creator.id, 'full_name': task.creator.full_name} if task.creator else None,
        assignee={'id': task.assignee.id, 'full_name': task.assignee.full_name} if task.assignee else None,
        workflow_stage=workflow_stage,
        assignment_status=assignment_status,
    )


@router.post('', response_model=TaskRead)
async def create_task(payload: TaskCreate, db: Session = Depends(get_db), user=Depends(get_current_user)):
    service = TaskService(db)
    if payload.room_id is not None:
        session = ensure_session_member(payload.room_id, user, db)
        task = service.create_session_task(session, user, payload.model_dump(exclude_unset=True))
        read = _task_read(task, service)
        await tasks_manager.broadcast(session.id, {'event': 'task_created', 'payload': read.model_dump(mode='json')})
        return read

    if payload.group_id is None:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail='Нужно указать group_id или room_id.')

    ensure_moderator(payload.group_id, user, db)
    task, _ = service.create_task(
        payload.group_id,
        payload.title,
        payload.description,
        payload.required_skills,
        payload.priority,
        payload.deadline,
        user.id,
    )
    return _task_read(task, service)


@router.get('', response_model=list[TaskRead])
def list_session_tasks(room_id: int = Query(..., alias='roomId'), db: Session = Depends(get_db), user=Depends(get_current_user)):
    ensure_session_member(room_id, user, db)
    service = TaskService(db)
    tasks = service.list_session_tasks(room_id)
    return [_task_read(task, service) for task in tasks]


@router.get('/group/{group_id}', response_model=list[TaskRead])
def list_tasks(group_id: int, db: Session = Depends(get_db), user=Depends(get_current_user)):
    ensure_group_member(group_id, user, db)
    service = TaskService(db)
    tasks = service.list_tasks(group_id)
    return [_task_read(task, service) for task in tasks]


@router.patch('/{task_id}', response_model=TaskRead)
async def update_task(task_id: int, payload: TaskUpdate, db: Session = Depends(get_db), user=Depends(get_current_user)):
    task = db.get(Task, task_id)
    if not task:
        raise HTTPException(status_code=404, detail='Задача не найдена.')

    service = TaskService(db)
    if task.session_id is not None:
        ensure_session_member(task.session_id, user, db)
        updated = service.update_session_task(task_id, payload.model_dump(exclude_unset=True))
        read = _task_read(updated, service)
        await tasks_manager.broadcast(task.session_id, {'event': 'task_updated', 'payload': read.model_dump(mode='json')})
        return read

    ensure_moderator(task.group_id, user, db)
    updated = service.update_task(task_id, payload.model_dump(exclude_unset=True))
    return _task_read(updated, service)


@router.delete('/{task_id}')
async def delete_task(task_id: int, db: Session = Depends(get_db), user=Depends(get_current_user)):
    task = db.get(Task, task_id)
    if not task or task.session_id is None:
        raise HTTPException(status_code=404, detail='Задача не найдена.')

    session = ensure_session_member(task.session_id, user, db)
    can_delete = task.created_by_id == user.id or user.role == UserRole.admin
    if not can_delete:
        try:
            ensure_session_moderator(session.id, user, db)
            can_delete = True
        except HTTPException:
            can_delete = False

    if not can_delete:
        raise HTTPException(status_code=403, detail='Удалять задачу может только создатель или модератор.')

    deleted = TaskService(db).delete_session_task(task_id)
    await tasks_manager.broadcast(session.id, {'event': 'task_deleted', 'payload': {'id': deleted.id}})
    return {'message': 'Задача удалена.'}


@router.post('/reassign', response_model=list[TaskRead])
async def reassign_inactive(
    room_id: int = Query(..., alias='roomId'),
    db: Session = Depends(get_db),
    user=Depends(get_current_user),
):
    ensure_session_member(room_id, user, db)
    service = TaskService(db)
    updated = AssignmentService(db).reassign_inactive_session_tasks(room_id)
    items = [_task_read(task, service) for task in updated]
    for item in items:
        await tasks_manager.broadcast(room_id, {'event': 'task_updated', 'payload': item.model_dump(mode='json')})
    return items
